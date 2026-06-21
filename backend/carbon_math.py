"""
carbon_math.py — Flora's core carbon calculation engine.
Pure logic, zero framework dependencies. Fully unit-testable.
"""

from dataclasses import dataclass
from enum import Enum


class QuantityType(Enum):
    DISTANCE_KM = "distance_km"
    KG = "kg"
    KWH = "kwh"
    ITEM = "item"


@dataclass(frozen=True)
class EmissionFactor:
    category: str
    mode: str
    factor_kg_co2: float
    quantity_type: QuantityType
    source: str


EMISSION_FACTORS = {
    "transport": {
        "car": EmissionFactor("transport", "car", 0.21, QuantityType.DISTANCE_KM, "IPCC/EPA"),
        "bus": EmissionFactor("transport", "bus", 0.089, QuantityType.DISTANCE_KM, "IPCC/EPA"),
        "train": EmissionFactor("transport", "train", 0.041, QuantityType.DISTANCE_KM, "IPCC/EPA"),
        "flight": EmissionFactor("transport", "flight", 0.255, QuantityType.DISTANCE_KM, "IPCC/EPA"),
        "walking": EmissionFactor("transport", "walking", 0.0, QuantityType.DISTANCE_KM, "Zero direct emissions"),
    },
    "diet": {
        "beef": EmissionFactor("diet", "beef", 27.0, QuantityType.KG, "IPCC/EPA"),
        "chicken": EmissionFactor("diet", "chicken", 6.9, QuantityType.KG, "IPCC/EPA"),
        "fish": EmissionFactor("diet", "fish", 5.4, QuantityType.KG, "IPCC/EPA"),
        "vegetarian": EmissionFactor("diet", "vegetarian", 2.0, QuantityType.KG, "IPCC/EPA"),
        "vegan": EmissionFactor("diet", "vegan", 1.5, QuantityType.KG, "IPCC/EPA"),
    },
    "energy": {
        "electricity": EmissionFactor("energy", "electricity", 0.233, QuantityType.KWH, "IPCC/EPA"),
        "gas": EmissionFactor("energy", "gas", 0.203, QuantityType.KWH, "IPCC/EPA"),
    },
    "shopping": {
        "clothes": EmissionFactor("shopping", "clothes", 10.0, QuantityType.ITEM, "Estimated, per item"),
        "electronics": EmissionFactor("shopping", "electronics", 70.0, QuantityType.ITEM, "Estimated, per item"),
        "groceries": EmissionFactor("shopping", "groceries", 0.5, QuantityType.ITEM, "Estimated, per item"),
    },
}

# Best (lowest-emission) alternative within each category, used by the suggestion engine
BEST_ALTERNATIVE = {
    "transport": "walking",
    "diet": "vegan",
    "energy": "electricity",  # relatively lower than gas in this table
    "shopping": "groceries",  # lowest-impact shopping category
}


class UnknownEmissionModeError(Exception):
    pass


# Ingredient-level factors, in kg CO2e per kg of ingredient (per-gram math
# is done by dividing by 1000 at calculation time). Sourced from Poore &
# Nemecek (2018), the largest meta-analysis of food emissions to date,
# as compiled by Our World in Data. Used for component-level breakdowns
# of compound dishes (e.g. "veg sandwich with cheese") where a single
# whole-meal category isn't precise enough.
INGREDIENT_FACTORS_PER_KG = {
    "beef": 60.0,
    "lamb": 24.0,
    "cheese": 21.0,
    "pork": 7.0,
    "poultry": 6.0,
    "chicken": 6.0,
    "eggs": 4.5,
    "fish_farmed": 5.0,
    "rice": 4.0,
    "milk": 3.0,
    "bread": 1.4,
    "tofu": 3.0,
    "peas": 1.0,
    "lentils": 0.9,
    "vegetables": 0.4,
    "lettuce": 0.4,
    "tomato": 1.4,
    "potatoes": 0.3,
    "fruit": 0.4,
    "nuts": 0.5,
    "oats": 0.9,
}

INGREDIENT_SOURCE = "Poore & Nemecek (2018), via Our World in Data"


def get_factor(category: str, mode: str) -> EmissionFactor:
    try:
        return EMISSION_FACTORS[category][mode]
    except KeyError:
        raise UnknownEmissionModeError(
            f"No emission factor found for category='{category}', mode='{mode}'"
        )


def calculate_co2(category: str, mode: str, quantity: float) -> float:
    if quantity < 0:
        raise ValueError("quantity cannot be negative")
    factor = get_factor(category, mode)
    return round(quantity * factor.factor_kg_co2, 3)


class UnknownIngredientError(Exception):
    pass


def calculate_ingredient_co2(ingredient: str, grams: float) -> float:
    """
    Calculates CO2 for a single food component, e.g. calculate_ingredient_co2
    ("cheese", 30) -> CO2 for 30g of cheese. Used by the component-breakdown
    AI fallback to score each part of a compound dish individually.
    """
    if grams < 0:
        raise ValueError("grams cannot be negative")

    ingredient = ingredient.lower().strip()
    if ingredient not in INGREDIENT_FACTORS_PER_KG:
        raise UnknownIngredientError(f"No emission factor found for ingredient='{ingredient}'")

    factor_per_kg = INGREDIENT_FACTORS_PER_KG[ingredient]
    return round((grams / 1000) * factor_per_kg, 3)


def suggest_alternative(category: str, mode: str, quantity: float, threshold_pct: float = 0.15):
    """
    Decision engine: compares current choice to the best alternative in the
    same category. Returns None if already good enough (no swap needed),
    otherwise returns a dict describing the swap and savings.
    """
    current_co2 = calculate_co2(category, mode, quantity)
    best_mode = BEST_ALTERNATIVE.get(category)

    if best_mode is None or best_mode == mode:
        return None  # no better alternative exists, or already using it

    alt_co2 = calculate_co2(category, best_mode, quantity)
    savings = round(current_co2 - alt_co2, 3)

    if current_co2 <= 0:
        return None  # already zero-emission

    savings_pct = savings / current_co2
    if savings_pct < threshold_pct:
        return None  # not meaningfully better, praise instead

    return {
        "current_mode": mode,
        "current_co2_kg": current_co2,
        "alternative_mode": best_mode,
        "alternative_co2_kg": alt_co2,
        "savings_kg": savings,
        "savings_pct": round(savings_pct * 100, 1),
    }


# Thresholds in kg CO2 for a single day's total. These are illustrative
# bands, not a scientific standard — documented here so the reasoning is
# auditable rather than a hidden magic number.
WEATHER_BANDS = [
    (2.0, {"label": "Clear skies", "icon": "sun", "desc": "A low-impact day."}),
    (5.0, {"label": "Mild", "icon": "cloud-sun", "desc": "A moderate-impact day."}),
    (10.0, {"label": "Overcast", "icon": "cloud-rain", "desc": "A higher-impact day."}),
    (float("inf"), {"label": "Storm warning", "icon": "storm", "desc": "A high-impact day."}),
]


def get_carbon_weather(total_co2_today_kg: float) -> dict:
    """
    Maps a day's total CO2 to a weather-style forecast label.
    Pure threshold logic — no AI, no external calls. Reuses the same
    auditable, explainable design philosophy as suggest_alternative.
    """
    if total_co2_today_kg < 0:
        raise ValueError("total_co2_today_kg cannot be negative")

    for threshold, weather in WEATHER_BANDS:
        if total_co2_today_kg < threshold:
            return {**weather, "total_co2_kg": total_co2_today_kg}

    # Unreachable in practice since the last band is infinity, but keeps
    # the function's return type honest if WEATHER_BANDS is ever edited.
    return {"label": "Unknown", "icon": "question", "desc": "", "total_co2_kg": total_co2_today_kg}


# Sourced climate equivalency factors, used to translate a user's raw kg
# CO2 figure into a relatable comparison. All factors are deterministic
# arithmetic -- AI is only used downstream to PICK and PHRASE which fact
# to surface, never to invent the conversion numbers themselves.
#
# Sources:
#   - km_driving_kg_per_km: derived from EPA's 0.404 kg CO2/mile factor
#     for an average passenger vehicle (EPA Greenhouse Gas Equivalencies
#     Calculator, Calculations & References).
#   - tree_years_kg_per_tree_year: EPA's commonly cited ~21.77kg CO2
#     absorbed per tree per year (EPA GHG Equivalencies Calculator).
#   - global_average_daily_kg: derived from the global average annual
#     per-capita carbon footprint of 6.6 tonnes CO2e/year (Center for
#     Sustainable Systems, University of Michigan, 2025 Factsheet,
#     citing global average distinct from the much higher US average
#     of 17.6 tonnes/year), divided across 365 days.
CLIMATE_FACTS = {
    "km_driving_kg_per_km": 0.251,
    "tree_years_kg_per_tree_year": 21.77,
    "global_average_daily_kg": 18.08,
}


def get_climate_equivalents(co2_kg: float) -> dict:
    """
    Translates a raw kg CO2 figure into several sourced, relatable
    comparisons. Pure arithmetic -- every number here is traceable to
    a cited source in CLIMATE_FACTS above.
    """
    if co2_kg < 0:
        raise ValueError("co2_kg cannot be negative")

    return {
        "co2_kg": round(co2_kg, 2),
        "equivalent_km_driven": round(co2_kg / CLIMATE_FACTS["km_driving_kg_per_km"], 1),
        "equivalent_tree_years": round(co2_kg / CLIMATE_FACTS["tree_years_kg_per_tree_year"], 2),
        "pct_of_global_daily_average": round(
            (co2_kg / CLIMATE_FACTS["global_average_daily_kg"]) * 100, 1
        ),
        "global_average_daily_kg": CLIMATE_FACTS["global_average_daily_kg"],
    }


if __name__ == "__main__":
    print(calculate_co2("transport", "car", 12))
    print(suggest_alternative("transport", "car", 12))
    print(suggest_alternative("transport", "walking", 5))
    print(calculate_co2("diet", "beef", 0.3))   # 300g of beef
    print(calculate_co2("shopping", "electronics", 1))
    print(get_carbon_weather(1.5))
    print(get_carbon_weather(6.0))
    print(get_carbon_weather(15.0))

    # Component-level test: "veg sandwich with cheese" might decompose to:
    print(calculate_ingredient_co2("bread", 80))       # 80g bread
    print(calculate_ingredient_co2("cheese", 30))       # 30g cheese
    print(calculate_ingredient_co2("vegetables", 50))   # 50g mixed veg

    try:
        calculate_ingredient_co2("unicorn_meat", 100)
    except UnknownIngredientError as e:
        print("Handled:", e)

    print(get_climate_equivalents(11.25))