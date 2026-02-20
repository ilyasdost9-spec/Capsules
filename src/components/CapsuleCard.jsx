import React, { useState, useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toggleReaction, recordReadTime } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import './CapsuleCard.css'

const WORD_WPM = 200

function getReadTime(text) {
  const words = text.trim().split(/\s+/).length
  const minutes = Math.ceil(words / WORD_WPM)
  return minutes < 1 ? '< 1 min' : `~${minutes} min`
}

function getDepthLabel(score) {
  if (score >= 80) return { label: 'High depth', cls: 'depth-high' }
  if (score >= 50) return { label: 'Mid depth', cls: 'depth-mid' }
  return null
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function CapsuleCard({ capsule, onReply, showReplyCount = true }) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(capsule.reaction_count || 0)
  const [liking, setLiking] = useState(false)
  const readStartRef = useRef(null)
  const cardRef = useRef(null)

  const profile = capsule.profiles || {}
  const depth = getDepthLabel(profile.depth_score)

  // Track read time via IntersectionObserver
  useEffect(() => {
    if (!user || !capsule.id) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          readStartRef.current = Date.now()
        } else if (readStartRef.current) {
          const seconds = Math.floor((Date.now() - readStartRef.current) / 1000)
          readStartRef.current = null
          if (seconds > 4) recordReadTime(user.id, capsule.id, seconds)
        }
      },
      { threshold: 0.5 }
    )
    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [user, capsule.id])

  const handleLike = async () => {
    if (!user || liking) return
    setLiking(true)
    try {
      const added = await toggleReaction(user.id, capsule.id)
      setLiked(added)
      setLikeCount(c => added ? c + 1 : c - 1)
    } catch (e) {
      console.error(e)
    } finally {
      setLiking(false)
    }
  }

  const timeAgo = capsule.publishes_at
    ? formatDistanceToNow(new Date(capsule.publishes_at), { addSuffix: true })
    : ''

  return (
    <div className="capsule-card animate-slideUp" ref={cardRef}>
      <div className="capsule-card-header">
        <div
          className="capsule-avatar"
          style={{ background: profile.avatar_color || '#3a3028' }}
        >
          {getInitials(profile.display_name)}
        </div>
        <div className="capsule-meta">
          <div className="capsule-author">{profile.display_name || 'Anonymous'}</div>
          <div className="capsule-info">
            <span className="mono" style={{ color: 'var(--text-dim)' }}>@{profile.username}</span>
            <span className="capsule-dot">·</span>
            <span className="mono" style={{ color: 'var(--text-dim)' }}>{timeAgo}</span>
          </div>
        </div>
        {depth && (
          <span className={`depth-badge ${depth.cls}`}>{depth.label}</span>
        )}
      </div>

      <div className="capsule-body">
        {capsule.content.split('\n').map((para, i) =>
          para ? <p key={i}>{para}</p> : <br key={i} />
        )}
      </div>

      {capsule.tags && capsule.tags.length > 0 && (
        <div className="capsule-tags">
          {capsule.tags.map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}

      <div className="capsule-footer">
        <button
          className={`capsule-action ${liked ? 'liked' : ''}`}
          onClick={handleLike}
          disabled={!user || liking}
        >
          <HeartIcon filled={liked} />
          <span>{likeCount}</span>
        </button>

        {showReplyCount && onReply && (
          <button className="capsule-action" onClick={() => onReply(capsule)}>
            <ReplyIcon />
            <span>{capsule.response_count || 0} responses</span>
          </button>
        )}

        <span className="capsule-read-time">{getReadTime(capsule.content)}</span>
      </div>
    </div>
  )
}

// ── Pending capsule card ──────────────────────────────────────────────────────

export function PendingCapsuleCard({ capsule, onWithdraw }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = new Date(capsule.publishes_at) - new Date()
      if (diff <= 0) { setTimeLeft('Publishing…'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [capsule.publishes_at])

  return (
    <div className="capsule-card capsule-card--incubating animate-slideUp">
      <div className="incubation-badge">
        <div className="incubation-dot" />
        In incubation — publishes in{' '}
        <span className="incubation-countdown">{timeLeft}</span>
      </div>

      <div className="capsule-body">
        {capsule.content.split('\n').map((para, i) =>
          para ? <p key={i}>{para}</p> : <br key={i} />
        )}
      </div>

      <div className="capsule-footer">
        <button className="btn btn-danger" onClick={() => onWithdraw(capsule)}>
          Withdraw capsule
        </button>
        <span className="mono" style={{ color: 'var(--text-dim)', marginLeft: '0.75rem' }}>
          Permanent once published
        </span>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const HeartIcon = ({ filled }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

const ReplyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
