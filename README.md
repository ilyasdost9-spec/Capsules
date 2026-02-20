# Capsules — Deployment Guide

## What you have
A full React app with Supabase backend. Once deployed, users can:
- Sign up and set up a profile with interests
- Write capsules that enter a 3-hour incubation window
- Withdraw capsules before they publish (permanent after)
- Browse a depth-scored "For You" feed and a chronological "Latest" feed
- Read news from verified sources (no comments, discuss via capsule instead)
- React to and respond to published capsules

---

## Step 1 — Set up Supabase

1. Go to **supabase.com** → create a free account
2. Click **New Project**, name it `capsules`, set a database password, pick US East region
3. Wait ~2 min for provisioning
4. In the left sidebar go to **SQL Editor**
5. Paste the entire contents of `supabase_schema.sql` and click **Run**
6. Go to **Settings → API** and copy:
   - `Project URL` (e.g. `https://abcdefgh.supabase.co`)
   - `anon public` key (long string starting with `eyJ`)
7. **Enable pg_cron**: Go to **Database → Extensions**, find `pg_cron`, enable it
8. Back in SQL Editor, run these two lines:
   ```sql
   select cron.schedule('publish-capsules', '* * * * *', 'select publish_ready_capsules()');
   select cron.schedule('update-depth-scores', '*/15 * * * *', 'select update_capsule_depth_scores()');
   ```
   This makes capsules auto-publish when their 3-hour window expires, and updates depth scores every 15 minutes.

---

## Step 2 — Configure the app

1. In the `capsules/` folder, copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and fill in your values:
   ```
   REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## Step 3 — Deploy to Vercel

1. Push this folder to a GitHub repo:
   ```bash
   cd capsules
   git init
   git add .
   git commit -m "Initial Capsules build"
   # Create a new repo on github.com, then:
   git remote add origin https://github.com/yourusername/capsules.git
   git push -u origin main
   ```

2. Go to **vercel.com** → sign in with GitHub → **New Project** → import your `capsules` repo

3. In the Vercel deployment settings, add your environment variables:
   - `REACT_APP_SUPABASE_URL` → your Supabase URL
   - `REACT_APP_SUPABASE_ANON_KEY` → your Supabase anon key

4. Click **Deploy**. Vercel gives you a live URL instantly (e.g. `capsules.vercel.app`)

---

## Step 4 — Test it

1. Open your Vercel URL
2. Sign up with an email
3. Set your profile and interests
4. Write a capsule — check the "In Incubation" tab
5. The capsule will auto-publish after 3 hours (or test by temporarily changing the SQL to 1 minute)

---

## How the depth algorithm works

Every 15 minutes, Supabase runs `update_capsule_depth_scores()` which scores each published capsule out of 100:

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| Read engagement | 40 pts | Avg time spent on post vs. expected read time |
| Response depth | 30 pts | Number and length of responses generated |
| Recency | 20 pts | Freshness — decays over 7 days |
| Reactions | 10 pts | Logarithmic (prevents gaming) |

The "For You" feed sorts by this score filtered against your declared interest tags.

---

## Adding real news

The app seeds a few sample news items in the schema. To add a real news pipeline:
1. Use a free tier of **NewsAPI** or **GDELT**
2. Write a simple cron script (Node.js or Python) that pulls headlines every hour and inserts into the `news_items` table via Supabase's REST API
3. Or use Supabase Edge Functions to do this serverlessly

---

## Cost

- Supabase free tier: 500MB database, 50,000 monthly active users
- Vercel free tier: unlimited deployments, generous bandwidth
- **Total cost to start: $0**
