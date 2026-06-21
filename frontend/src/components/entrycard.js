const ICONS = {
  transport: '🚗',
  diet:      '🥩',
  energy:    '⚡',
  shopping:  '🛍',
}

// Each card gets a little illustrated SVG scene on top
const SCENES = {
  transport: (
    <svg width="100%" height="70" viewBox="0 0 220 70" preserveAspectRatio="xMidYMid slice">
      <rect width="220" height="70" fill="#D4E8B8"/>
      <ellipse cx="110" cy="70" rx="105" ry="28" fill="#B8D498" opacity=".7"/>
      <path d="M55 70 Q75 38 95 28 Q115 38 135 70" fill="#A8C480"/>
      <circle cx="95" cy="24" r="16" fill="#A8C480"/>
      <path d="M138 70 Q152 50 162 42 Q172 50 178 70" fill="#98B870" opacity=".8"/>
      <circle cx="162" cy="38" r="11" fill="#98B870" opacity=".8"/>
      <circle cx="192" cy="18" r="14" fill="#FFDC80" opacity=".75"/>
    </svg>
  ),
  diet: (
    <svg width="100%" height="70" viewBox="0 0 220 70" preserveAspectRatio="xMidYMid slice">
      <rect width="220" height="70" fill="#F5DEB8"/>
      <ellipse cx="110" cy="70" rx="110" ry="30" fill="#E8C898" opacity=".6"/>
      <circle cx="165" cy="28" r="22" fill="#F0C870" opacity=".55"/>
      <circle cx="165" cy="28" r="13" fill="#F5D060" opacity=".65"/>
      <path d="M18 70 Q32 46 48 36 Q62 46 72 70" fill="#E8B888" opacity=".7"/>
      <circle cx="48" cy="31" r="14" fill="#E8B888" opacity=".7"/>
      <path d="M172 70 Q182 56 190 50 Q198 56 202 70" fill="#D4A870" opacity=".6"/>
    </svg>
  ),
  energy: (
    <svg width="100%" height="70" viewBox="0 0 220 70" preserveAspectRatio="xMidYMid slice">
      <rect width="220" height="70" fill="#C8D8F0"/>
      <ellipse cx="110" cy="70" rx="110" ry="28" fill="#A8C0E8" opacity=".5"/>
      <circle cx="48" cy="24" r="20" fill="#fff" opacity=".5"/>
      <circle cx="78" cy="16" r="13" fill="#fff" opacity=".45"/>
      <circle cx="162" cy="26" r="16" fill="#fff" opacity=".4"/>
      <circle cx="186" cy="18" r="10" fill="#fff" opacity=".4"/>
      <path d="M0 48 Q55 36 110 42 Q165 36 220 42" fill="none" stroke="#fff" stroke-width="1.5" opacity=".35"/>
    </svg>
  ),
  shopping: (
    <svg width="100%" height="70" viewBox="0 0 220 70" preserveAspectRatio="xMidYMid slice">
      <rect width="220" height="70" fill="#F0E4F8"/>
      <ellipse cx="110" cy="70" rx="110" ry="28" fill="#DCC8EC" opacity=".5"/>
      <circle cx="60" cy="25" r="18" fill="#C8A8E0" opacity=".4"/>
      <circle cx="155" cy="20" r="14" fill="#C8A8E0" opacity=".35"/>
      <path d="M80 70 Q100 44 120 36 Q140 44 155 70" fill="#C8A8E0" opacity=".45"/>
      <circle cx="120" cy="31" r="14" fill="#C8A8E0" opacity=".45"/>
    </svg>
  ),
}

export default function EntryCard({ entry }) {
  return (
    <div className="entry-card" style={{
      borderRadius: '20px',
      overflow: 'hidden',
      border: '1.5px solid rgba(255,255,255,0.8)',
      background: '#fff',
    }}>
      {/* Illustrated scene */}
      <div style={{ height: '70px', overflow: 'hidden' }}>
        {SCENES[entry.category] || SCENES.transport}
      </div>

      {/* Card body */}
      <div style={{ padding: '13px 14px 12px' }}>
        <p style={{ fontSize: '10px', color: '#9B9488', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>
          {entry.category}
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '21px', color: '#2A2A26' }}>
          {entry.co2kg} kg
        </p>
        <p style={{ fontSize: '11px', color: entry.swapped ? '#9B9488' : '#606E52', fontWeight: 600, marginTop: '4px' }}>
          {entry.swapped ? '✓ Swapped!' : '↓ Swap to save'}
        </p>
      </div>
    </div>
  )
}