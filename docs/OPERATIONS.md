# Operations Guide

This guide covers operational tasks for maintaining your MCP Shared Context Server.

## Accessing Railway Dashboard

1. Go to [railway.app](https://railway.app)
2. Sign in and select your project
3. You'll see your services: web server and PostgreSQL

## Viewing Logs

### Via Railway Dashboard

1. Click on your web service
2. Select **Deployments** tab
3. Click on the active deployment
4. View real-time logs

### Via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# View logs
railway logs
```

## Connecting to Production Database

### Get Connection String

1. In Railway dashboard, click on PostgreSQL service
2. Go to **Connect** tab
3. Copy the connection string

### Using psql

```bash
# Replace with your actual connection string
psql "postgresql://postgres:PASSWORD@HOST:PORT/railway"
```

### Common Queries

```sql
-- Count all users
SELECT COUNT(*) FROM users;

-- List all users
SELECT id, email, auth_provider, created_at FROM users;

-- Count context entries per user
SELECT user_id, COUNT(*) as entry_count
FROM shared_context
GROUP BY user_id;

-- List recent entries for a specific user
SELECT key, updated_at, LENGTH(content) as size
FROM shared_context
WHERE user_id = 'your_user_id'
ORDER BY updated_at DESC
LIMIT 10;

-- View audit history for a user
SELECT key, action, changed_at
FROM context_history
WHERE user_id = 'your_user_id'
ORDER BY changed_at DESC
LIMIT 20;

-- Find large entries
SELECT user_id, key, LENGTH(content) as bytes
FROM shared_context
ORDER BY LENGTH(content) DESC
LIMIT 5;

-- Search for keys across all users (admin)
SELECT user_id, key, updated_at
FROM shared_context
WHERE key ILIKE '%search-term%';

-- Check API key usage
SELECT u.id, u.email, ak.name, ak.last_used_at
FROM users u
JOIN api_keys ak ON u.id = ak.user_id
ORDER BY ak.last_used_at DESC NULLS LAST;
```

## User and API Key Management

### Creating a New User

```bash
# Via Railway CLI (recommended for production)
railway run npx tsx scripts/create-user.ts <user_id> <email>

# Or locally with production DATABASE_URL
DATABASE_URL="postgresql://..." npx tsx scripts/create-user.ts <user_id> <email>

# Example
railway run npx tsx scripts/create-user.ts alice alice@example.com
```

**Important**: Save the API key that's displayed - it's only shown once!

### Listing Users

```sql
SELECT id, email, auth_provider, created_at FROM users ORDER BY created_at DESC;
```

### Listing API Keys for a User

```sql
SELECT name, created_at, last_used_at
FROM api_keys
WHERE user_id = 'user_id_here'
ORDER BY created_at DESC;
```

### Revoking an API Key

```sql
-- Delete specific API key by looking up its hash
-- First, find the key (you need the key hash)
DELETE FROM api_keys WHERE user_id = 'user_id' AND name = 'key_name';
```

Or create a new API key and delete the old one.

### Deleting a User

```sql
-- This will CASCADE delete all their data (context, history, API keys)
DELETE FROM users WHERE id = 'user_id_here';
```

**Warning**: This permanently deletes all the user's data!

## Rotating API Keys

When a user needs a new API key:

### Step 1: Create New Key for User

Currently requires creating a new user, or adding a function to create additional keys.

For now, the simplest approach is:
1. Note the user's current data
2. Delete and recreate the user
3. Data is lost (or migrate it manually)

### Step 2: Update Claude.ai Connector

1. Go to Claude.ai Settings → Connectors
2. Edit the Shared Context connector
3. Update the URL with new API key: `/mcp/NEW_API_KEY`
4. Test connection
5. Save

### Step 3: Verify

```bash
# Test with new API key
curl -X POST "https://your-app.up.railway.app/mcp/NEW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Running Manual Migrations

Migrations run automatically on startup, but you can run them manually:

### Via Railway CLI

```bash
railway run npm run migrate
```

### Check Migration Status

```sql
-- Connect to database and check tables exist
\dt

-- Should show:
--  users
--  api_keys
--  shared_context
--  context_history
```

## Monitoring

### Health Check

```bash
# Should return {"status":"healthy",...}
curl https://your-app.up.railway.app/health
```

### Key Metrics to Watch

1. **Response times** - Check Railway metrics
2. **Error rate** - Look for 4xx/5xx in logs
3. **Database connections** - Max 10 in pool
4. **Storage usage** - PostgreSQL size in Railway
5. **User count** - Monitor growth

### Setting Up Alerts

Railway provides basic monitoring. For advanced alerts:

1. Use a service like UptimeRobot or Pingdom
2. Monitor the `/health` endpoint
3. Set alert threshold (e.g., 30 second timeout)

## Backup Strategy

### Railway Auto-Backups

Railway PostgreSQL includes automatic daily backups. To access:

1. Click on PostgreSQL service
2. Go to **Backups** tab
3. Download or restore from backup

### Manual Backup

```bash
# Get connection string from Railway
# Then run pg_dump
pg_dump "postgresql://..." > backup-$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
psql "postgresql://..." < backup-20240110.sql
```

## Scaling

### Vertical Scaling

Upgrade Railway plan for more resources:
- More RAM
- More CPU
- Larger PostgreSQL

### Horizontal Scaling

Not recommended for this use case. The server uses in-memory rate limiting and session storage, which would need external stores (Redis) for multi-instance deployment.

## Troubleshooting

### Server Won't Start

Check logs for:
```
[startup] Missing required environment variables
```

**Fix**: Ensure `DATABASE_URL` is set in Railway.

### Database Connection Failed

```
[startup] Database connection failed
```

**Fix**:
1. Check PostgreSQL service is running
2. Verify `DATABASE_URL` is correct
3. Check Railway PostgreSQL hasn't exceeded limits

### Migration Lock Stuck

If migrations hang:

```sql
-- Connect to database
-- Release advisory lock manually
SELECT pg_advisory_unlock(12345);
```

### High Memory Usage

```bash
# Check current usage in Railway dashboard
# If consistently high, consider:
# 1. Reducing connection pool size
# 2. Cleaning up old context entries
# 3. Upgrading Railway plan
```

### Rate Limiting Issues

```
Rate limit exceeded
```

**Fix**: Wait 1 minute. Rate limit resets every 60 seconds.

To check current rate:
```bash
curl -I "https://your-app.up.railway.app/mcp/YOUR_API_KEY" \
  -H "Content-Type: application/json"

# Look for headers:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 95
# X-RateLimit-Reset: 1234567890
```

### Invalid API Key Errors

```
Invalid API key
```

**Fix**:
1. Verify the API key in the URL is correct
2. Check the user exists: `SELECT * FROM users WHERE id = '...'`
3. Check the API key exists: `SELECT * FROM api_keys WHERE user_id = '...'`
4. Create a new user if needed: `npx tsx scripts/create-user.ts`

## Maintenance Tasks

### Clean Up Old Entries for a User

```sql
-- Delete entries older than 30 days for a specific user
DELETE FROM shared_context
WHERE user_id = 'user_id'
AND updated_at < NOW() - INTERVAL '30 days';
```

### Clean Up All Old Entries (Admin)

```sql
-- Delete entries older than 90 days across all users
DELETE FROM shared_context
WHERE updated_at < NOW() - INTERVAL '90 days';

-- This will also be recorded in history
```

### Prune History Table

```sql
-- Delete history entries older than 6 months
DELETE FROM context_history
WHERE changed_at < NOW() - INTERVAL '6 months';
```

### Vacuum Database

```sql
-- Run vacuum to reclaim space
VACUUM ANALYZE users;
VACUUM ANALYZE api_keys;
VACUUM ANALYZE shared_context;
VACUUM ANALYZE context_history;
```

### Check Table Sizes

```sql
SELECT
  relname as table,
  pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### Check Per-User Storage

```sql
SELECT
  user_id,
  COUNT(*) as entries,
  SUM(LENGTH(content)) as total_bytes,
  pg_size_pretty(SUM(LENGTH(content))::bigint) as total_size
FROM shared_context
GROUP BY user_id
ORDER BY total_bytes DESC;
```

## Emergency Procedures

### Server Down

1. Check Railway status: [status.railway.app](https://status.railway.app)
2. Check deployment logs in Railway
3. Try redeploying: Railway dashboard → Deployments → Redeploy

### Database Corruption

1. Stop the web service (remove deployment)
2. Restore from Railway backup
3. Redeploy web service

### API Key Compromised

1. **Immediately** identify the affected user
2. Delete the compromised API key:
   ```sql
   DELETE FROM api_keys WHERE user_id = 'affected_user';
   ```
3. Create new user/key for them:
   ```bash
   railway run npx tsx scripts/create-user.ts new_user_id email@example.com
   ```
4. Review audit history for unauthorized access:
   ```sql
   SELECT * FROM context_history
   WHERE user_id = 'affected_user'
   ORDER BY changed_at DESC
   LIMIT 50;
   ```
5. Consider clearing sensitive context entries

### Mass Security Issue

If you need to invalidate all API keys:

```sql
-- Delete all API keys (users will need new keys)
TRUNCATE TABLE api_keys;
```

Then recreate keys for each user.

## Cost Management

### Monitor Usage

Railway dashboard shows:
- Execution hours
- Memory usage
- Network egress
- Database storage

### Reduce Costs

1. Use Hobby plan ($5/month)
2. Clean up unused context entries
3. Set reasonable content size limits
4. Monitor for runaway processes
5. Delete inactive users

### Check Per-User Costs

```sql
-- See which users are using the most storage
SELECT
  u.id,
  u.email,
  COUNT(sc.key) as entries,
  SUM(LENGTH(sc.content)) as bytes
FROM users u
LEFT JOIN shared_context sc ON u.id = sc.user_id
GROUP BY u.id, u.email
ORDER BY bytes DESC NULLS LAST;
```
