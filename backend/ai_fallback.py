"""
ai_fallback.py — THE ONLY FILE IN FLORA THAT CALLS AN AI MODEL.

Scope: this module handles TWO related jobs, both isolated from the core
deterministic engine:

  1. classify_with_ai() — fallback for free text the rule-based parser
     can't match to a single category/mode (unchanged from earlier design).

  2. breakdown_with_ai() — decomposes a COMPOUND description (e.g. "veg
     sandwich with cheese") into individual ingredient components, each
     with an estimated gram quantity. If the AI can't confidently estimate
     quantities, it returns a clarifying question instead of guessing.

In both cases: the AI NEVER calculates CO2 itself and NEVER decides on
suggestions. It only extracts structured facts (what ingredients, how
much). All math and decision-making happens afterward in carbon_math.py,
using our own sourced, auditable emission factor tables. This keeps the
"AI never does the actual carbon math" boundary intact even for the
richer component-breakdown feature.
"""

import os
import json

from carbon_math import INGREDIENT_FACTORS_PER_KG

VALID_MODES = {
    "transport": ["car", "bus", "train", "flight", "walking"],
    "diet": ["beef", "chicken", "fish", "vegetarian", "vegan"],
    "energy": ["electricity", "gas"],
    "shopping": ["clothes", "electronics", "groceries"],
}

KNOWN_INGREDIENTS = list(INGREDIENT_FACTORS_PER_KG.keys())

CLASSIFY_PROMPT = f"""You classify a short activity description into a fixed
schema. Valid categories and modes are exactly:
{json.dumps(VALID_MODES)}

Respond with ONLY a JSON object, no other text, no markdown formatting:
{{"category": "...", "mode": "...", "quantity": <number>}}

quantity meaning by category: transport=km, diet=kg of food, energy=kWh, shopping=item count.
If you truly cannot classify it, respond with: {{"category": null}}
"""

BREAKDOWN_PROMPT = f"""You decompose a food description into individual
ingredients, estimating realistic gram quantities for a single serving.

You may ONLY use these known ingredient names (nothing else):
{json.dumps(KNOWN_INGREDIENTS)}

Map common foods to the closest match (e.g. "lettuce" or "spinach" -> "vegetables",
"wheat bread" -> "bread"). Skip ingredients with no close match rather than guessing.

If you can confidently estimate quantities, respond with ONLY this JSON,
no other text:
{{"components": [{{"ingredient": "bread", "grams": 80}}, {{"ingredient": "cheese", "grams": 30}}]}}

If the description is too vague to estimate quantities confidently
(e.g. missing key details like portion size or main ingredient), respond
with ONLY this JSON instead:
{{"needs_clarification": true, "question": "<one short, specific question>"}}
"""


class AIFallbackError(Exception):
    pass


def _call_gemini(prompt_text: str, user_text: str) -> str:
    """Shared low-level call to Gemini. Raises on any failure."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise AIFallbackError("AI fallback unavailable: no API key configured")

    from google import genai
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=user_text,
        config={"system_instruction": prompt_text},
    )
    raw = response.text.strip()
    return raw.replace("```json", "").replace("```", "").strip()


def classify_with_ai(text: str):
    """Tier-2 fallback for simple, single-category activities."""
    try:
        raw = _call_gemini(CLASSIFY_PROMPT, text)
        parsed = json.loads(raw)
    except AIFallbackError:
        raise
    except Exception as e:
        raise AIFallbackError(f"AI classification failed: {e}")

    category = parsed.get("category")
    mode = parsed.get("mode")
    quantity = parsed.get("quantity")

    if category not in VALID_MODES or mode not in VALID_MODES.get(category, []):
        raise AIFallbackError(f"AI returned an activity outside Flora's known categories: '{text}'")

    return {
        "category": category,
        "mode": mode,
        "quantity": float(quantity) if quantity else 1.0,
        "raw_input": text,
        "source": "ai_fallback",
    }


RECEIPT_PROMPT = f"""You extract purchasable items from raw receipt text
(grocery or shopping receipts). For each FOOD item, estimate its weight
in grams using typical packaging/serving sizes if not stated.

You may ONLY use these known ingredient names for food items:
{json.dumps(KNOWN_INGREDIENTS)}

Map common product names to the closest match (e.g. "Chicken Breast 500g"
-> "chicken" with grams=500, "Beef Mince 1kg" -> "beef" with grams=1000,
"Oat Milk 1L" -> skip, no close ingredient match).

Ignore non-food items, prices, taxes, and store information entirely.

Respond with ONLY this JSON, no other text, no markdown formatting:
{{"items": [{{"ingredient": "chicken", "grams": 500}}, {{"ingredient": "beef", "grams": 1000}}]}}

If no recognizable food items are found, respond with:
{{"items": []}}
"""


def parse_receipt_with_ai(raw_text: str):
    """
    Extracts food line-items from raw receipt text and scores each one
    with our own sourced ingredient emission factors. This is the ONLY
    AI usage for receipts -- it does text extraction only; all CO2 math
    happens afterward via calculate_ingredient_co2(), same as everywhere
    else in Flora.
    """
    if not raw_text or not raw_text.strip():
        raise AIFallbackError("Receipt text is empty")

    try:
        raw = _call_gemini(RECEIPT_PROMPT, raw_text)
        parsed = json.loads(raw)
    except AIFallbackError:
        raise
    except Exception as e:
        raise AIFallbackError(f"Receipt parsing failed: {e}")

    items_raw = parsed.get("items", [])
    if not items_raw:
        raise AIFallbackError("No recognizable food items found in this receipt")

    from carbon_math import calculate_ingredient_co2, UnknownIngredientError

    items = []
    total_co2 = 0.0
    for item in items_raw:
        ingredient = item.get("ingredient", "").lower().strip()
        grams = item.get("grams", 0)
        try:
            co2 = calculate_ingredient_co2(ingredient, grams)
        except (UnknownIngredientError, ValueError):
            continue
        items.append({"ingredient": ingredient, "grams": grams, "co2_kg": co2})
        total_co2 += co2

    if not items:
        raise AIFallbackError("Receipt items could not be matched to known ingredients")

    return {
        "items": items,
        "total_co2_kg": round(total_co2, 3),
        "source": "ai_receipt_scan",
    }


def breakdown_with_ai(text: str, clarification: str | None = None):
    """
    Decomposes a compound food description into ingredient components.

    If `clarification` is provided, it's appended to the original text as
    extra context from a follow-up answer (e.g. user answered "2 slices
    of cheese" to a prior clarifying question).

    Returns one of:
      {"needs_clarification": True, "question": "..."}
      {"components": [{"ingredient": "...", "grams": ..., "co2_kg": ...}, ...],
       "total_co2_kg": ..., "source": "ai_breakdown"}
    """
    user_text = text if not clarification else f"{text}. Additional detail: {clarification}"

    try:
        raw = _call_gemini(BREAKDOWN_PROMPT, user_text)
        parsed = json.loads(raw)
    except AIFallbackError:
        raise
    except Exception as e:
        raise AIFallbackError(f"AI breakdown failed: {e}")

    if parsed.get("needs_clarification"):
        question = parsed.get("question", "Can you give a bit more detail?")
        return {"needs_clarification": True, "question": question}

    components_raw = parsed.get("components", [])
    if not components_raw:
        raise AIFallbackError(f"AI could not identify any known ingredients in: '{text}'")

    from carbon_math import calculate_ingredient_co2, UnknownIngredientError

    components = []
    total_co2 = 0.0
    for c in components_raw:
        ingredient = c.get("ingredient", "").lower().strip()
        grams = c.get("grams", 0)
        try:
            co2 = calculate_ingredient_co2(ingredient, grams)
        except (UnknownIngredientError, ValueError):
            continue  # skip anything the AI hallucinated outside our known table
        components.append({"ingredient": ingredient, "grams": grams, "co2_kg": co2})
        total_co2 += co2

    if not components:
        raise AIFallbackError(f"AI could not map '{text}' to any known ingredients")

    return {
        "components": components,
        "total_co2_kg": round(total_co2, 3),
        "raw_input": text,
        "source": "ai_breakdown",
    }

def generate_weather_narrative(weather: dict, equivalents: dict) -> str:
    """
    AI writes one warm sentence using pre-computed, sourced equivalents.
    It never invents numbers — only picks which fact to highlight and phrases it.
    """
    prompt = f"""You are Flora, a friendly carbon footprint coach.

The user's carbon climate today: {weather['label']}
Total CO2 today: {equivalents['co2_kg']} kg
Equivalent to driving {equivalents['equivalent_km_driven']} km in an average car.
Equivalent to {equivalents['equivalent_tree_years']} tree-years of CO2 absorption.
This is {equivalents['pct_of_global_daily_average']}% of the global daily average ({equivalents['global_average_daily_kg']} kg/day).

Write ONE sentence (max 35 words) that:
- Names the weather label
- Uses exactly ONE sourced comparison above (pick the most relatable for this number)
- Ends with a brief, specific swap suggestion

Only use the numbers provided. Return the sentence only, no quotes."""

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text.strip().strip('"').strip("'")
    except Exception:
        return (
            f"Your carbon climate is {weather['label'].lower()} at "
            f"{equivalents['co2_kg']} kg CO₂ — equivalent to driving "
            f"{equivalents['equivalent_km_driven']} km. Small swaps add up."
        )
    
def generate_insight_summary(daily_totals: dict, category_breakdown: dict, peer_percentile):
    """
    Writes a short, natural-language weekly summary from numbers we have
    ALREADY computed deterministically (daily_totals, category_breakdown,
    peer_percentile all come from pure SQL aggregation in main.py). The AI
    here only chooses wording -- it never calculates anything and never
    sees raw activity logs, keeping the "AI doesn't touch the math"
    boundary intact even for this feature.

    Returns a plain string. Falls back to a simple templated sentence if
    no API key is configured, so Insights still shows something useful
    even without AI access.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    top_category = max(category_breakdown, key=category_breakdown.get) if category_breakdown else None

    if not api_key:
        if top_category:
            return (
                f"Your biggest source of emissions this week was {top_category} "
                f"({category_breakdown[top_category]}% of your total). "
                f"Keep logging to see more detailed trends."
            )
        return "Log a few activities this week to see your personalized summary here."

    facts = {
        "daily_totals_kg": daily_totals,
        "category_breakdown_pct": category_breakdown,
        "peer_percentile_lower_than": peer_percentile,
    }

    prompt = f"""You write a short (2-3 sentence), encouraging weekly carbon
footprint summary for a user, based ONLY on these pre-computed facts -- do
not invent numbers, do not calculate anything new, just describe what the
numbers already show in plain, warm language:

{json.dumps(facts)}

If peer_percentile_lower_than is null, don't mention peer comparison.
Respond with ONLY the summary text, no JSON, no markdown."""

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=prompt,
        )
        return response.text.strip()
    except Exception:
        if top_category:
            return (
                f"Your biggest source of emissions this week was {top_category} "
                f"({category_breakdown[top_category]}% of your total)."
            )
        return "Log a few activities this week to see your personalized summary here."
    
def extract_text_from_image_with_ai(image_b64: str, mime_type: str) -> str:
    """
    Sends a receipt image to Gemini vision and extracts raw text from it.
    The returned text is then passed to parse_receipt_with_ai() for CO2 scoring.
    """
    import base64
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise AIFallbackError("AI fallback unavailable: no API key configured")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    # Decode base64 back to raw bytes for Gemini
    image_bytes = base64.b64decode(image_b64)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type,
            ),
            "Extract all food items and their quantities from this receipt. List each item on a new line with quantity if visible.",
        ],
    )
    return response.text.strip()