import { useState } from 'react'
import { FACTORS, calcCO2 } from '../data/emissions'
import EntryCard from '../components/entrycard'

// Categories for the filter pills
const CATEGORIES = ['All', 'transport', 'diet', 'energy', 'shopping']

export default function Home({ entries, onAddEntry, onPreview }) {
  // Local state — only this page needs these
  const [activeCategory, setActiveCategory] = useState('All')
  const [showForm, setShowForm] = useState(false)

  // Two-step flow state:
  //  - pendingText: what the user typed/selected, not yet logged
  //  - pendingPreview: the backend's calculated preview (cost + swap),
  //    shown so the user can decide BEFORE anything is saved
  const [pendingText, setPendingText] = useState(null)
  const [pendingPreview, setPendingPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [previewError, setPreviewError] = useState(null)

  // Form state — what the user is currently typing
  const [form, setForm] = useState({
    category: 'transport',
    type: 'car',
    value: '',
  })

  // Derived value — local instant estimate shown while typing, BEFORE
  // the real preview call. The backend's preview is the authoritative
  // number; this is just a snappy live-typing hint.
  const livePreview = form.value
    ? calcCO2(form.category, form.type, parseFloat(form.value))
    : 0

  // Total CO₂ for today
  const todayTotal = entries
    .reduce((sum, e) => sum + e.co2kg, 0)
    .toFixed(1)

  // Filter entries by active category
  const visibleEntries = activeCategory === 'All'
    ? entries
    : entries.filter(e => e.category === activeCategory)

  const CATEGORY_ICONS = { transport: '🚗', diet: '🥗', energy: '⚡', shopping: '🛍️' }

  // Step 1: ask the backend what this activity would actually cost,
  // and whether a swap is worth suggesting. Nothing is saved yet.
  async function handlePreview() {
    if (!form.value) return

    const typeLabel = FACTORS[form.category][form.type].label
    const text = `${typeLabel} ${form.value}${FACTORS[form.category][form.type].unit}`

    setSubmitting(true)
    setPreviewError(null)
    try {
      const preview = await onPreview(text)
      setPendingText(text)
      setPendingPreview(preview)
    } catch (err) {
      setPreviewError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Step 2: the user has decided. useSwap=true means they're taking the
  // suggested alternative instead of their original plan.
  async function handleConfirm(useSwap) {
    setSubmitting(true)
    try {
      const overrideMode = useSwap ? pendingPreview.alternative_mode : null
      await onAddEntry(pendingText, useSwap ? 'accepted' : 'declined', overrideMode)
      // entries refetch (triggered by App.js's refreshKey bump inside
      // onAddEntry) now drives the "Recent Activity" panel below, so we
      // don't need to track the result locally anymore.
      setPendingText(null)
      setPendingPreview(null)
      setForm({ ...form, value: '' })
      setShowForm(false)
    } catch (err) {
      console.error('Failed to log activity:', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function cancelPending() {
    setPendingText(null)
    setPendingPreview(null)
    setPreviewError(null)
  }

  return (
    <div style={{
        minHeight: '100vh',
        backgroundImage: 'url("home.png")',
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
      <div style={{
        display: 'inline-block',
        background: 'rgba(255, 255, 255, 0)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        padding: '6px 14px',
        marginBottom: '12px',
      }}>

      {/* GREETING */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '12px', color: '#12110f' }}>
          {new Date().toDateString()}
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '26px',
          color: '#060101',
        }}>
          Good morning 🌿
        </h1>
        </div>
      </div>

      {/* HERO CARD */}
      <div style={{
        background: '#606E52',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
        position: 'absolute', right: '-10px', bottom: '-10px',
        opacity: 0.18, pointerEvents: 'none',
        }}>
        <svg width="160" height="140" viewBox="0 0 160 140">
            <circle cx="80" cy="60" r="50" fill="#fff" opacity=".05"/>
            <path d="M40 130 Q60 60 80 40 Q100 60 120 130" fill="#fff" opacity=".07"/>
            <circle cx="80" cy="36" r="16" fill="#fff" opacity=".1"/>
        </svg>
        </div>
        <p style={{ fontSize: '11px', color: '#C0CCA4' }}>Today's footprint</p>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '42px',
          color: '#fff',
          lineHeight: 1,
        }}>{todayTotal}</p>
        <p style={{ fontSize: '13px', color: '#C0CCA4', marginTop: '4px' }}>
          kg CO₂
        </p>
        <div style={{
          position: 'absolute', right: '20px', top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '52px', opacity: 0.3,
        }}>🌿</div>
      </div>

      {/* CATEGORY PILLS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: '1.5px solid #e7eae0',
              background: activeCategory === cat ? '#606E52' : '#c0b5b5',
              color:      activeCategory === cat ? '#fff'     : '#28321d',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              transition: 'all 0.15s',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ENTRY CARDS GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '20px',
      }}>
        {visibleEntries.map(entry => (
          <EntryCard key={entry.id} entry={entry} />
        ))}

        {/* Add button card */}
        <div
          onClick={() => setShowForm(true)}
          style={{
            background: '#F2EFE8',
            border: '1.5px dashed #C0CCA4',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'pointer',
            minHeight: '100px',
          }}
        >
          <span style={{ fontSize: '24px', color: '#91A56E' }}>+</span>
          <span style={{ fontSize: '12px', color: '#8F8B84', marginTop: '4px' }}>
            Log activity
          </span>
        </div>
      </div>

      {/* LOG FORM — only shows when showForm is true */}
      {showForm && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid #e8e4dd',
          marginBottom: '20px',
        }}>
          <p style={{ fontWeight: 600, marginBottom: '16px', color: '#474747' }}>
            Log an activity
          </p>

          {/* Category select */}
          <label style={{ fontSize: '12px', color: '#8F8B84' }}>Category</label>
          <select
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value, type: Object.keys(FACTORS[e.target.value])[0] })}
            style={{ width: '100%', padding: '8px', marginBottom: '12px', marginTop: '4px', borderRadius: '8px', border: '1px solid #C0CCA4', fontFamily: 'var(--font-body)' }}
          >
            {Object.keys(FACTORS).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Type select */}
          <label style={{ fontSize: '12px', color: '#8F8B84' }}>Type</label>
          <select
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value })}
            style={{ width: '100%', padding: '8px', marginBottom: '12px', marginTop: '4px', borderRadius: '8px', border: '1px solid #C0CCA4', fontFamily: 'var(--font-body)' }}
          >
            {Object.keys(FACTORS[form.category]).map(type => (
              <option key={type} value={type}>{FACTORS[form.category][type].label}</option>
            ))}
          </select>

          {/* Value input */}
          <label style={{ fontSize: '12px', color: '#8F8B84' }}>
            Amount ({FACTORS[form.category][form.type].unit})
          </label>
          <input
            type="number"
            value={form.value}
            onChange={e => setForm({ ...form, value: e.target.value })}
            placeholder="e.g. 20"
            style={{ width: '100%', padding: '8px', marginBottom: '12px', marginTop: '4px', borderRadius: '8px', border: '1px solid #C0CCA4', fontFamily: 'var(--font-body)' }}
          />

          {/* Live estimate while typing — instant, local, just a hint */}
          {livePreview > 0 && !pendingPreview && (
            <p style={{ color: '#606E52', fontSize: '13px', marginBottom: '12px' }}>
              ≈ <strong>{livePreview} kg CO₂</strong> (estimate)
            </p>
          )}

          {previewError && (
            <p style={{ color: '#a85a3a', fontSize: '12px', marginBottom: '10px' }}>
              {previewError}
            </p>
          )}

          {/* STEP 1: ask for the real preview — nothing saved yet */}
          {!pendingPreview && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handlePreview}
                disabled={submitting}
                style={{ flex: 1, padding: '10px', background: '#606E52', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'var(--font-body)', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Checking…' : 'See impact'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #C0CCA4', borderRadius: '10px', cursor: 'pointer', color: '#8F8B84', fontFamily: 'var(--font-body)' }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* STEP 2: real preview is back from the backend — user decides
              what actually gets logged before anything is saved */}
          {pendingPreview && (
            <div style={{ background: '#F2EFE8', borderRadius: '12px', padding: '14px', marginTop: '4px' }}>
              <p style={{ fontSize: '13px', color: '#2A2A26', marginBottom: '10px', lineHeight: 1.5 }}>
                {pendingPreview.message}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleConfirm(false)}
                  disabled={submitting}
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '1.5px solid #C0CCA4', borderRadius: '10px', cursor: 'pointer', color: '#606E52', fontFamily: 'var(--font-body)', fontSize: '12.5px' }}
                >
                  Log as planned
                </button>
                {pendingPreview.alternative_offered && (
                  <button
                    onClick={() => handleConfirm(true)}
                    disabled={submitting}
                    style={{ flex: 1, padding: '10px', background: '#606E52', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12.5px' }}
                  >
                    Switch to {pendingPreview.alternative_mode}
                  </button>
                )}
              </div>
              <button
                onClick={cancelPending}
                style={{ width: '100%', marginTop: '8px', padding: '6px', background: 'transparent', border: 'none', color: '#9B9488', fontSize: '11px', cursor: 'pointer' }}
              >
                Cancel, don't log this
              </button>
            </div>
          )}
        </div>
      )}

      {/* RECENT ACTIVITY — persistent history sourced from entries (which
          comes from App.js's /history fetch), so it survives navigating
          away and back, unlike the old lastResult-only display */}
        <div style={{ marginTop: '8px' }}>

        <p style={{fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 900, color: '#060101', marginBottom: '12px' }}>
            Recent Activity 🔄
        </p>

        {entries.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '16px',
            border: '1.5px dashed #C0CCA4', textAlign: 'center',
          }}>
            <p style={{ fontSize: '12px', color: '#9B9488' }}>
              Log an activity above to see your history here.
            </p>
          </div>
        )}

        {entries
          .slice()
          .reverse()
          .slice(0, 8)
          .map(entry => {
            const swapped = entry.savedCo2 > 0
            return (
              <div key={entry.id} style={{
                background: '#fff', borderRadius: '16px', padding: '13px 15px',
                border: '1.5px solid #EDE8DF', display: 'flex',
                alignItems: 'center', gap: '12px', marginBottom: '10px',
              }}>
                <div style={{
                    width: '46px', height: '46px', borderRadius: '13px',
                    background: swapped ? '#E2EDD3' : '#F2EFE8',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '22px', flexShrink: 0,
                }}>{swapped ? '🌿' : CATEGORY_ICONS[entry.category] || '•'}</div>
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#2A2A26', marginBottom: '2px', textTransform: 'capitalize' }}>
                      {entry.activity} <span style={{ color: '#9B9488', fontWeight: 400 }}>· {entry.category}</span>
                    </p>
                    <p style={{ fontSize: '11px', color: '#9B9488' }}>
                      {swapped ? 'Swapped to a lower-impact choice' : `${entry.co2kg} kg CO₂ logged`}
                    </p>
                </div>
                {swapped && (
                  <div style={{
                      background: '#E2EDD3', color: '#2E4A1A', fontSize: '11px',
                      fontWeight: 700, padding: '5px 10px', borderRadius: '20px', whiteSpace: 'nowrap',
                  }}>
                      −{entry.savedCo2} kg
                  </div>
                )}
              </div>
            )
          })}
        </div>

    </div>
    </div>
  )
}