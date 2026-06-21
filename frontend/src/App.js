import { useState, useEffect, useCallback } from 'react'
import './index.css'
import Home     from './pages/home'
import Insights from './pages/insights'
import Scanner  from './pages/scanner'
import Weather  from './pages/weather'
import Profile  from './pages/profile'
import Auth     from './pages/auth'
import { checkIn, getHistory, getStats, scanReceipt, getWeather, getInsights, getProfile, previewSwap, getMe, isLoggedIn, logout } from './api'

const tabs = [
  { id: 'home',     emoji: '🌱', name: 'Log activity',   ariaLabel: 'Navigate to Log Activity page'   },
  { id: 'insights', emoji: '📊', name: 'Insights',       ariaLabel: 'Navigate to Insights page'       },
  { id: 'scanner',  emoji: '📷', name: 'Receipt scan',   ariaLabel: 'Navigate to Receipt Scanner page' },
  { id: 'weather',  emoji: '🌤', name: 'Carbon weather', ariaLabel: 'Navigate to Carbon Weather page'  },
  { id: 'profile',  emoji: '🏅', name: 'Profile',        ariaLabel: 'Navigate to Profile page'        },
]

export default function App() {
  const [activePage, setActivePage]   = useState('home')
  const [entries, setEntries]         = useState([])
  const [weather, setWeather]         = useState(null)
  const [insights, setInsights]       = useState(null)
  const [profile, setProfile]         = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [refreshKey, setRefreshKey]   = useState(0)
  const [user, setUser]               = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn()) { setAuthLoading(false); return }
    getMe()
      .then(data => setUser(data.user))
      .catch(() => {})
      .finally(() => setAuthLoading(false))
  }, [])

  const loadEntries = useCallback(async () => {
    if (!user) return
    try {
      const [history, stats, weatherData, insightsData, profileData] = await Promise.all([
        getHistory(50), getStats('week'), getWeather(), getInsights(), getProfile(),
      ])
      setEntries(history.map(h => ({
        id: h.id, date: h.timestamp.split('T')[0],
        category: h.category, activity: h.mode,
        co2kg: h.actual_co2_kg, savedCo2: h.savings_kg, swapped: h.savings_kg > 0,
      })))
      setWeather(weatherData)
      setInsights(insightsData)
      setProfile(profileData)
      setError(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [user, refreshKey])

  useEffect(() => { loadEntries() }, [loadEntries])

  async function addEntry(text, userResponse = null, overrideMode = null) {
    const result = await checkIn(text, userResponse, overrideMode)
    setRefreshKey(k => k + 1)
    return result
  }

  async function addReceiptItems(rawText) {
    const result = await scanReceipt(rawText)
    setRefreshKey(k => k + 1)
    return result
  }

  function handleLogout() { logout(); setUser(null) }

  if (authLoading) return (
    <div role="status" aria-live="polite" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#E8E4DA' }}>
      <p style={{ color:'#606E52', fontFamily:'var(--font-display)', fontSize:'24px' }}>🌿 Loading Flora...</p>
    </div>
  )

  if (!user) return <Auth onAuthSuccess={setUser} />

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <a href="#main-content" style={{
        position: 'absolute', top: '-40px', left: 0, zIndex: 999,
        background: '#606E52', color: '#fff', padding: '8px 16px',
        borderRadius: '0 0 8px 0', textDecoration: 'none', fontSize: '13px',
        transition: 'top 0.2s',
      }}
        onFocus={e => e.target.style.top = '0'}
        onBlur={e  => e.target.style.top = '-40px'}
      >
        Skip to main content
      </a>

      <aside
        role="navigation"
        aria-label="Main navigation"
        style={{ width:'220px', minHeight:'100vh', position:'fixed', top:0, left:0, display:'flex', flexDirection:'column', overflow:'hidden' }}
      >
        <div style={{ position:'absolute', inset:0, background:`url('/sidebar-bg.jpg') center/cover no-repeat, #606E52`, zIndex:0 }}/>
        <div style={{ position:'absolute', inset:0, background:'#606E52', zIndex:0 }}>
          <svg width="220" height="100%" viewBox="0 0 220 700" preserveAspectRatio="xMidYMax slice"
            style={{ position:'absolute', bottom:0, left:0 }} aria-hidden="true">
            <ellipse cx="110" cy="690" rx="120" ry="35" fill="#4A5E3A" opacity=".5"/>
            <rect x="104" y="480" width="12" height="180" rx="4" fill="#3A4A28" opacity=".6"/>
            <path d="M60 520 Q110 400 160 520" fill="#4A5A30" opacity=".55"/>
            <path d="M70 460 Q110 360 150 460" fill="#506438" opacity=".5"/>
            <path d="M80 400 Q110 310 140 400" fill="#5A7040" opacity=".45"/>
            <rect x="34" y="560" width="8" height="110" rx="3" fill="#3A4A28" opacity=".5"/>
            <path d="M10 590 Q38 510 66 590" fill="#4A5A30" opacity=".4"/>
            <rect x="178" y="570" width="8" height="100" rx="3" fill="#3A4A28" opacity=".5"/>
            <path d="M155 598 Q182 525 208 598" fill="#4A5A30" opacity=".4"/>
          </svg>
        </div>
        <div style={{ position:'absolute', inset:0, background:'rgba(60,75,40,0.72)', zIndex:1 }}/>

        <div style={{ position:'relative', zIndex:2, padding:'26px 14px', display:'flex', flexDirection:'column', height:'100%', gap:'3px' }}>
          <div role="banner" style={{ marginBottom:'26px', padding:'13px 15px', background:'rgba(255,255,255,0.13)', border:'1.5px solid rgba(255,255,255,0.22)', borderRadius:'14px' }}>
            <p style={{ fontFamily:'var(--font-display)', fontSize:'30px', color:'#fff', letterSpacing:'-0.5px', lineHeight:1 }}>Flora</p>
            <p style={{ fontSize:'9px', color:'#C0CCA4', letterSpacing:'2.5px', textTransform:'uppercase', marginTop:'3px' }}>Carbon Tracker</p>
          </div>

          {tabs.map(tab => {
            const isActive = activePage === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActivePage(tab.id)}
                aria-label={tab.ariaLabel}
                aria-current={isActive ? 'page' : undefined}
                role="menuitem"
                style={{
                  display:'flex', alignItems:'center', gap:'10px', padding:'10px 13px',
                  borderRadius:'11px', marginBottom:'3px',
                  background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                  border: isActive ? '1.5px solid rgba(255,255,255,0.25)' : '1.5px solid transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                  fontSize:'13px', fontWeight:500, fontFamily:'var(--font-body)',
                  cursor:'pointer', textAlign:'left', width:'100%', transition:'all 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background='rgba(255,255,255,0.09)'; e.currentTarget.style.color='rgba(255,255,255,0.85)' }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.55)' }}}
              >
                <span aria-hidden="true" style={{ fontSize:'16px' }}>{tab.emoji}</span>
                <span>{tab.name}</span>
              </button>
            )
          })}

          <button
            onClick={handleLogout}
            aria-label="Log out of Flora"
            style={{
              display:'flex', alignItems:'center', gap:'10px', padding:'10px 13px',
              borderRadius:'11px', marginBottom:'6px', background:'transparent', border:'none',
              color:'rgba(255,255,255,0.5)', fontSize:'13px', fontWeight:500,
              fontFamily:'var(--font-body)', cursor:'pointer', textAlign:'left', width:'100%', transition:'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,80,80,0.12)'; e.currentTarget.style.color='rgba(255,180,180,0.9)' }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(255,255,255,0.5)' }}
          >
            <span aria-hidden="true" style={{ fontSize:'16px' }}>🚪</span>
            <span>Log out</span>
          </button>

          <div aria-live="polite" aria-label="Weekly carbon footprint summary" style={{ marginTop:'auto', background:'rgba(255,255,255,0.12)', border:'1.5px solid rgba(255,255,255,0.15)', borderRadius:'12px', padding:'13px', fontSize:'11px', color:'rgba(255,255,255,0.65)', lineHeight:1.6 }}>
            <strong style={{ color:'#C0CCA4', display:'block', fontSize:'13px', marginBottom:'2px' }}>
              {entries.reduce((s, e) => s + e.co2kg, 0).toFixed(1)} kg this week
            </strong>
            logged so far 🌍
          </div>
        </div>
      </aside>

      <main id="main-content" role="main" style={{ marginLeft:'220px', flex:1, padding:'32px 36px', minHeight:'100vh' }}>
        {loading && (
          <div role="status" aria-live="polite">
            <p style={{ color:'#9B9488' }}>Loading your data...</p>
          </div>
        )}
        {error && (
          <div role="alert" aria-live="assertive" style={{ background:'#FDF0DC', border:'1px solid #E8C99B', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
            <p style={{ color:'#8a5a1f', fontSize:'13px' }}>⚠ Couldn't reach the backend: {error}</p>
          </div>
        )}
        {!loading && activePage === 'home'     && <Home     entries={entries} onAddEntry={addEntry} onPreview={previewSwap} />}
        {!loading && activePage === 'insights' && <Insights entries={entries} insights={insights} key={refreshKey} />}
        {!loading && activePage === 'scanner'  && <Scanner  onAddEntry={addReceiptItems} />}
        {!loading && activePage === 'weather'  && <Weather  entries={entries} weather={weather} key={refreshKey} />}
        {!loading && activePage === 'profile'  && <Profile  entries={entries} profile={profile} key={refreshKey} />}
      </main>
    </div>
  )
}