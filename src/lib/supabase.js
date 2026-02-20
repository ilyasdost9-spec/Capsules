import { createClient } from '@supabase/supabase-js'

const supabaseUrl = https://yxxaevnnhwvsggsrvih.supabase.co
const supabaseAnonKey = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4eGFldm5uaHd2dnNnZ3NydmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjE5MjksImV4cCI6MjA4NzEzNzkyOX0.58_JWkzXHpLX8jqcDN0Wit2tZ9qC5FUWgVQJqsTz5bc

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── AUTH ────────────────────────────────────────────────────────────────────

export const signUp = async (email, password, username, displayName) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName }
    }
  })
  if (error) throw error

  // Create profile row
  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      username,
      display_name: displayName,
      email
    })
  }
  return data
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ─── PROFILES ────────────────────────────────────────────────────────────────

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── CAPSULES ─────────────────────────────────────────────────────────────────

const INCUBATION_HOURS = 3

export const createCapsule = async (userId, content, tags = []) => {
  const now = new Date()
  const publishesAt = new Date(now.getTime() + INCUBATION_HOURS * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('capsules')
    .insert({
      author_id: userId,
      content,
      tags,
      created_at: now.toISOString(),
      publishes_at: publishesAt.toISOString(),
      is_published: false,
      read_count: 0,
      total_read_seconds: 0,
      response_count: 0
    })
    .select(`*, profiles(display_name, username, avatar_color, depth_score)`)
    .single()

  if (error) throw error
  return data
}

export const withdrawCapsule = async (capsuleId, userId) => {
  // Can only withdraw if not yet published
  const { data, error } = await supabase
    .from('capsules')
    .delete()
    .eq('id', capsuleId)
    .eq('author_id', userId)
    .gt('publishes_at', new Date().toISOString()) // Server enforced: only if still in incubation
  if (error) throw error
  return data
}

// Fetch published capsules for the For You feed (depth-scored)
export const getForYouFeed = async (userId, userInterests = [], limit = 20, offset = 0) => {
  const { data, error } = await supabase
    .from('capsules')
    .select(`
      *,
      profiles(display_name, username, avatar_color, depth_score),
      responses(count)
    `)
    .eq('is_published', true)
    .lte('publishes_at', new Date().toISOString())
    .order('depth_feed_score', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data || []
}

// Fetch latest published capsules (chronological)
export const getLatestFeed = async (limit = 20, offset = 0) => {
  const { data, error } = await supabase
    .from('capsules')
    .select(`*, profiles(display_name, username, avatar_color, depth_score)`)
    .eq('is_published', true)
    .lte('publishes_at', new Date().toISOString())
    .order('publishes_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return data || []
}

// Fetch user's pending (in incubation) capsules
export const getPendingCapsules = async (userId) => {
  const { data, error } = await supabase
    .from('capsules')
    .select('*')
    .eq('author_id', userId)
    .eq('is_published', false)
    .gt('publishes_at', new Date().toISOString())
    .order('publishes_at', { ascending: true })

  if (error) throw error
  return data || []
}

// ─── RESPONSES ────────────────────────────────────────────────────────────────

export const createResponse = async (userId, capsuleId, content) => {
  const now = new Date()
  const publishesAt = new Date(now.getTime() + INCUBATION_HOURS * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('responses')
    .insert({
      author_id: userId,
      capsule_id: capsuleId,
      content,
      created_at: now.toISOString(),
      publishes_at: publishesAt.toISOString(),
      is_published: false
    })
    .select(`*, profiles(display_name, username, avatar_color, depth_score)`)
    .single()

  if (error) throw error
  return data
}

export const getResponses = async (capsuleId) => {
  const { data, error } = await supabase
    .from('responses')
    .select(`*, profiles(display_name, username, avatar_color, depth_score)`)
    .eq('capsule_id', capsuleId)
    .eq('is_published', true)
    .lte('publishes_at', new Date().toISOString())
    .order('publishes_at', { ascending: true })

  if (error) throw error
  return data || []
}

// ─── REACTIONS ────────────────────────────────────────────────────────────────

export const toggleReaction = async (userId, capsuleId) => {
  // Check if already reacted
  const { data: existing } = await supabase
    .from('reactions')
    .select('id')
    .eq('user_id', userId)
    .eq('capsule_id', capsuleId)
    .single()

  if (existing) {
    await supabase.from('reactions').delete().eq('id', existing.id)
    return false // removed
  } else {
    await supabase.from('reactions').insert({ user_id: userId, capsule_id: capsuleId })
    return true // added
  }
}

export const getReactionCount = async (capsuleId) => {
  const { count } = await supabase
    .from('reactions')
    .select('*', { count: 'exact', head: true })
    .eq('capsule_id', capsuleId)
  return count || 0
}

// ─── READ TRACKING (depth algo) ───────────────────────────────────────────────

export const recordReadTime = async (userId, capsuleId, seconds) => {
  if (seconds < 5) return // ignore bounces
  await supabase.from('read_events').upsert({
    user_id: userId,
    capsule_id: capsuleId,
    read_seconds: seconds,
    recorded_at: new Date().toISOString()
  }, { onConflict: 'user_id,capsule_id' })
}

// ─── NEWS ─────────────────────────────────────────────────────────────────────

export const getNewsItems = async (limit = 20) => {
  const { data, error } = await supabase
    .from('news_items')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}
