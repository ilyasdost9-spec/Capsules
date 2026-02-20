import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { updateProfile, supabase } from '../lib/supabase'
import { useToast } from '../lib/useToast'
import './Profile.css'

const INTERESTS = ['Philosophy', 'Economics', 'Politics', 'Science', 'Culture', 'Technology', 'History', 'Ethics']

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [interests, setInterests] = useState([])
  const [loading, setLoading] = useState(false)
  const [myCapsules, setMyCapsules] = useState([])
  const [loadingCapsules, setLoadingCapsules] = useState(true)

  useEffect(() => {
    if (!user) { navigate('/'); return }
    if (profile) {
      setDisplayName(profile.display_name || '')
      setBio(profile.bio || '')
      setInterests(profile.interests || [])
    }
    loadMyCapsules()
  }, [user, profile])

  const loadMyCapsules = async () => {
    if (!user) return
    setLoadingCapsules(true)
    try {
      const { data } = await supabase
        .from('capsules')
        .select('*')
        .eq('author_id', user.id)
        .eq('is_published', true)
        .order('publishes_at', { ascending: false })
        .limit(20)
      setMyCapsules(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingCapsules(false)
    }
  }

  const toggleInterest = (interest) => {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    )
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateProfile(user.id, { display_name: displayName, bio, interests })
      refreshProfile()
      showToast('Profile updated.')
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name) => name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'

  return (
    <div className="profile-page">
      <header className="profile-header">
        <button className="back-btn" onClick={() => navigate('/feed')}>← Back to feed</button>
        <span className="profile-header-title">Profile</span>
      </header>

      <div className="profile-layout">
        {/* Edit */}
        <div className="profile-edit">
          <div className="profile-card">
            <div className="profile-card-header">
              <div
                className="profile-big-avatar"
                style={{ background: profile?.avatar_color || '#3a3028' }}
              >
                {getInitials(profile?.display_name)}
              </div>
              <div>
                <div className="profile-username">@{profile?.username}</div>
                <div className="profile-depth-score">
                  Depth score: <span>{profile?.depth_score || 0}</span>
                </div>
              </div>
            </div>

            <div className="field">
              <label className="field-label">Display name</label>
              <input
                className="field-input"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label">Bio</label>
              <textarea
                className="field-input field-textarea"
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="What do you think about?"
              />
            </div>

            <div className="field">
              <label className="field-label">Interests <span style={{ color: 'var(--text-dim)' }}>(shapes your feed)</span></label>
              <div className="interests-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
                {INTERESTS.map(interest => (
                  <button
                    key={interest}
                    type="button"
                    className={`interest-btn ${interests.includes(interest) ? 'selected' : ''}`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? <span className="spinner" /> : 'Save Changes'}
            </button>
          </div>

          {/* Stats */}
          <div className="profile-stats">
            <div className="stat-item">
              <div className="stat-value">{profile?.capsule_count || 0}</div>
              <div className="stat-label">Capsules</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{profile?.response_count || 0}</div>
              <div className="stat-label">Responses</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{profile?.depth_score || 0}</div>
              <div className="stat-label">Depth score</div>
            </div>
          </div>
        </div>

        {/* My capsules */}
        <div className="profile-capsules">
          <div className="profile-section-label">Published Capsules</div>
          {loadingCapsules ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}><span className="spinner" /></div>
          ) : myCapsules.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
              No published capsules yet.
            </div>
          ) : (
            myCapsules.map(c => (
              <div key={c.id} className="my-capsule-item">
                <div className="my-capsule-body">{c.content}</div>
                <div className="my-capsule-meta">
                  {new Date(c.publishes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {c.tags?.length > 0 && (
                    <span style={{ marginLeft: '0.75rem' }}>
                      {c.tags.map(t => <span key={t} className="tag" style={{ marginRight: '0.3rem' }}>{t}</span>)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`toast ${toast.visible ? 'show' : ''} ${toast.type}`}>{toast.message}</div>
    </div>
  )
}
