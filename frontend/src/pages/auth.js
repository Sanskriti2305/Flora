import { useState } from 'react'
import { login, signup } from '../api'

const Input = ({ label, type = 'text', value, onChange, placeholder, id, required, autoComplete }) => (
  <div style={{ marginBottom: '16px' }}>
    <label
      htmlFor={id}
      style={{ display:'block', fontSize:'11px', fontWeight:600, letterSpacing:'0.8px', textTransform:'uppercase', color:'#606E52', marginBottom:'6px' }}
    >
      {label} {required && <span aria-hidden="true" style={{ color:'#C0604A' }}>*</span>}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      aria-required={required}
      aria-label={label}
      style={{
        width:'100%', boxSizing:'border-box', padding:'11px 14px', borderRadius:'12px',
        border:'1.5px solid #DDD8CF', background:'#FDFAF5', fontSize:'14px',
        color:'#1a1814', outline:'none', fontFamily:'var(--font-body, inherit)', transition:'border-color 0.2s',
      }}
      onFocus={e => (e.target.style.borderColor = '#606E52')}
      onBlur={e  => (e.target.style.borderColor = '#DDD8CF')}
    />
  </div>
)

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode]         = useState('login')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (mode === 'signup' && !name.trim()) { setError('Name is required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    if (!password.trim()) { setError('Password is required'); return }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) { setError('Please enter a valid email address'); return }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/
    if (mode === 'signup' && !passwordRegex.test(password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number and special character')
      return
    }

    setLoading(true)
    try {
      const user = mode === 'login'
        ? await login(email, password)
        : await signup(name, email, password)
      onAuthSuccess(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="main"
      style={{ minHeight:'100vh', display:'flex', background:'linear-gradient(145deg,#E8EFD8 0%,#F5F0E8 60%,#E2EDD3 100%)', position:'relative', overflow:'hidden' }}
    >
      <svg aria-hidden="true" style={{ position:'absolute', top:0, right:0, width:'55%', height:'100%', opacity:0.22, pointerEvents:'none' }} viewBox="0 0 600 700" fill="none">
        <ellipse cx="520" cy="120" rx="160" ry="80" fill="#606E52" transform="rotate(-30 520 120)"/>
        <ellipse cx="480" cy="280" rx="120" ry="55" fill="#4A5E3A" transform="rotate(20 480 280)"/>
        <ellipse cx="560" cy="420" rx="180" ry="70" fill="#8FAF6E" transform="rotate(-15 560 420)"/>
        <ellipse cx="400" cy="580" rx="140" ry="60" fill="#606E52" transform="rotate(25 400 580)"/>
      </svg>

      <div
        role="region"
        aria-label="Flora authentication"
        style={{
          margin:'auto', width:'100%', maxWidth:'400px', padding:'40px 36px', boxSizing:'border-box',
          background:'rgba(255,255,255,0.82)', backdropFilter:'blur(14px)',
          borderRadius:'28px', border:'1.5px solid rgba(192,204,164,0.4)',
          boxShadow:'0 8px 40px rgba(74,94,58,0.10)', position:'relative', zIndex:1,
        }}
      >
        <div style={{ marginBottom:'28px' }}>
          <p style={{ fontFamily:'var(--font-display,Georgia,serif)', fontSize:'32px', color:'#1a1814', margin:0, lineHeight:1 }}>Flora</p>
          <p style={{ fontSize:'10px', letterSpacing:'2px', color:'#9B9488', marginTop:'2px', textTransform:'uppercase' }}>Carbon Tracker</p>
        </div>

        <div role="tablist" aria-label="Login or Sign up" style={{ display:'flex', background:'#F0EDE6', borderRadius:'12px', padding:'4px', marginBottom:'28px' }}>
          {['login','signup'].map(m => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              aria-controls="auth-form"
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex:1, padding:'8px', border:'none', cursor:'pointer', borderRadius:'9px',
                fontSize:'13px', fontWeight:600, fontFamily:'var(--font-body,inherit)', transition:'all 0.2s',
                background: mode === m ? '#606E52' : 'transparent',
                color:      mode === m ? '#fff'    : '#9B9488',
              }}
            >
              {m === 'login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form
          id="auth-form"
          role="tabpanel"
          onSubmit={handleSubmit}
          noValidate
          aria-label={mode === 'login' ? 'Login form' : 'Sign up form'}
        >
          {mode === 'signup' && (
            <Input id="name" label="Your name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Arya" required autoComplete="name" />
          )}
          <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

          {error && (
            <div role="alert" aria-live="assertive" style={{ fontSize:'12px', color:'#C0603A', marginBottom:'12px', background:'#FDF0EC', padding:'8px 12px', borderRadius:'8px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-disabled={loading}
            aria-busy={loading}
            aria-label={mode === 'login' ? 'Log in to Flora' : 'Create your Flora account'}
            style={{
              width:'100%', padding:'13px',
              background: loading ? '#9AAF82' : 'linear-gradient(135deg,#606E52,#4A5E3A)',
              color:'#fff', border:'none', borderRadius:'14px', fontSize:'14px',
              fontWeight:700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily:'var(--font-body,inherit)', transition:'opacity 0.2s',
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? '🌱 Log in to Flora' : '🌱 Create account'}
          </button>
        </form>

        <p style={{ fontSize:'11px', color:'#C0CCA4', textAlign:'center', marginTop:'20px' }}>
          Your data stays private — tracked locally, never sold.
        </p>

                {/* Developer credit + Digital Heroes */}
        <div style={{ borderTop:'1px solid #EDE8DF', marginTop:'20px', paddingTop:'16px', textAlign:'center' }}>
          <p style={{ fontSize:'11px', color:'#9B9488', marginBottom:'4px' }}>
            <strong style={{ color:'#606E52' }}>Sanskriti Shukla</strong> · sanskriti.sg05@gmail.com
          </p>
          <a
            href="https://digitalheroesco.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:'inline-block', marginTop:'8px', padding:'8px 18px',
              background:'#606E52', color:'#fff', borderRadius:'20px',
              fontSize:'11px', fontWeight:600, textDecoration:'none',
              fontFamily:'var(--font-body,inherit)', transition:'opacity 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Built for Digital Heroes
          </a>
        </div>
      </div>
    </div>
  )
}