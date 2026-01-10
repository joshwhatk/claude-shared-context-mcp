# MCP Shared Context Server

## Project Overview

Build a Model Context Protocol (MCP) server that enables Claude conversations within a project to read and write shared context to a PostgreSQL database. This allows multiple chat sessions to maintain persistent, shared state — solving the problem that Claude Projects don't natively support Claude-writable shared files across conversations.

## Goals

1. **Persistent shared context**: Store key-value pairs that persist across Claude conversations
2. **Read and write capabilities**: Claude can both read existing context and update/create new context
3. **Simple authentication**: API key-based auth to prevent unauthorized access
4. **Easy deployment**: Single command deploy to Railway with PostgreSQL included
5. **Minimal maintenance**: Set it and forget it

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js 20+ | Best MCP SDK support, fast cold starts |
| Language | TypeScript | Type safety, better maintainability |
| MCP SDK | `@modelcontextprotocol/sdk` | Official Anthropic SDK |
| Database | PostgreSQL (Railway managed) | Included in Railway usage, one-click setup |
| DB Client | `pg` (node-postgres) | Simple, well-tested, no ORM overhead |
| HTTP Server | Express or Fastify | For remote MCP transport (HTTP/SSE) |
| Auth | Bearer token | Simple, sufficient for personal use |

## Architecture

```
┌─────────────────┐     HTTPS + Bearer Token    ┌──────────────────┐
│   Claude.ai     │ ◄─────────────────────────► │  MCP Server      │
│   (Web/Desktop) │                             │  (Railway)       │
└─────────────────┘                             │                  │
                                                │  - Express/HTTP  │
                                                │  - MCP SDK       │
                                                │  - Auth middleware│
                                                └────────┬─────────┘
                                                         │
                                                         │ pg client
                                                         ▼
                                                ┌──────────────────┐
                                                │   PostgreSQL     │
                                                │   (Railway)      │
                                                │                  │
                                                │  shared_context  │
                                                │  table           │
                                                └──────────────────┘
```

## Database Schema

```sql
-- Main context storage table
CREATE TABLE IF NOT EXISTS shared_context (
    key TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for listing by recency
CREATE INDEX IF NOT EXISTS idx_shared_context_updated_at 
ON shared_context(updated_at DESC);

-- Optional: History/audit table for tracking changes
CREATE TABLE IF NOT EXISTS context_history (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    content TEXT NOT NULL,
    action TEXT NOT NULL, -- 'create', 'update', 'delete'
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## MCP Tools to Implement

### 1. `read_context`
Read a specific context entry by key.

**Parameters:**
- `key` (string, required): The context key to read

**Returns:**
- The content stored at that key, or a message if not found

**Example:**
```json
{
  "name": "read_context",
  "arguments": { "key": "project_status" }
}
```

### 2. `write_context`
Create or update a context entry. Uses PostgreSQL UPSERT.

**Parameters:**
- `key` (string, required): The context key
- `content` (string, required): The content to store

**Returns:**
- Confirmation message with timestamp

**Example:**
```json
{
  "name": "write_context",
  "arguments": { 
    "key": "project_status", 
    "content": "Phase 2 complete. Moving to testing." 
  }
}
```

### 3. `delete_context`
Remove a context entry.

**Parameters:**
- `key` (string, required): The context key to delete

**Returns:**
- Confirmation or "not found" message

### 4. `list_context`
List all context keys with metadata.

**Parameters:**
- `limit` (number, optional): Max entries to return (default: 50)
- `search` (string, optional): Filter keys containing this substring

**Returns:**
- List of keys with their `updated_at` timestamps

### 5. `read_all_context`
Read all context entries at once (for initial conversation context loading).

**Parameters:**
- `limit` (number, optional): Max entries to return (default: 20)

**Returns:**
- All key-value pairs, ordered by most recently updated

## Project Structure

```
mcp-shared-context/
├── src/
│   ├── index.ts              # Entry point, server setup
│   ├── server.ts             # MCP server configuration
│   ├── tools/
│   │   ├── index.ts          # Tool registration
│   │   ├── read-context.ts   # read_context tool
│   │   ├── write-context.ts  # write_context tool
│   │   ├── delete-context.ts # delete_context tool
│   │   ├── list-context.ts   # list_context tool
│   │   └── read-all.ts       # read_all_context tool
│   ├── db/
│   │   ├── client.ts         # PostgreSQL connection pool
│   │   ├── migrations.ts     # Schema setup/migrations
│   │   └── queries.ts        # SQL query functions
│   ├── auth/
│   │   └── middleware.ts     # Bearer token validation
│   └── transport/
│       └── http.ts           # HTTP/SSE transport for remote MCP
├── package.json
├── tsconfig.json
├── railway.json              # Railway IaC config (optional)
├── .env.example              # Example environment variables
├── .gitignore
└── README.md
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dbname  # Auto-injected by Railway
MCP_AUTH_TOKEN=your-secret-token-here                 # Generate a strong random string

# Optional
PORT=3000                                             # Default: 3000
NODE_ENV=production                                   # Default: development
LOG_LEVEL=info                                        # Default: info
```

## Authentication

Use simple Bearer token authentication:

```typescript
// Middleware to validate requests
function validateAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const token = authHeader.slice(7);
  
  if (token !== process.env.MCP_AUTH_TOKEN) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  
  next();
}
```

## MCP Transport

For Claude.ai web access, implement HTTP with Server-Sent Events (SSE) transport:

```typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// POST /mcp - Main MCP endpoint
// Handles JSON-RPC requests from Claude

// The SDK handles the protocol details, we just need to:
// 1. Set up the HTTP routes
// 2. Connect requests to the MCP server
// 3. Return responses
```

## Railway Configuration

### Option A: Auto-detect (Recommended)
Railway auto-detects Node.js projects. Just push to GitHub and connect.

### Option B: railway.json (IaC)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

### Database Setup
In Railway dashboard or CLI:
```bash
railway add --database postgres
```

Railway auto-injects `DATABASE_URL` into your service.

## Implementation Notes

### Database Connection Pooling
Use connection pooling for efficiency:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,  // Max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Error Handling
- Return meaningful error messages in MCP tool responses
- Log errors server-side for debugging
- Don't expose internal details in error responses

### Health Check Endpoint
```typescript
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: 'Database connection failed' });
  }
});
```

## Security Considerations

1. **Never commit secrets**: Use `.env` locally, Railway environment variables in production
2. **Use HTTPS only**: Railway provides this automatically
3. **Validate all inputs**: Sanitize key names and content
4. **Rate limiting**: Consider adding rate limiting for production use
5. **Token rotation**: Plan for periodic token rotation

## Testing

### Local Development
```bash
# 1. Start local PostgreSQL (Docker)
docker run --name mcp-postgres -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16

# 2. Set environment variables
export DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres
export MCP_AUTH_TOKEN=dev-token

# 3. Run in development mode
npm run dev
```

### Testing MCP Tools
Use the MCP Inspector or curl:

```bash
# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Call write_context
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"write_context","arguments":{"key":"test","content":"Hello World"}}}'
```

## Deployment Steps

1. **Create Railway account** at railway.app
2. **Create new project** and connect GitHub repo
3. **Add PostgreSQL database** (one click in Railway dashboard)
4. **Set environment variables**:
   - `MCP_AUTH_TOKEN`: Generate with `openssl rand -base64 32`
5. **Deploy**: Push to GitHub, Railway auto-deploys
6. **Get URL**: Railway provides `https://your-app.up.railway.app`
7. **Connect to Claude**: Settings → Connectors → Add Custom Connector → Enter URL

## Connecting to Claude.ai

1. Go to [claude.ai](https://claude.ai)
2. Click your profile → Settings → Connectors
3. Click "Add custom connector"
4. Enter your Railway URL: `https://your-app.up.railway.app/mcp`
5. In Advanced settings, you may need to configure auth headers
6. Test the connection
7. Use in any conversation!

## Usage Examples

Once connected, you can use natural language in Claude:

> "Save to shared context with key 'project-goals': We're building a foster care app to help families connect with resources."

> "Read the shared context for 'project-goals'"

> "List all shared context entries"

> "Update 'project-status' to say we've completed the authentication module"

## Future Enhancements (Out of Scope for v1)

- [ ] Multiple namespaces/projects
- [ ] Context versioning with rollback
- [ ] Automatic summarization of large contexts
- [ ] OAuth authentication flow
- [ ] Rate limiting per key
- [ ] Webhooks for context changes
- [ ] Context expiration/TTL

## Success Criteria

1. ✅ Can deploy to Railway in under 15 minutes
2. ✅ Claude.ai can connect via custom connector
3. ✅ Can read and write context from Claude conversations
4. ✅ Context persists across separate conversations
5. ✅ Monthly cost stays under $10 for light usage
6. ✅ No maintenance required after initial setup
