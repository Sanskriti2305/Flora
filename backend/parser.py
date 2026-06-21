"""
parser.py — Rule-based natural language parser for Flora.

Two-tier strategy:
  1. Fast, free, deterministic keyword + regex matching (handles the
     large majority of everyday phrasing with zero cost and zero latency)
  2. Falls back to a narrowly-scoped AI call ONLY when tier 1 finds nothing
     (see ai_fallback.py) — isolated so the core engine stays auditable

Mode names and units here match carbon_math.py's EMISSION_FACTORS exactly:
transport=km, diet=kg of food, energy=kWh, shopping=item count.
"""

import re

KEYWORD_MAP = {
    # transport (km)
    "drove": ("transport", "car"), "drive": ("transport", "car"),
    "driving": ("transport", "car"), "car": ("transport", "car"),
    "uber": ("transport", "car"), "cab": ("transport", "car"),
    "taxi": ("transport", "car"),
    "bus": ("transport", "bus"), "train": ("transport", "train"),
    "metro": ("transport", "train"), "subway": ("transport", "train"),
    "flight": ("transport", "flight"), "flew": ("transport", "flight"),
    "bike": ("transport", "walking"), "cycled": ("transport", "walking"),
    "cycling": ("transport", "walking"), "walked": ("transport", "walking"),
    "walk": ("transport", "walking"), "walking": ("transport", "walking"),

    # diet (kg of food)
    "beef": ("diet", "beef"), "steak": ("diet", "beef"), "burger": ("diet", "beef"),
    "mutton": ("diet", "beef"), "lamb": ("diet", "beef"),
    "chicken": ("diet", "chicken"), "pork": ("diet", "chicken"),
    "fish": ("diet", "fish"), "salmon": ("diet", "fish"), "tuna": ("diet", "fish"),
    "vegan": ("diet", "vegan"), "tofu": ("diet", "vegan"),
    "vegetarian": ("diet", "vegetarian"), "salad": ("diet", "vegetarian"),
    "vegetable": ("diet", "vegetarian"), "vegetables": ("diet", "vegetarian"),
    "ate": ("diet", "chicken"), "lunch": ("diet", "chicken"), "dinner": ("diet", "chicken"),
    "breakfast": ("diet", "vegetarian"), "meal": ("diet", "chicken"),

    # energy (kWh)
    "electricity": ("energy", "electricity"), "ac": ("energy", "electricity"),
    "air conditioner": ("energy", "electricity"), "air conditioning": ("energy", "electricity"),
    "lights": ("energy", "electricity"),
    "gas": ("energy", "gas"), "heater": ("energy", "gas"), "heating": ("energy", "gas"),

    # shopping (item count)
    "clothes": ("shopping", "clothes"), "clothing": ("shopping", "clothes"),
    "shirt": ("shopping", "clothes"), "jeans": ("shopping", "clothes"),
    "electronics": ("shopping", "electronics"), "phone": ("shopping", "electronics"),
    "laptop": ("shopping", "electronics"), "gadget": ("shopping", "electronics"),
    "groceries": ("shopping", "groceries"), "grocery": ("shopping", "groceries"),
}

# Defaults used when no explicit quantity is found in the text.
DEFAULT_QUANTITY = {
    "transport": 5.0,    # km
    "diet": 0.3,          # kg (~ one meal's worth of the named food)
    "energy": 1.0,        # kWh
    "shopping": 1.0,      # item
}

NUMBER_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*(km|kg|kwh|kw|g|grams?|items?)?", re.IGNORECASE
)


class UnrecognizedActivityError(Exception):
    pass


def parse_activity(text: str):
    """
    Tier 1 parser. Raises UnrecognizedActivityError if nothing matches --
    the caller (main.py) is responsible for deciding whether to fall
    back to the AI classifier at that point.
    """
    lowered = text.lower()

    matched_category, matched_mode = None, None
    matched_keyword_len = 0

    for keyword, (category, mode) in KEYWORD_MAP.items():
        if keyword in lowered and len(keyword) > matched_keyword_len:
            matched_category, matched_mode = category, mode
            matched_keyword_len = len(keyword)

    if matched_category is None:
        raise UnrecognizedActivityError(f"Could not recognize any known activity in: '{text}'")

    number_match = NUMBER_PATTERN.search(lowered)
    if number_match:
        value = float(number_match.group(1))
        unit = (number_match.group(2) or "").lower()
        # Normalize grams to kg for diet, since our factors are per-kg
        if matched_category == "diet" and unit in ("g", "gram", "grams"):
            value = value / 1000
        quantity = value
    else:
        quantity = DEFAULT_QUANTITY[matched_category]

    return {
        "category": matched_category,
        "mode": matched_mode,
        "quantity": quantity,
        "raw_input": text,
        "source": "rules",
    }


if __name__ == "__main__":
    tests = [
        "drove to office, 12km", "had a beef burger, 300g", "walked to the store",
        "used AC for 2kWh", "ate a vegan meal, 0.4kg", "took the bus 8km",
        "took an uber to the airport", "bought a new phone",
        "bought groceries, 2 items",
    ]
    for t in tests:
        print(t, "->", parse_activity(t))