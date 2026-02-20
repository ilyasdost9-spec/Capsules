import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp } from '../lib/supabase'
import './Auth.css'

const INTERESTS = ['Philosophy', 'Economics', 'Politics', 'Science', 'Culture', 'Technology', 'History', 'Ethics']

export default function Auth() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'profile'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Signup fields
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [selectedInterests, setSelectedInterests] = useState([])
  const [signupData, setSignupData] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signIn(email, password)
      navigate('/feed')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    if (!username.trim() || !displayName.trim()) {
      setError('Please fill in all fields')
      return
    }
    if (username.includes(' ')) {
      setError('Username cannot contain spaces')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await signUp(signupEmail, signupPassword, username.toLowerCase(), displayName)
      setSignupData(data)
      setMode('profile')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileSetup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // Update profile with bio and interests
      const { supabase } = await import('../lib/supabase')
      if (signupData?.user) {
        await supabase.from('profiles').update({
          bio,
          interests: selectedInterests,
          avatar_color: getRandomColor()
        }).eq('id', signupData.user.id)
      }
      navigate('/feed')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleInterest = (interest) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    )
  }

  const getRandomColor = () => {
    const colors = ['#8a7048', '#3a5a7a', '#5a7a3a', '#7a3a5a', '#3a7a6a']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-pattern" />

      <div className="auth-container">
        {/* Brand */}
        <div className="auth-brand">
          <h1 className="auth-logo">Capsules</h1>
          <p className="auth-tagline">Think before you speak. Permanently.</p>
        </div>

        {/* Login */}
        {mode === 'login' && (
          <div className="auth-card animate-slideUp">
            <div className="auth-card-header">
              <span className="mono" style={{ color: 'var(--text-dim)' }}>— Sign in</span>
            </div>
            <form onSubmit={handleLogin}>
              <div className="field">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  className="field-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">Password</label>
                <input
                  type="password"
                  className="field-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Enter →'}
              </button>
            </form>
            <div className="auth-switch">
              No account?{' '}
              <button className="auth-link" onClick={() => { setMode('signup'); setError('') }}>
                Join Capsules
              </button>
            </div>
          </div>
        )}

        {/* Signup */}
        {mode === 'signup' && (
          <div className="auth-card animate-slideUp">
            <div className="auth-card-header">
              <span className="mono" style={{ color: 'var(--text-dim)' }}>— Create account</span>
            </div>
            <form onSubmit={handleSignup}>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Display name</label>
                  <input
                    type="text"
                    className="field-input"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label">Username</label>
                  <input
                    type="text"
                    className="field-input"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="@handle"
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  className="field-input"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="field">
                <label className="field-label">Password</label>
                <input
                  type="password"
                  className="field-input"
                  value={signupPassword}
                  onChange={e => setSignupPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  minLength={8}
                  required
                />
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Continue →'}
              </button>
            </form>
            <div className="auth-switch">
              Already a member?{' '}
              <button className="auth-link" onClick={() => { setMode('login'); setError('') }}>
                Sign in
              </button>
            </div>
          </div>
        )}

        {/* Profile setup */}
        {mode === 'profile' && (
          <div className="auth-card animate-slideUp">
            <div className="auth-card-header">
              <span className="mono" style={{ color: 'var(--accent)' }}>— Set up your profile</span>
            </div>
            <p className="auth-subtitle">
              Tell us what you think about. This shapes your feed — not your behavior.
            </p>
            <form onSubmit={handleProfileSetup}>
              <div className="field">
                <label className="field-label">Bio <span style={{ color: 'var(--text-dim)' }}>(optional)</span></label>
                <textarea
                  className="field-input field-textarea"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="What do you think about? What's your intellectual background?"
                  rows={3}
                  maxLength={280}
                />
              </div>
              <div className="field">
                <label className="field-label">Your interests</label>
                <div className="interests-grid">
                  {INTERESTS.map(interest => (
                    <button
                      key={interest}
                      type="button"
                      className={`interest-btn ${selectedInterests.includes(interest) ? 'selected' : ''}`}
                      onClick={() => toggleInterest(interest)}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
                <div className="mono" style={{ color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                  {selectedInterests.length} selected — these seed your depth feed
                </div>
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Enter Capsules →'}
              </button>
            </form>
          </div>
        )}

        {/* Philosophy note */}
        <div className="auth-philosophy">
          <div className="auth-philosophy-rule" />
          <p>
            Every capsule incubates for 3 hours before publishing.<br />
            You may withdraw it anytime before then.<br />
            <strong>Once live, it is permanent.</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
