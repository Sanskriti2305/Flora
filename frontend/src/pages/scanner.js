import { useState, useRef } from 'react'
import { scanReceiptImage } from '../api'   


function getIcon(ingredient) {
  const n = ingredient.toLowerCase()
  if (n.includes('beef') || n.includes('mince')) return '🥩'
  if (n.includes('chicken')) return '🍗'
  if (n.includes('bread'))   return '🍞'
  if (n.includes('milk'))    return '🥛'
  if (n.includes('fish'))    return '🐟'
  if (n.includes('egg'))     return '🥚'
  if (n.includes('rice'))    return '🍚'
  if (n.includes('bus') || n.includes('train')) return '🚌'
  if (n.includes('veg') || n.includes('salad')) return '🥗'
  return '🛒'
}

function getBg(ingredient) {
  const n = ingredient.toLowerCase()
  if (n.includes('beef') || n.includes('mince')) return '#FDF0DC'
  if (n.includes('chicken')) return '#E8F0DC'
  if (n.includes('bread'))   return '#FDF5E4'
  if (n.includes('milk'))    return '#E8EEF8'
  if (n.includes('bus') || n.includes('train')) return '#E2EDD3'
  return '#F5F2EC'
}

export default function Scanner({ onAddEntry }) {
  const fileInputRef            = useRef(null)
  const [text, setText]         = useState('')
  const [parsed, setParsed]     = useState([])
  const [totalCo2, setTotalCo2] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')
  const [dragOver, setDragOver] = useState(false)

  function handleBackendResponse(data) {
    if (!data.items || data.items.length === 0) {
      setError('No items found. Try pasting clearer text.')
      return
    }
    const mapped = data.items.map(item => ({
      name: `${item.ingredient} (${item.grams}g)`,
      cat:  'Diet',
      icon: getIcon(item.ingredient),
      bg:   getBg(item.ingredient),
      co2:  item.co2_kg,
      good: item.co2_kg < 1,
    }))
    setParsed(mapped)
    setTotalCo2(data.total_co2_kg)
  }

  async function handleFile(file) {
    if (!file) return
    setError('')
    setLoading(true)
    setParsed([])
    setDone(false)

  try {
    const data = await scanReceiptImage(file)
    handleBackendResponse(data)
  }
  catch (err) {
      setError('Could not reach backend. Is it running on port 8000?')
    } finally {
      setLoading(false)
    }
  }

  async function handleAnalyse() {
    if (!text.trim()) return
    setError('')
    setLoading(true)
    setParsed([])
    setDone(false)

    try {
      const data = await onAddEntry(text)
      handleBackendResponse(data)
    } catch (err) {
      setError(err.message || 'Could not reach backend.')
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: 'url("/scanner-bg.jpg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      margin: '-32px -36px',
      padding: '32px 36px',
      position: 'relative',
    }}>

      {/* overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(232, 228, 218, 0.33)',
        zIndex: 0,
        pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* TITLE */}
        <div style={{
          display: 'inline-block',
          background: 'rgba(255,255,255,0)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '6px 14px',
          marginBottom: '12px',
        }}>
          <p style={{ fontFamily:'var(--font-display)', fontSize:'26px', color:'#2A2A26', marginBottom:'3px' }}>Receipt Scanner</p>
          <p style={{ fontSize:'12px', color:'#181715', marginBottom:'22px' }}>Paste or upload a receipt — AI parses every item</p>
        </div>

        {/* hidden file input — controlled by ref */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />

        {/* DROP ZONE */}
        <div
          onClick={() => fileInputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: dragOver ? '2px solid #606E52' : '2px dashed #C0CCA4',
            borderRadius: '18px',
            padding: '36px',
            textAlign: 'center',
            background: dragOver ? '#F0F5EA' : '#F5F2EC',
            marginBottom: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: '38px', marginBottom: '8px' }}>
            {loading ? '⏳' : '📄'}
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#2A2A26', marginBottom: '3px' }}>
            {loading ? 'Analysing...' : 'Click to upload or drag & drop'}
          </p>
          <p style={{ fontSize: '12px', color: '#9B9488' }}>PNG, JPG or PDF</p>
        </div>

        {/* DIVIDER */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'10px 0' }}>
          <div style={{ flex:1, height:'1px', background:'#EDE8DF' }}/>
          <span style={{ fontSize:'12px', color:'#080602' }}>or paste text</span>
          <div style={{ flex:1, height:'1px', background:'#EDE8DF' }}/>
        </div>

        {/* TEXT AREA */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={"    Paste your receipt text here..."}
          style={{ width:'100%', border:'1.5px solid #C0BAB0', borderRadius:'13px', padding:'13px', fontFamily:'var(--font-body)', fontSize:'13px', color:'#2A2A26', background:'#fff', resize:'vertical', minHeight:'90px', outline:'none' }}
        />

        <button
          onClick={handleAnalyse}
          disabled={loading}
          style={{ width:'100%', padding:'14px', background:'#606E52', color:'#fff', border:'none', borderRadius:'13px', fontSize:'14px', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', marginTop:'10px', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Analysing...' : '✦ Analyse with AI'}
        </button>

        {/* ERROR */}
        {error && (
          <p style={{ color:'#C0504A', fontSize:'12px', marginTop:'10px', textAlign:'center' }}>
            ⚠ {error}
          </p>
        )}

        {/* PARSED RESULTS */}
        {parsed.length > 0 && (
          <div style={{ marginTop:'22px' }}>
            <p style={{ fontSize:'10px', fontWeight:600, color:'#000000', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'11px' }}>Parsed items</p>

            {parsed.map((item, i) => (
              <div key={i} style={{ background:'#fff', borderRadius:'13px', padding:'12px 14px', border:'1.5px solid #EDE8DF', display:'flex', alignItems:'center', gap:'11px', marginBottom:'8px' }}>
                <div style={{ width:'36px', height:'36px', borderRadius:'9px', background:item.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'17px', flexShrink:0 }}>
                  {item.icon}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:'13px', fontWeight:600, color:'#2A2A26', marginBottom:'1px' }}>{item.name}</p>
                  <p style={{ fontSize:'10px', color:'#9B9488' }}>{item.cat}</p>
                </div>
                <p style={{ fontSize:'12px', fontWeight:600, color: item.good ? '#91A56E' : '#606E52' }}>
                  +{item.co2} kg
                </p>
              </div>
            ))}

            {/* TOTAL */}
            <div style={{
              background: 'rgba(96,110,82,0.1)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize:'13px', fontWeight:600, color:'#2A2A26' }}>Total footprint</span>
              <span style={{ fontFamily:'var(--font-display)', fontSize:'20px', color:'#000000' }}>
                {totalCo2} kg CO₂
              </span>
            </div>

            {done ? (
              <p style={{ textAlign:'center', color:'#030303', fontWeight:600, marginTop:'12px' }}>✓ Added to today's log</p>
            ) : (
              <button
                onClick={() => setDone(true)}
                style={{ width:'100%', padding:'14px', background:'#606E52', color:'#fff', border:'none', borderRadius:'13px', fontSize:'14px', fontFamily:'var(--font-body)', fontWeight:600, cursor:'pointer', marginTop:'4px' }}
              >
                + Add all to today's log
              </button>
            )}
        </div>
        )}

      </div>
    </div>
  )
}