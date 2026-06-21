// THRESHOLDS stay on the frontend — they're pure UI mapping (kg → emoji/label).
// The backend sends raw kg; we map to icons here so the display logic
// is co-located with the components that use it.
const THRESHOLDS = [
  { max: 1,   icon: '☀️', mood: 'Clear',        color: '#F0C84A', desc: 'Exceptional — fully in the green' },
  { max: 3,   icon: '⛅', mood: 'Partly Cloudy', color: '#91A56E', desc: 'Mild — small swaps would help'    },
  { max: 6,   icon: '🌧', mood: 'Rainy',         color: '#6B8CAE', desc: 'Above average — check your top category' },
  { max: 999, icon: '⛈', mood: 'Storm',          color: '#7A5A4A', desc: 'Heavy impact — time to act'      },
]

function getWeather(kg) {
  return THRESHOLDS.find(t => kg <= t.max)
}

export default function Weather({ weather }) {
  // weather prop comes from /weather API — real DB data
  // Guard: show nothing while data is loading
  console.log('weather prop:', weather)   
  if (!weather) return null

  const todayKg  = weather.total_co2_kg ?? 0
  const wx       = getWeather(todayKg || 0)
  const forecast = weather.seven_day_forecast ?? []
  const eq       = weather.climate_equivalents ?? {}
  const narrative = weather.narrative ?? `Your carbon climate today is ${wx?.mood?.toLowerCase()}.`

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: 'url("weather-bg.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      margin: '-32px -36px',
      padding: '32px 36px',
      position: 'relative',
    }}>

      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(232, 228, 218, 0.44)',
        zIndex: 0, pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Page title */}
        <div style={{
          display: 'inline-block',
          background: 'rgba(255,255,255,0)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '12px',
          padding: '6px 14px',
          marginBottom: '12px',
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: '#2A2A26', marginBottom: '3px' }}>Carbon Weather</p>
          <p style={{ fontSize: '12px', color: '#070707', marginBottom: '22px' }}>Your footprint as a forecast, not just a number</p>
        </div>

        {/* HERO */}
        <div style={{ borderRadius: '22px', overflow: 'hidden', position: 'relative', height: '185px', marginBottom: '18px' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 700 185" preserveAspectRatio="xMidYMid slice">
            <rect width="700" height="185" fill="#606E52"/>
            <ellipse cx="520" cy="185" rx="210" ry="65" fill="#4A5E3A" opacity=".5"/>
            <path d="M410 185 Q450 120 485 96 Q520 120 550 185" fill="#4A5E3A" opacity=".4"/>
            <circle cx="485" cy="89" r="28" fill="#4A5E3A" opacity=".38"/>
            <circle cx="90" cy="52" r="42" fill="#fff" opacity=".07"/>
            <circle cx="128" cy="45" r="28" fill="#fff" opacity=".065"/>
            <circle cx="160" cy="52" r="23" fill="#fff" opacity=".065"/>
            <circle cx="565" cy="35" r="17" fill="#FFDC80" opacity=".55"/>
            <circle cx="565" cy="35" r="11" fill="#FFEC90" opacity=".7"/>
          </svg>
          <div style={{ position: 'relative', zIndex: 2, padding: '26px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '10px', color: '#C0CCA4', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Today's carbon climate</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '34px', color: '#fff', marginTop: '3px' }}>{wx.icon} {wx.mood}</p>
              <p style={{ fontSize: '12px', color: '#D4E4B8', marginTop: '3px' }}>{todayKg} kg CO₂ · {wx.desc}</p>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,.14)', borderRadius: '20px', padding: '5px 12px', fontSize: '11px', color: '#fff', border: '1px solid rgba(255,255,255,.18)' }}>
              🌡 Tomorrow's forecast depends on your lunch
            </div>
          </div>
        </div>

        {/* NARRATIVE — AI generated, sourced facts */}
        <div style={{ background: '#fff', borderRadius: '18px', border: '1.5px solid #EDE8DF', padding: '18px', marginBottom: '16px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#2A2A26', lineHeight: '1.5', fontStyle: 'italic', marginBottom: '7px' }}>
            "{narrative}"
          </p>
          <p style={{ fontSize: '11px', color: '#9B9488' }}>Flora AI forecast · updates when you log</p>
        </div>

        {/* CLIMATE IMPACT — EPA-sourced equivalents, educational */}
        {todayKg > 0 && (
          <>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#050404', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '11px' }}>Your climate impact today</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>

              <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #EDE8DF', padding: '14px 16px' }}>
                <p style={{ fontSize: '20px', marginBottom: '5px' }}>🚗</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#606E52' }}>{eq.equivalent_km_driven ?? '—'} km</p>
                <p style={{ fontSize: '11px', color: '#9B9488', marginTop: '2px', lineHeight: 1.4 }}>driven in an average car</p>
                <p style={{ fontSize: '9px', color: '#C0CCA4', marginTop: '5px' }}>Source: EPA GHG Equivalencies (0.251 kg/km)</p>
              </div>

              <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #EDE8DF', padding: '14px 16px' }}>
                <p style={{ fontSize: '20px', marginBottom: '5px' }}>🌳</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#606E52' }}>{eq.equivalent_tree_years ?? '—'}</p>
                <p style={{ fontSize: '11px', color: '#9B9488', marginTop: '2px', lineHeight: 1.4 }}>tree-years to absorb this</p>
                <p style={{ fontSize: '9px', color: '#C0CCA4', marginTop: '5px' }}>Source: EPA (21.77 kg CO₂/tree/year)</p>
              </div>

              <div style={{ background: todayKg > (eq.global_average_daily_kg ?? 18.08) ? '#FDF5EC' : '#F0F5EA', borderRadius: '16px', border: `1.5px solid ${todayKg > (eq.global_average_daily_kg ?? 18.08) ? '#E8C99B' : '#C0CCA4'}`, padding: '14px 16px', gridColumn: 'span 2' }}>
                <p style={{ fontSize: '20px', marginBottom: '5px' }}>🌍</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: todayKg > (eq.global_average_daily_kg ?? 18.08) ? '#8a5a1f' : '#606E52' }}>
                  {eq.pct_of_global_daily_average ?? '—'}% of the global average
                </p>
                <p style={{ fontSize: '11px', color: '#9B9488', marginTop: '2px', lineHeight: 1.4 }}>
                  Global daily average is {eq.global_average_daily_kg ?? 18.08} kg CO₂/person
                  {todayKg <= (eq.global_average_daily_kg ?? 18.08)
                    ? ' — you\'re below average today 🎉'
                    : ' — try swapping one activity tomorrow'}
                </p>
                <p style={{ fontSize: '9px', color: '#C0CCA4', marginTop: '5px' }}>Source: Center for Sustainable Systems, UMich (6.6t CO₂e/year ÷ 365)</p>
              </div>

            </div>
          </>
        )}

        {/* 7-DAY FORECAST — real DB data */}
        <p style={{ fontSize: '10px', fontWeight: 600, color: '#050404', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '11px' }}>7-day forecast</p>
        <div style={{ display: 'flex', gap: '9px', marginBottom: '18px' }}>
          {forecast.map((day) => {
            const w       = getWeather(day.kg)
            const isToday = day.is_today
            return (
              <div key={day.d} style={{
                flex: 1, textAlign: 'center',
                background: isToday ? '#F0F5EA' : '#fff',
                borderRadius: '14px', padding: '12px 8px',
                border: isToday ? '1.5px solid #606E52' : '1.5px solid #EDE8DF',
              }}>
                <p style={{ fontSize: '10px', color: '#9B9488', marginBottom: '5px' }}>{day.d}</p>
                <p style={{ fontSize: '20px', marginBottom: '5px' }}>{w.icon}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: '#2A2A26' }}>{day.kg}</p>
                <p style={{ fontSize: '9px', color: '#606E52', fontWeight: 600, marginTop: '2px' }}>{w.mood}</p>
              </div>
            )
          })}
        </div>

        {/* LEGEND */}
        <p style={{ fontSize: '10px', fontWeight: 600, color: '#0b0802', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '11px' }}>What your weather means</p>
        <div style={{ background: '#fff', borderRadius: '18px', border: '1.5px solid #EDE8DF', padding: '18px' }}>
          {THRESHOLDS.map(t => (
            <div key={t.mood} style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '10px' }}>
              <span style={{ fontSize: '20px' }}>{t.icon}</span>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#2A2A26' }}>
                  {t.mood} · {t.max < 999 ? `under ${t.max} kg` : '6 kg+'}
                </p>
                <p style={{ fontSize: '11px', color: '#9B9488' }}>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}