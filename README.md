# MCP Shared Context Server

A Model Context Protocol (MCP) server that enables persistent, shared context across Claude conversations. Deploy to Railway with PostgreSQL and connect via Claude.ai custom connectors.

## Features

- **5 MCP Tools**: read_context, write_context, delete_context, list_context, read_all_context
- **Persistent Storage**: PostgreSQL with full audit history
- **Secure**: Bearer token authentication with timing-safe comparison
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
# Edit .env with your settings

# Start PostgreSQL containers
npm run docker:up

# Run the server in development mode
npm run dev

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
| `MCP_AUTH_TOKEN` | Generate with `openssl rand -base64 32` | Yes |
| `NODE_ENV` | `production` | Yes |
| `LOG_LEVEL` | `info` | No |

> **Important**: Generate a secure token! Run `openssl rand -base64 32` in your terminal.

### Step 4: Deploy

Railway auto-deploys on push to main branch. Or manually:

1. Go to **Deployments** tab
2. Click **Deploy** → **Deploy Now**

### Step 5: Verify Deployment

```bash
# Get your Railway URL (e.g., https://your-app.up.railway.app)

# Health check
curl https://your-app.up.railway.app/health

# List tools (replace YOUR_TOKEN)
curl -X POST https://your-app.up.railway.app/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

## Claude.ai Integration

### Connect as Custom Connector

1. Go to [claude.ai](https://claude.ai) → **Settings** → **Connectors**
2. Click **Add custom connector**
3. Configure:
   - **URL**: `https://your-app.up.railway.app/mcp`
   - **Authentication**: Add header `Authorization: Bearer YOUR_TOKEN`
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
│   └── middleware.ts     # Bearer token validation
└── transport/
    └── http.ts           # Express HTTP/SSE transport
```

## Security

- **Authentication**: Bearer token with timing-safe comparison
- **Input Validation**: Key format, content size limits
- **SQL Injection**: Parameterized queries throughout
- **Rate Limiting**: 100 requests/minute per IP
- **CORS**: Restricted to claude.ai origins
- **SSL**: Enabled in production with certificate validation
- **Audit Trail**: All changes recorded in context_history table

## Database Schema

```sql
-- Main storage
shared_context (
  key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)

-- Audit history
context_history (
  id SERIAL PRIMARY KEY,
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
| `MCP_AUTH_TOKEN` | Yes | - | Bearer token for authentication |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `LOG_LEVEL` | No | info | Logging level (info/debug) |
| `TEST_DATABASE_URL` | No | - | Test database for running tests |

## Troubleshooting

### Connection Refused
- Verify DATABASE_URL is correct
- Check PostgreSQL is running: `npm run docker:up`

### Authentication Failed
- Ensure `Authorization: Bearer <token>` header is set
- Token must match `MCP_AUTH_TOKEN` exactly

### Tools Not Showing in Claude
- Verify health endpoint returns 200
- Check Railway logs for startup errors
- Ensure MCP endpoint returns valid JSON-RPC response

### Rate Limited
- Wait 1 minute for rate limit reset
- Rate limit: 100 requests/minute per IP

## Cost Estimate

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month includes:
  - 512 MB RAM
  - Shared CPU
  - 1 GB PostgreSQL
- Estimated monthly cost: **$5-10** for light usage

## License

MIT
