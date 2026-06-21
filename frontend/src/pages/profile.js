import { useState, useEffect } from 'react'
import { updateProfile } from '../api'

const BADGE_META = {
  first_log:         { icon: '🌱', name: 'First Log',       desc: 'Log your first entry' },
  seven_day_streak:  { icon: '🔥', name: '7-Day Streak',    desc: 'Log 7 days in a row' },
  thirty_day_streak: { icon: '🏆', name: '30-Day Streak',   desc: 'Log 30 days in a row' },
  hundred_kg_saved:  { icon: '🌍', name: '100 kg Saved',    desc: 'Save 100 kg total' },
  ten_logs:          { icon: '📋', name: '10 Activities',   desc: '10 activities logged' },
  transit_swap:      { icon: '🚌', name: 'Transit Swap',    desc: 'Swap a car trip for transit' },
  plant_day:         { icon: '🥗', name: 'Plant Day',       desc: 'Go fully plant-based for a day' },
  flight_free:       { icon: '✈️', name: 'Flight-Free',     desc: 'No flights logged in 30 days' },
}

const LIFESTYLE_OPTIONS = {
  transport: ['Car', 'Bus', 'Train', 'Cycling', 'Walking', 'Motorbike', 'Electric car'],
  diet:      ['Vegan', 'Vegetarian', 'Flexitarian', 'Omnivore', 'Meat-heavy'],
  heating:   ['Gas', 'Electric', 'Heat pump', 'Oil', 'District heating', 'Solar'],
  energy:    ['100% Renewable', 'Mixed grid', 'Coal-heavy', 'Solar panels at home'],
  shopping:  ['Minimal — buy only what I need', 'Moderate', 'Heavy — frequent buyer'],
  flights:   ['None this year', '1–2 short haul', '3–5 flights', '6+ flights', 'Long haul regularly'],
  home:      ['Apartment', 'Small house', 'Large house', 'Shared housing'],
  household: ['1 person', '2 people', '3–4 people', '5+ people'],
}

// EPA / UMich sourced: 6.6 tonnes CO₂e/year ÷ 365 = 18.08 kg/day global average
const GLOBAL_DAILY_AVG_KG = 18.08

export default function Profile({ entries, profile }) {
  const [lifestyle, setLifestyle] = useState({
    transport: 'Car',
    diet:      'Omnivore',
    heating:   'Gas',
    energy:    'Mixed grid',
    shopping:  'Moderate',
    flights:   '1–2 short haul',
    home:      'Apartment',
    household: '2 people',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    if (profile) {
      setLifestyle({
        transport: profile.primary_transport || 'Car',
        diet:      profile.diet_pattern      || 'Omnivore',
        heating:   profile.heating_type      || 'Gas',
        energy:    profile.energy_provider   || 'Mixed grid',
        shopping:  profile.shopping_habits   || 'Moderate',
        flights:   profile.flights_per_year  || '1–2 short haul',
        home:      profile.home_type         || 'Apartment',
        household: profile.household_size    || '2 people',
      })
    }
  }, [profile])

  async function handleLifestyleChange(key, value) {
    const updated = { ...lifestyle, [key]: value }
    setLifestyle(updated)
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile({
        primary_transport: updated.transport,
        diet_pattern:      updated.diet,
        heating_type:      updated.heating,
        energy_provider:   updated.energy,
        shopping_habits:   updated.shopping,
        flights_per_year:  updated.flights,
        home_type:         updated.home,
        household_size:    updated.household,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error('Profile update failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const displayName   = profile?.display_name        || 'You'
  const streak        = profile?.current_streak_days || 0
  const totalLogged   = profile?.total_activities_logged || 0
  const weekTotal     = parseFloat(entries.reduce((s, e) => s + e.co2kg, 0).toFixed(1))

  // Global average comparison — core educational metric
  // 18.08 kg/day × 7 = 126.56 kg/week global average
  const weeklyGlobalAvg  = parseFloat((GLOBAL_DAILY_AVG_KG * 7).toFixed(1))
  const pctOfAvg         = weeklyGlobalAvg > 0
    ? parseFloat(((weekTotal / weeklyGlobalAvg) * 100).toFixed(0))
    : 0
  const belowAverage     = weekTotal < weeklyGlobalAvg
  const pctBelow         = belowAverage ? (100 - pctOfAvg) : null

  // Comparison label for hero chip
  const avgChip = belowAverage
    ? `✓ ${pctBelow}% below global avg`
    : `${pctOfAvg}% of global avg`

  // Impact card 4: trees needed to absorb this week's emissions (EPA: 21.77 kg/tree/year)
  const treesNeeded = (weekTotal / 21.77).toFixed(1)

  const earnedIds = new Set((profile?.badges || []).filter(b => b.earned).map(b => b.id))
  const allBadges = Object.entries(BADGE_META).map(([id, meta]) => ({
    id, ...meta, earned: earnedIds.has(id),
  }))

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: 'url("profile-bg.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      margin: '-32px -36px',
      padding: '32px 36px',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(232, 228, 218, 0.21)',
        zIndex: 0, pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: '#1a1814', marginBottom: '3px' }}>Profile</p>
        <p style={{ fontSize: '12px', color: '#252422', marginBottom: '22px' }}>Your streak, badges and lifestyle settings</p>

        {/* HERO */}
        <div style={{ background: 'linear-gradient(135deg,#606E52,#4A5E3A)', borderRadius: '20px', padding: '22px', display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '18px', position: 'relative', overflow: 'hidden' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.13 }} viewBox="0 0 500 110" preserveAspectRatio="xMidYMid slice">
            <path d="M380 110 Q408 65 435 48 Q462 65 485 110" fill="#fff"/>
            <circle cx="435" cy="42" r="20" fill="#fff"/>
          </svg>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#C0CCA4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', border: '3px solid rgba(255,255,255,0.25)', flexShrink: 0, zIndex: 1 }}>🌱</div>
          <div style={{ zIndex: 1 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#fff' }}>{displayName}</p>
            <p style={{ fontSize: '12px', color: '#C0CCA4', marginTop: '3px' }}>🔥 {streak}-day streak · {totalLogged} activities logged</p>
            <div style={{ display: 'flex', gap: '7px', marginTop: '8px', flexWrap: 'wrap' }}>
              {[
                `🌍 ${weekTotal} kg this week`,
                avgChip,
              ].map(t => (
                <span key={t} style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '20px', padding: '4px 11px', fontSize: '11px', color: '#C0CCA4' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* BADGES */}
        <p style={{ fontSize: '10px', fontWeight: 600, color: '#1a1814', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '11px' }}>Badges</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '18px' }}>
          {allBadges.map(b => (
            <div key={b.id} title={b.desc} style={{
              background:    b.earned ? '#F0F5EA' : '#fff',
              borderRadius:  '14px',
              padding:       '13px 8px',
              textAlign:     'center',
              border:        b.earned ? '1.5px solid #C0CCA4' : '1.5px solid #EDE8DF',
              opacity:       b.earned ? 1 : 0.4,
            }}>
              <p style={{ fontSize: '24px', marginBottom: '5px' }}>{b.icon}</p>
              <p style={{ fontSize: '10px', color: '#606E52', fontWeight: 600, lineHeight: 1.3 }}>{b.name}</p>
            </div>
          ))}
        </div>

        {/* LIFESTYLE */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '11px' }}>
          <p style={{ fontSize: '10px', fontWeight: 600, color: '#1a1814', letterSpacing: '1px', textTransform: 'uppercase' }}>Lifestyle profile</p>
          {saving && <p style={{ fontSize: '11px', color: '#9B9488' }}>Saving...</p>}
          {saved  && <p style={{ fontSize: '11px', color: '#606E52', fontWeight: 600 }}>✓ Saved</p>}
        </div>
        <div style={{ background: '#fff', borderRadius: '18px', border: '1.5px solid #EDE8DF', padding: '18px', marginBottom: '18px' }}>
          {[
            { key: 'transport', label: '🚗 Primary transport', opts: LIFESTYLE_OPTIONS.transport },
            { key: 'diet',      label: '🥩 Diet type',         opts: LIFESTYLE_OPTIONS.diet      },
            { key: 'heating',   label: '🔥 Home heating',      opts: LIFESTYLE_OPTIONS.heating   },
            { key: 'energy',    label: '⚡ Energy provider',   opts: LIFESTYLE_OPTIONS.energy    },
            { key: 'shopping',  label: '🛍 Shopping habits',   opts: LIFESTYLE_OPTIONS.shopping  },
            { key: 'flights',   label: '✈️ Flights per year',  opts: LIFESTYLE_OPTIONS.flights   },
            { key: 'home',      label: '🏠 Home type',         opts: LIFESTYLE_OPTIONS.home      },
            { key: 'household', label: '👥 Household size',    opts: LIFESTYLE_OPTIONS.household },
          ].map((row, i, arr) => (
            <div key={row.key} style={{
              display:       'flex',
              alignItems:    'center',
              justifyContent:'space-between',
              padding:       '13px 0',
              borderBottom:  i < arr.length - 1 ? '1px solid #EDE8DF' : 'none',
            }}>
              <span style={{ fontSize: '13px', color: '#2A2A26', fontWeight: 500 }}>{row.label}</span>
              <select
                value={lifestyle[row.key] || row.opts[0]}
                onChange={e => handleLifestyleChange(row.key, e.target.value)}
                style={{ fontSize: '12px', color: '#606E52', fontWeight: 600, background: '#E2EDD3', padding: '4px 10px', borderRadius: '20px', border: 'none', fontFamily: 'var(--font-body)', cursor: 'pointer', outline: 'none', maxWidth: '200px' }}
              >
                {row.opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* IMPACT STATS */}
        <p style={{ fontSize: '10px', fontWeight: 600, color: '#1a1814', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '11px' }}>Your impact</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

          {/* Card 1 — weekly emissions */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #EDE8DF', padding: '16px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#606E52' }}>{weekTotal}</p>
            <p style={{ fontSize: '11px', color: '#9B9488', marginTop: '2px' }}>kg CO₂ this week</p>
          </div>

          {/* Card 2 — activities logged */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #EDE8DF', padding: '16px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#606E52' }}>{totalLogged}</p>
            <p style={{ fontSize: '11px', color: '#9B9488', marginTop: '2px' }}>activities logged</p>
          </div>

          {/* Card 3 — streak */}
          <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #EDE8DF', padding: '16px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#606E52' }}>{streak}</p>
            <p style={{ fontSize: '11px', color: '#9B9488', marginTop: '2px' }}>day streak 🔥</p>
          </div>

          {/* Card 4 — vs global average (positive framing) */}
          <div style={{
            background:   belowAverage ? '#F0F5EA' : '#fff',
            borderRadius: '16px',
            border:       `1.5px solid ${belowAverage ? '#C0CCA4' : '#EDE8DF'}`,
            padding:      '16px',
            textAlign:    'center',
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: belowAverage ? '#4A5E3A' : '#606E52' }}>
              {belowAverage ? `−${pctBelow}%` : `+${pctOfAvg - 100}%`}
            </p>
            <p style={{ fontSize: '11px', color: '#9B9488', marginTop: '2px' }}>
              {belowAverage ? 'below global average 🎉' : 'above global average'}
            </p>
          </div>

        </div>

        {/* Global average footnote */}
        <p style={{ fontSize: '10px', color: '#000000', marginTop: '10px', textAlign: 'right' }}>
          Global avg: {weeklyGlobalAvg} kg/week · Source: UMich / EPA (18.08 kg/day)
        </p>

        {/* Trees equivalent */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #EDE8DF', padding: '16px', textAlign: 'center', marginTop: '12px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#606E52' }}>🌳 {treesNeeded}</p>
          <p style={{ fontSize: '11px', color: '#9B9488', marginTop: '2px' }}>tree-years to absorb this week's emissions</p>
          <p style={{ fontSize: '10px', color: '#C0CCA4', marginTop: '4px' }}>Source: EPA (21.77 kg CO₂ absorbed per tree per year)</p>
        </div>

      </div>
    </div>
  )
}