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
-- Count all context entries
SELECT COUNT(*) FROM shared_context;

-- List recent entries
SELECT key, updated_at, LENGTH(content) as size
FROM shared_context
ORDER BY updated_at DESC
LIMIT 10;

-- View audit history
SELECT key, action, changed_at
FROM context_history
ORDER BY changed_at DESC
LIMIT 20;

-- Find large entries
SELECT key, LENGTH(content) as bytes
FROM shared_context
ORDER BY LENGTH(content) DESC
LIMIT 5;

-- Search for keys
SELECT key, updated_at
FROM shared_context
WHERE key ILIKE '%search-term%';
```

## Rotating the Auth Token

When you need to rotate your `MCP_AUTH_TOKEN`:

### Step 1: Generate New Token

```bash
openssl rand -base64 32
```

### Step 2: Update Railway

1. Go to Railway dashboard
2. Click on your web service
3. Go to **Variables** tab
4. Update `MCP_AUTH_TOKEN` with new value
5. Railway will auto-redeploy

### Step 3: Update Claude.ai Connector

1. Go to Claude.ai Settings → Connectors
2. Edit your Shared Context connector
3. Update the Authorization header with new token
4. Test connection
5. Save

### Step 4: Verify

```bash
# Test with new token
curl -X POST https://your-app.up.railway.app/mcp \
  -H "Authorization: Bearer NEW_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
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

**Fix**: Ensure `DATABASE_URL` and `MCP_AUTH_TOKEN` are set in Railway.

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
curl -I https://your-app.up.railway.app/mcp \
  -H "Authorization: Bearer TOKEN"

# Look for headers:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 95
# X-RateLimit-Reset: 1234567890
```

## Maintenance Tasks

### Clean Up Old Entries

```sql
-- Delete entries older than 30 days
DELETE FROM shared_context
WHERE updated_at < NOW() - INTERVAL '30 days';

-- This will also be recorded in history
```

### Vacuum Database

```sql
-- Run vacuum to reclaim space
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

## Emergency Procedures

### Server Down

1. Check Railway status: [status.railway.app](https://status.railway.app)
2. Check deployment logs in Railway
3. Try redeploying: Railway dashboard → Deployments → Redeploy

### Database Corruption

1. Stop the web service (remove deployment)
2. Restore from Railway backup
3. Redeploy web service

### Token Compromised

1. **Immediately** rotate token (see above)
2. Review audit history for unauthorized access
3. Consider clearing sensitive context entries

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
