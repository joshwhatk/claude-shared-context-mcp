# MCP Shared Context Server

A Model Context Protocol (MCP) server that enables persistent, shared context across Claude conversations. Deploy to Railway with PostgreSQL and connect via Claude.ai custom connectors.

## Features

- **5 MCP Tools**: read_context, write_context, delete_context, list_context, read_all_context
- **Multi-Tenant**: Each user has isolated data with their own API key
- **Persistent Storage**: PostgreSQL with full audit history
- **Secure**: API key authentication with SHA-256 hashing
- **Production Ready**: Rate limiting, CORS, graceful shutdown, health checks

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (for local development)
- Railway account (for deployment)

### Local Development

```bash
# Clone and install
git clone <your-repo-url>
cd mcp-shared-context
npm install

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Start PostgreSQL containers
npm run docker:up

# Run the server in development mode
npm run dev

# Create your first user and API key
npx tsx scripts/create-user.ts myuser myemail@example.com
# Save the API key - it's only shown once!

# Run tests
npm test
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm test` | Run integration tests |
| `npm run docker:up` | Start PostgreSQL containers |
| `npm run docker:down` | Stop containers |
| `npm run docker:server` | Run full stack in Docker |

### Admin Scripts

| Script | Description |
|--------|-------------|
| `npx tsx scripts/create-user.ts <user_id> <email>` | Create a new user with API key |
| `npx tsx scripts/migrate-to-multitenancy.ts` | Migrate existing data to multi-tenant schema |

## Railway Deployment

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository

### Step 2: Add PostgreSQL Database

1. In your Railway project, click **New** → **Database** → **PostgreSQL**
2. Railway automatically creates `DATABASE_URL` environment variable

### Step 3: Configure Environment Variables

In Railway dashboard, go to your service → **Variables** and add:

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | Yes |
| `LOG_LEVEL` | `info` | No |

> **Note**: API keys are now stored in the database, not as environment variables.

### Step 4: Deploy

Railway auto-deploys on push to main branch. Or manually:

1. Go to **Deployments** tab
2. Click **Deploy** → **Deploy Now**

### Step 5: Create Initial User

After deployment, create your first user via Railway shell or locally:

```bash
# Option 1: Via Railway CLI
railway run npx tsx scripts/create-user.ts joshwhatk josh@example.com

# Option 2: Run locally with production DATABASE_URL
DATABASE_URL="your-railway-postgres-url" npx tsx scripts/create-user.ts joshwhatk josh@example.com
```

**Important**: Save the API key displayed - it's only shown once!

### Step 6: Verify Deployment

```bash
# Get your Railway URL (e.g., https://your-app.up.railway.app)

# Health check
curl https://your-app.up.railway.app/health

# Test with your API key (replace YOUR_API_KEY)
curl -X POST "https://your-app.up.railway.app/mcp/YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

## Claude.ai Integration

> **Detailed Guide**: See [docs/CLAUDE-AI-INTEGRATION.md](docs/CLAUDE-AI-INTEGRATION.md) for step-by-step instructions.

### Quick Setup

1. Go to [claude.ai](https://claude.ai) → **Settings** → **Connectors**
2. Click **Add custom connector**
3. Configure:
   - **URL**: `https://your-app.up.railway.app/mcp/YOUR_API_KEY`
   - **Authentication**: None required (API key is in URL)
4. Test connection - should show 5 tools available
5. Save connector

### Using the Tools

Once connected, use natural language in Claude:

```
"Save to shared context with key 'project-notes': This is my project documentation"
"Read the shared context for 'project-notes'"
"List all shared context entries"
"Show me all shared context with content"
"Delete the context for 'project-notes'"
```

### Cross-Conversation Persistence

The main feature - context persists across conversations:

1. In **Conversation A**: Save context with a key
2. Start a **new conversation** (Conversation B)
3. In **Conversation B**: Read the same key - data is there!

### Multi-User Support

Each API key is tied to a specific user. Users can only see their own data:

- User A's API key can only access User A's context
- User B's API key can only access User B's context
- Complete data isolation between users

## MCP Tools Reference

### read_context
Read a single context entry by key.
```json
{"key": "my-key"}
```

### write_context
Create or update a context entry.
```json
{"key": "my-key", "content": "My content here"}
```
- Key: alphanumeric, dash, underscore, dot (max 255 chars)
- Content: max 100KB

### delete_context
Delete a context entry by key.
```json
{"key": "my-key"}
```

### list_context
List context keys with metadata.
```json
{"limit": 50, "search": "optional-filter"}
```
- Default limit: 50, max: 200
- Search: case-insensitive key filter

### read_all_context
Get all entries with content.
```json
{"limit": 20}
```
- Default limit: 20, max: 50

## Architecture

```
src/
├── index.ts              # Entry point, startup, shutdown
├── server.ts             # MCP server configuration
├── tools/                # MCP tool implementations
│   ├── read-context.ts
│   ├── write-context.ts
│   ├── delete-context.ts
│   ├── list-context.ts
│   ├── read-all.ts
│   ├── validators.ts     # Input validation
│   └── errors.ts         # Error handling
├── db/
│   ├── client.ts         # PostgreSQL connection pool
│   ├── migrations.ts     # Schema with advisory locks
│   └── queries.ts        # Parameterized SQL queries
├── auth/
│   └── session-context.ts # Session-to-user mapping
└── transport/
    └── http.ts           # Express HTTP/SSE transport

scripts/
├── create-user.ts        # Admin: create users with API keys
└── migrate-to-multitenancy.ts # Data migration script
```

## Security

- **Authentication**: API key in URL path, hashed with SHA-256 in database
- **Multi-Tenancy**: Complete user data isolation
- **Input Validation**: Key format, content size limits
- **SQL Injection**: Parameterized queries throughout
- **Rate Limiting**: 100 requests/minute per IP
- **CORS**: Restricted to claude.ai origins
- **SSL**: Enabled in production with certificate validation
- **Audit Trail**: All changes recorded in context_history table with user_id

## Database Schema

```sql
-- Users (Firebase-ready)
users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)

-- API Keys (hashed storage)
api_keys (
  key_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE
)

-- Main storage (multi-tenant)
shared_context (
  user_id TEXT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, key)
)

-- Audit history (multi-tenant)
context_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'create', 'update', 'delete'
  changed_at TIMESTAMP WITH TIME ZONE
)
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `LOG_LEVEL` | No | info | Logging level (info/debug) |
| `TEST_DATABASE_URL` | No | - | Test database for running tests |

> **Note**: `MCP_AUTH_TOKEN` is no longer used. API keys are stored in the database.

## Troubleshooting

### Connection Refused
- Verify DATABASE_URL is correct
- Check PostgreSQL is running: `npm run docker:up`

### Authentication Failed (Invalid API key)
- Ensure you're using the correct API key in the URL path
- Verify the API key exists in the database
- Check the key hasn't been deleted

### Tools Not Showing in Claude
- Verify health endpoint returns 200
- Check Railway logs for startup errors
- Ensure MCP endpoint returns valid JSON-RPC response
- Verify URL format: `/mcp/YOUR_API_KEY` (not just `/mcp`)

### Rate Limited
- Wait 1 minute for rate limit reset
- Rate limit: 100 requests/minute per IP

### "Not authenticated" errors
- The API key may be invalid or expired
- Create a new user/key: `npx tsx scripts/create-user.ts`

## Cost Estimate

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month includes:
  - 512 MB RAM
  - Shared CPU
  - 1 GB PostgreSQL
- Estimated monthly cost: **$5-10** for light usage

## Documentation

- [Claude.ai Integration Guide](docs/CLAUDE-AI-INTEGRATION.md) - Detailed setup and usage
- [Operations Guide](docs/OPERATIONS.md) - Maintenance, monitoring, troubleshooting

## Testing

```bash
# Run integration tests
npm test

# Test deployed server (replace with your URL and API key)
curl -X POST "https://your-app.up.railway.app/mcp/YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## License

MIT
