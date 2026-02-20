import React, { useState } from 'react'
import { createCapsule } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import './Compose.css'

const MAX_CHARS = 2000
const SUGGESTED_TAGS = ['Philosophy', 'Economics', 'Politics', 'Science', 'Culture', 'Technology', 'History', 'Ethics']

export default function Compose({ onSubmit, prefillContent = '' }) {
  const { user } = useAuth()
  const [content, setContent] = useState(prefillContent)
  const [selectedTags, setSelectedTags] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const charCount = content.length
  const remaining = MAX_CHARS - charCount
  const tooShort = content.trim().length < 50

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (!user || tooShort) return
    setLoading(true)
    setError('')
    try {
      const capsule = await createCapsule(user.id, content.trim(), selectedTags)
      setContent('')
      setSelectedTags([])
      onSubmit?.(capsule)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="compose">
      <div className="compose-header">
        <span className="compose-title">New Capsule</span>
        <span className="compose-note">Incubates 3 hours · Permanent once live</span>
      </div>

      <textarea
        className="compose-textarea"
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What's worth saying slowly…"
        maxLength={MAX_CHARS}
        rows={4}
      />

      <div className="compose-tags">
        {SUGGESTED_TAGS.map(tag => (
          <button
            key={tag}
            className={`compose-tag ${selectedTags.includes(tag) ? 'selected' : ''}`}
            onClick={() => toggleTag(tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </div>

      {error && (
        <div className="compose-error">{error}</div>
      )}

      <div className="compose-footer">
        <div className="compose-footer-left">
          <span className={`compose-count ${remaining < 100 ? 'compose-count--warn' : ''}`}>
            {charCount} / {MAX_CHARS}
          </span>
          {tooShort && content.length > 0 && (
            <span className="compose-hint">Min. 50 characters for a capsule</span>
          )}
        </div>
        <div className="compose-actions">
          <button
            className="btn btn-ghost"
            onClick={() => { setContent(''); setSelectedTags([]) }}
            disabled={loading || !content}
          >
            Clear
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || tooShort || !user}
          >
            {loading ? <span className="spinner" /> : 'Seal Capsule →'}
          </button>
        </div>
      </div>
    </div>
  )
}
