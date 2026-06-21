export default function Insights({ entries, insights }) {

  // Real backend data — falls back gracefully if not loaded yet
  const dailyTotals = insights?.daily_totals_kg || {}
  const breakdownPct = insights?.category_breakdown_pct || {}
  const treesEquivalent = insights?.trees_equivalent ?? null
  const aiSummary = insights?.ai_summary || 'Log a few activities to see your personalized summary here.'

  const totalToday = entries
    .filter(e => e.date === new Date().toISOString().split('T')[0])
    .reduce((s, e) => s + e.co2kg, 0).toFixed(1)

  const totalWeek = (insights?.total_week_co2_kg ?? entries.reduce((s, e) => s + e.co2kg, 0)).toFixed(1)

  // Build the 7-day bar chart from REAL daily totals instead of random heights
  const today = new Date()
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const maxDay = Math.max(...last7Days.map(d => dailyTotals[d] || 0), 1)
  const barHeights = last7Days.map(d => Math.round(((dailyTotals[d] || 0) / maxDay) * 100))

  const breakdown = ['transport', 'diet', 'energy', 'shopping'].map(cat => ({
    cat,
    pct: breakdownPct[cat] || 0,
  }))

  const ICONS = { transport: '🚗', diet: '🥩', energy: '⚡', shopping: '🛍' }

  const dayLabels = last7Days.map(d => 'SMTWTFS'[new Date(d).getDay()])

  return (
    <div style={{
        minHeight: '100vh',
        backgroundImage: 'url("insights.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        margin: '-32px -36px',
        padding: '32px 36px',
        position: 'relative',
    }}>

    <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(232, 228, 218, 0.21)',
        zIndex: 0,
        pointerEvents: 'none',
    }}/>

    <div style={{ position: 'relative', zIndex: 1 }}>
      <p style={{ fontFamily:'var(--font-display)', fontSize:'26px', color:'#2A2A26', marginBottom:'3px' }}>Insights</p>
      <p style={{ fontSize:'12px', color:'#9B9488', marginBottom:'22px' }}>Your patterns, AI analysis, and ranked actions</p>

      {/* STAT CARDS — real numbers from the backend. Third card shows a
          relatable "trees equivalent" instead of peer comparison, since
          peer data needs multiple real users to be meaningful. */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'13px', marginBottom:'18px' }}>
        {[
          { n: totalToday, l: 'kg CO₂ today' },
          { n: totalWeek,  l: 'kg this week' },
          {
            n: treesEquivalent != null ? `🌳 ${treesEquivalent}` : '—',
            l: 'trees\' worth of CO₂',
            green: true,
          },
        ].map((s,i) => (
          <div key={i} style={{ background:'#fff', borderRadius:'18px', border:'1.5px solid #EDE8DF', padding:'18px', textAlign:'center' }}>
            <p style={{ fontFamily:'var(--font-display)', fontSize: '30px', color: s.green ? '#91A56E' : '#606E52' }}>{s.n}</p>
            <p style={{ fontSize:'11px', color:'#9B9488', marginTop:'2px' }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* CHART + BREAKDOWN */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'13px', marginBottom:'18px' }}>

        {/* Bar chart — real daily totals. Empty days are shown as a
            faint baseline dash rather than an invisible 3% sliver, so
            sparse history (e.g. only 1 day logged) still reads clearly
            as a chart instead of looking broken. Uses explicit pixel
            heights (not nested flex percentages, which don't reliably
            fill their container in all browsers) for a predictable
            visual result. */}
        <div style={{ background:'#fff', borderRadius:'18px', border:'1.5px solid #EDE8DF', padding:'18px' }}>
          <p style={{ fontSize:'10px', fontWeight:600, color:'#9B9488', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'12px' }}>This week</p>
          <div style={{ display:'flex', alignItems:'flex-end', gap:'5px', height:'80px', marginBottom:'6px', borderBottom: '1px solid #EDE8DF' }}>
            {barHeights.map((h,i) => {
              const hasData = (dailyTotals[last7Days[i]] || 0) > 0
              const pixelHeight = hasData ? Math.max(Math.round((h / 100) * 80), 4) : 2
              return (
                <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:'80px' }}>
                  <div style={{
                    width:'100%',
                    height: `${pixelHeight}px`,
                    borderRadius: hasData ? '5px 5px 0px 0px' : '0',
                    background: hasData ? (h === 100 ? '#606E52' : '#C0CCA4') : '#EDE8DF',
                  }}/>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {dayLabels.map((label, i) => (
              <p key={i} style={{ flex: 1, textAlign: 'center', fontSize:'10px', color:'#9B9488', margin: 0 }}>
                {label}
              </p>
            ))}
          </div>
        </div>

        {/* Breakdown — real category percentages */}
        <div style={{ background:'#fff', borderRadius:'18px', border:'1.5px solid #EDE8DF', padding:'18px' }}>
          <p style={{ fontSize:'10px', fontWeight:600, color:'#9B9488', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'12px' }}>Breakdown</p>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {breakdown.map(b => (
              <div key={b.cat}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'3px' }}>
                  <span>{ICONS[b.cat]} {b.cat}</span>
                  <span style={{ color:'#606E52', fontWeight:600 }}>{b.pct}%</span>
                </div>
                <div style={{ height:'7px', background:'#EDE8DF', borderRadius:'7px' }}>
                  <div style={{ height:'7px', width:`${b.pct}%`, background:'#606E52', borderRadius:'7px' }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI SUMMARY — real text from the backend (Gemini-written, or a
          graceful templated fallback if no AI key is configured) */}
      <div style={{ background:'linear-gradient(135deg,#606E52,#4A5E3A)', borderRadius:'18px', padding:'20px', marginBottom:'14px' }}>
        <p style={{ fontSize:'10px', color:'#C0CCA4', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'7px' }}>✦ Flora AI · Weekly summary</p>
        <p style={{ fontSize:'13px', color:'#E8F0DC', lineHeight:'1.6' }}>
          {aiSummary}
        </p>
      </div>
    </div>
    </div>
  )
}