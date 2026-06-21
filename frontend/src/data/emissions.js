// IPCC / EPA emission factors (kg CO₂ per unit)
export const FACTORS = {
  transport: {
    car:     { perKm: 0.21,  label: 'Car',          unit: 'km' },
    bus:     { perKm: 0.089, label: 'Bus',           unit: 'km' },
    train:   { perKm: 0.041, label: 'Train',         unit: 'km' },
    flight:  { perKm: 0.255, label: 'Flight',        unit: 'km' },
    walking: { perKm: 0,     label: 'Walk / Cycle',  unit: 'km' },
  },
  diet: {
    beef:      { perKg: 27.0, label: 'Beef',        unit: 'kg' },
    chicken:   { perKg: 6.9,  label: 'Chicken',     unit: 'kg' },
    fish:      { perKg: 5.4,  label: 'Fish',        unit: 'kg' },
    vegetarian:{ perKg: 2.0,  label: 'Vegetarian',  unit: 'kg' },
    vegan:     { perKg: 1.5,  label: 'Vegan',       unit: 'kg' },
  },
  energy: {
    electricity: { perKwh: 0.233, label: 'Electricity', unit: 'kWh' },
    gas:         { perKwh: 0.203, label: 'Gas',          unit: 'kWh' },
  },
  shopping: {
    clothes:     { perItem: 10.0, label: 'Clothing item', unit: 'items' },
    electronics: { perItem: 70.0, label: 'Electronics',   unit: 'items' },
    groceries:   { perItem: 0.5,  label: 'Groceries',     unit: 'items' },
  },
}

// Helper: calculate CO₂ from an entry
export function calcCO2(category, type, value) {
  const factor = FACTORS[category]?.[type]
  if (!factor) return 0
  const multiplier = factor.perKm ?? factor.perKg ?? factor.perKwh ?? factor.perItem
  return parseFloat((value * multiplier).toFixed(2))
}