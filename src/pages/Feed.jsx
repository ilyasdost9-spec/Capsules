import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import {
  getForYouFeed, getLatestFeed, getPendingCapsules,
  withdrawCapsule, getNewsItems, createResponse, getResponses,
  signOut
} from '../lib/supabase'
import { useToast } from '../lib/useToast'
import CapsuleCard, { PendingCapsuleCard } from '../components/CapsuleCard'
import Compose from '../components/Compose'
import './Feed.css'

const TOPICS = ['All', 'Philosophy', 'Economics', 'Politics', 'Science', 'Culture', 'Technology']

export default function Feed() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  const [mainTab, setMainTab] = useState('discussions') // 'discussions' | 'news'
  const [feedTab, setFeedTab] = useState('foryou') // 'foryou' | 'latest' | 'incubating'
  const [selectedTopic, setSelectedTopic] = useState('All')

  const [forYouPosts, setForYouPosts] = useState([])
  const [latestPosts, setLatestPosts] = useState([])
  const [pendingPosts, setPendingPosts] = useState([])
  const [newsPosts, setNewsPosts] = useState([])

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)

  // Reply modal
  const [replyTarget, setReplyTarget] = useState(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)

  // Withdraw modal
  const [withdrawTarget, setWithdrawTarget] = useState(null)

  // Compose prefill (from news tab)
  const [composePrefill, setComposePrefill] = useState('')

  useEffect(() => {
    if (!user) { navigate('/'); return }
    loadAll()
  }, [user])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [forYou, latest, pending, news] = await Promise.all([
        getForYouFeed(user.id, profile?.interests || [], 20, 0),
        getLatestFeed(20, 0),
        getPendingCapsules(user.id),
        getNewsItems(10)
      ])
      setForYouPosts(forYou)
      setLatestPosts(latest)
      setPendingPosts(pending)
      setNewsPosts(news)
      setOffset(20)
    } catch (e) {
      showToast('Error loading feed: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleNewCapsule = (capsule) => {
    setPendingPosts(prev => [capsule, ...prev])
    setFeedTab('incubating')
    showToast('✓ Capsule sealed and in incubation. You have 3 hours to withdraw it.')
  }

  const handleWithdraw = (capsule) => {
    setWithdrawTarget(capsule)
  }

  const confirmWithdraw = async () => {
    if (!withdrawTarget) return
    try {
      await withdrawCapsule(withdrawTarget.id, user.id)
      setPendingPosts(prev => prev.filter(p => p.id !== withdrawTarget.id))
      showToast('Capsule withdrawn and deleted.')
    } catch (e) {
      showToast('Could not withdraw: ' + e.message, 'error')
    } finally {
      setWithdrawTarget(null)
    }
  }

  const handleReply = (capsule) => {
    setReplyTarget(capsule)
    setReplyContent('')
  }

  const submitReply = async () => {
    if (!replyContent.trim() || replyContent.trim().length < 20) return
    setReplyLoading(true)
    try {
      await createResponse(user.id, replyTarget.id, replyContent.trim())
      setReplyTarget(null)
      setReplyContent('')
      setPendingPosts(prev => [...prev]) // trigger re-render
      showToast('✓ Response sealed. In incubation for 3 hours.')
    } catch (e) {
      showToast('Error: ' + e.message, 'error')
    } finally {
      setReplyLoading(false)
    }
  }

  const openDiscussFromNews = (newsItem) => {
    setMainTab('discussions')
    setComposePrefill(`On "${newsItem.title}": `)
    showToast('Switched to Discussions — compose your capsule below.')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const filteredForYou = selectedTopic === 'All'
    ? forYouPosts
    : forYouPosts.filter(p => p.tags?.includes(selectedTopic))

  const filteredLatest = selectedTopic === 'All'
    ? latestPosts
    : latestPosts.filter(p => p.tags?.includes(selectedTopic))

  const getInitials = (name) => name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'

  return (
    <div className="feed-page">
      {/* Header */}
      <header className="feed-header">
        <div className="feed-logo">
          Capsules
          <span className="feed-logo-beta">Beta</span>
        </div>
        <nav className="feed-nav">
          <button
            className={`feed-nav-btn ${mainTab === 'discussions' ? 'active' : ''}`}
            onClick={() => setMainTab('discussions')}
          >
            Discussions
          </button>
          <button
            className={`feed-nav-btn feed-nav-btn--news ${mainTab === 'news' ? 'active' : ''}`}
            onClick={() => setMainTab('news')}
          >
            News
          </button>
        </nav>
        <div className="feed-header-right">
          <button className="feed-profile-btn" onClick={() => navigate('/profile')}>
            <div
              className="feed-avatar"
              style={{ background: profile?.avatar_color || '#3a3028' }}
            >
              {getInitials(profile?.display_name)}
            </div>
            <span>{profile?.display_name || user?.email}</span>
          </button>
          <button className="feed-signout" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      {/* Main */}
      <div className="feed-layout">
        {/* Sidebar */}
        <aside className="feed-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Topics</div>
            {TOPICS.map(topic => (
              <button
                key={topic}
                className={`sidebar-topic ${selectedTopic === topic ? 'active' : ''}`}
                onClick={() => setSelectedTopic(topic)}
              >
                {topic}
              </button>
            ))}
          </div>

          {profile && (
            <div className="sidebar-section">
              <div className="sidebar-label">Your Depth</div>
              <div className="sidebar-depth">
                <div className="depth-row">
                  <span>Score</span>
                  <span className="depth-val">{profile.depth_score || 0}</span>
                </div>
                <div className="depth-row">
                  <span>Capsules</span>
                  <span className="depth-val">{profile.capsule_count || 0}</span>
                </div>
                <div className="depth-row">
                  <span>Responses</span>
                  <span className="depth-val">{profile.response_count || 0}</span>
                </div>
                <div className="depth-note">Ranked by read time · response depth · topic engagement</div>
              </div>
            </div>
          )}
        </aside>

        {/* Feed */}
        <div className="feed-content">

          {/* ── DISCUSSIONS ── */}
          {mainTab === 'discussions' && (
            <>
              <Compose
                onSubmit={handleNewCapsule}
                prefillContent={composePrefill}
                key={composePrefill}
              />

              <div className="feed-tabs">
                <button
                  className={`feed-tab ${feedTab === 'foryou' ? 'active' : ''}`}
                  onClick={() => setFeedTab('foryou')}
                >
                  For You
                </button>
                <button
                  className={`feed-tab ${feedTab === 'latest' ? 'active' : ''}`}
                  onClick={() => setFeedTab('latest')}
                >
                  Latest
                </button>
                <button
                  className={`feed-tab ${feedTab === 'incubating' ? 'active' : ''}`}
                  onClick={() => setFeedTab('incubating')}
                >
                  In Incubation
                  {pendingPosts.length > 0 && (
                    <span className="incubation-count">{pendingPosts.length}</span>
                  )}
                </button>
              </div>

              {loading ? (
                <div className="feed-loading">
                  <span className="spinner" />
                </div>
              ) : (
                <>
                  {/* FOR YOU */}
                  {feedTab === 'foryou' && (
                    <>
                      <div className="algo-note">
                        ⟡ Ranked by <strong>depth score</strong> — read time, response quality, topic match. Not by engagement.
                      </div>
                      {filteredForYou.length === 0 ? (
                        <EmptyState
                          title="Your feed is growing"
                          body="As more people join and post, capsules matched to your interests will appear here."
                        />
                      ) : (
                        filteredForYou.map(c => (
                          <CapsuleCard key={c.id} capsule={c} onReply={handleReply} />
                        ))
                      )}
                    </>
                  )}

                  {/* LATEST */}
                  {feedTab === 'latest' && (
                    <>
                      {filteredLatest.length === 0 ? (
                        <EmptyState
                          title="Nothing yet"
                          body="Be the first to seal a capsule."
                        />
                      ) : (
                        filteredLatest.map(c => (
                          <CapsuleCard key={c.id} capsule={c} onReply={handleReply} />
                        ))
                      )}
                    </>
                  )}

                  {/* INCUBATING */}
                  {feedTab === 'incubating' && (
                    <>
                      {pendingPosts.length === 0 ? (
                        <EmptyState
                          title="Nothing in incubation"
                          body="Capsules you seal will appear here for 3 hours before publishing."
                        />
                      ) : (
                        pendingPosts.map(c => (
                          <PendingCapsuleCard key={c.id} capsule={c} onWithdraw={handleWithdraw} />
                        ))
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ── NEWS ── */}
          {mainTab === 'news' && (
            <>
              <div className="news-banner">
                ◈ &nbsp;Aggregated from verified sources. No comments. Use "Discuss" to respond via a capsule.
              </div>
              {loading ? (
                <div className="feed-loading"><span className="spinner" /></div>
              ) : newsPosts.length === 0 ? (
                <EmptyState
                  title="News coming soon"
                  body="Verified news sources will appear here automatically."
                />
              ) : (
                newsPosts.map(item => (
                  <NewsCard key={item.id} item={item} onDiscuss={openDiscussFromNews} />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* ── REPLY MODAL ── */}
      {replyTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setReplyTarget(null)}>
          <div className="modal">
            <div className="modal-title">Compose a response</div>
            <div className="modal-body">
              Responding to <strong>{replyTarget.profiles?.display_name}</strong>.
              Your response enters a 3-hour incubation window. Permanent once published.
            </div>
            <textarea
              style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', minHeight: '120px' }}
              placeholder="Take your time…"
              value={replyContent}
              onChange={e => setReplyContent(e.target.value)}
              maxLength={2000}
              rows={5}
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setReplyTarget(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={submitReply}
                disabled={replyLoading || replyContent.trim().length < 20}
              >
                {replyLoading ? <span className="spinner" /> : 'Seal Response →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WITHDRAW MODAL ── */}
      {withdrawTarget && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setWithdrawTarget(null)}>
          <div className="modal">
            <div className="modal-title">Withdraw this capsule?</div>
            <div className="modal-body">
              This capsule is still in incubation and has not been published. Withdrawing it will permanently delete it. This action cannot be undone.
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setWithdrawTarget(null)}>Keep it</button>
              <button className="btn btn-danger" onClick={confirmWithdraw}>Withdraw</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div className={`toast ${toast.visible ? 'show' : ''} ${toast.type}`}>
        {toast.message}
      </div>
    </div>
  )
}

// ── News Card ─────────────────────────────────────────────────────────────────

function NewsCard({ item, onDiscuss }) {
  const timeAgo = item.published_at
    ? formatDistanceToNow(new Date(item.published_at), { addSuffix: true })
    : ''

  return (
    <div className="news-card animate-slideUp">
      <div className="news-source">
        <span>{item.source}</span>
        <span className="news-verified">✓</span>
        <span className="news-time">{timeAgo}</span>
      </div>
      <div className="news-title">{item.title}</div>
      <div className="news-summary">{item.summary}</div>
      <div className="news-footer">
        <span className="no-comment-note">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          No comments
        </span>
        <button className="btn btn-news" onClick={() => onDiscuss(item)}>
          Discuss →
        </button>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <div className="empty-state-glyph">◇</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-body">{body}</div>
    </div>
  )
}

// helper for news (import if needed)
function formatDistanceToNow(date, opts) {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  return `${minutes}m ago`
}
