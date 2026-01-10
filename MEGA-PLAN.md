# MCP Shared Context Server - Implementation Plan

**Project Start Date:** 2026-01-10
**Target:** Production deployment on Railway with PostgreSQL

## Executive Summary

Building an MCP server that enables persistent, shared context across Claude conversations within a project. The server exposes 5 MCP tools (read, write, delete, list, read_all) backed by PostgreSQL, deployed to Railway with bearer token authentication.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HTTP Server | Express | Mature ecosystem, better MCP transport examples |
| Database Client | `pg` (node-postgres) | Simple, no ORM overhead, well-tested |
| Logging | Console logging | Simple, Railway captures automatically |
| Testing | Basic integration tests | Good coverage without slowing down delivery |
| Audit History | Include in v1 | Better debugging from day one, minimal complexity |
| MCP Transport | HTTP with SSE | Required for Claude.ai web access |

---

## Phase 1: Project Bootstrap & Database Setup

### 1.1 Initialize Project Structure
- [ ] Create `package.json` with TypeScript, Express, MCP SDK, pg dependencies
- [ ] Set up `tsconfig.json` with strict mode and ES2022 target
- [ ] Create project directory structure:
  ```
  src/
  ├── index.ts              # Entry point
  ├── server.ts             # MCP server configuration
  ├── tools/
  │   └── index.ts          # Tool registration hub
  ├── db/
  │   ├── client.ts         # PostgreSQL pool setup
  │   ├── migrations.ts     # Schema initialization
  │   └── queries.ts        # SQL query functions
  ├── auth/
  │   └── middleware.ts     # Bearer token validation
  └── transport/
      └── http.ts           # HTTP/SSE transport layer
  ```
- [ ] Create `.env.example` with required variables
- [ ] Create `.gitignore` (node_modules, .env, dist)
- [ ] Initialize git repository

**Dependencies:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "express": "^4.18.2",
    "pg": "^8.11.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/pg": "^8.10.9",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "vitest": "^1.1.0"
  }
}
```

### 1.2 Database Layer Implementation

**File: `src/db/client.ts`**
- [ ] Create PostgreSQL connection pool with proper configuration
- [ ] SSL handling for production (Railway) vs development
- [ ] Connection pooling parameters (max: 10, idle timeout: 30s)
- [ ] Export pool instance and helper functions
- [ ] Add connection error handling and retry logic

**File: `src/db/migrations.ts`**
- [ ] Create `shared_context` table schema
  - Columns: key (PK), content, created_at, updated_at
  - Index on updated_at DESC
- [ ] Create `context_history` audit table
  - Columns: id (SERIAL PK), key, content, action, changed_at
  - No indexes needed (write-heavy, read rarely)
- [ ] Implement `runMigrations()` function that runs on startup
- [ ] Make migrations idempotent (IF NOT EXISTS)

**File: `src/db/queries.ts`**
Implement database operations:
- [ ] `getContext(key: string)` - SELECT single entry
- [ ] `setContext(key: string, content: string)` - UPSERT with updated_at
  - Include trigger or manual insert to context_history
- [ ] `deleteContext(key: string)` - DELETE with history entry
- [ ] `listContextKeys(limit: number, search?: string)` - List with metadata
- [ ] `getAllContext(limit: number)` - Get all key-value pairs by recency

Each query should:
- Use parameterized queries (SQL injection prevention)
- Return structured results with proper types
- Log errors with context
- Handle "not found" gracefully

---

## Phase 2: MCP Tool Implementation

### 2.1 Core MCP Server Setup

**File: `src/server.ts`**
- [ ] Import and initialize MCP Server from SDK
- [ ] Configure server metadata (name, version)
- [ ] Set up tool registration system
- [ ] Export configured server instance

### 2.2 Individual Tool Implementation

**File: `src/tools/read-context.ts`**
```typescript
Tool: read_context
Input: { key: string }
Implementation:
- Call db.getContext(key)
- Return content if found
- Return clear "not found" message if missing
- Handle database errors gracefully
```

**File: `src/tools/write-context.ts`**
```typescript
Tool: write_context
Input: { key: string, content: string }
Implementation:
- Validate key format (no special chars, max length)
- Validate content (max size check, e.g., 100KB)
- Call db.setContext(key, content)
- Return success message with timestamp
- Record action in context_history
```

**File: `src/tools/delete-context.ts`**
```typescript
Tool: delete_context
Input: { key: string }
Implementation:
- Call db.deleteContext(key)
- Record deletion in context_history
- Return confirmation or "not found"
```

**File: `src/tools/list-context.ts`**
```typescript
Tool: list_context
Input: { limit?: number, search?: string }
Implementation:
- Default limit: 50, max: 200
- Call db.listContextKeys(limit, search)
- Return array of { key, updated_at }
- Format timestamps as ISO 8601
```

**File: `src/tools/read-all.ts`**
```typescript
Tool: read_all_context
Input: { limit?: number }
Implementation:
- Default limit: 20, max: 50
- Call db.getAllContext(limit)
- Return array of { key, content, updated_at }
- Order by updated_at DESC
```

### 2.3 Tool Registration

**File: `src/tools/index.ts`**
- [ ] Import all tool implementations
- [ ] Register each tool with the MCP server
- [ ] Define tool schemas (input validation)
- [ ] Set up tool handler routing
- [ ] Add error boundaries for tool execution

---

## Phase 3: Authentication & Transport

### 3.1 Authentication Middleware

**File: `src/auth/middleware.ts`**
- [ ] Implement `validateAuth` Express middleware
- [ ] Check for `Authorization: Bearer <token>` header
- [ ] Compare against `process.env.MCP_AUTH_TOKEN`
- [ ] Return 401 for missing auth, 403 for invalid token
- [ ] Add timing-safe comparison to prevent timing attacks
- [ ] Log authentication failures (without leaking token info)

### 3.2 HTTP Transport Layer

**File: `src/transport/http.ts`**
- [ ] Set up Express app
- [ ] Configure body parsing (JSON, size limits)
- [ ] Add CORS headers (if needed for Claude.ai)
- [ ] Implement POST `/mcp` endpoint
  - Use `StreamableHTTPServerTransport` from MCP SDK
  - Connect to MCP server instance
  - Apply auth middleware
  - Handle JSON-RPC protocol
- [ ] Implement GET `/health` endpoint
  - Check database connectivity
  - Return 200 + timestamp if healthy
  - Return 500 if database unreachable
- [ ] Add request logging middleware
- [ ] Error handling middleware (catch-all)

### 3.3 Application Entry Point

**File: `src/index.ts`**
- [ ] Load environment variables with `dotenv`
- [ ] Validate required env vars (DATABASE_URL, MCP_AUTH_TOKEN)
- [ ] Run database migrations on startup
- [ ] Initialize HTTP server
- [ ] Start listening on PORT (default 3000)
- [ ] Log startup information (port, environment)
- [ ] Set up graceful shutdown handlers (SIGTERM, SIGINT)
  - Close database pool
  - Stop accepting new requests
  - Wait for in-flight requests to complete

---

## Phase 4: Local Development & Testing

### 4.1 Local Environment Setup

**Documentation to create:**
- [ ] Add scripts to `package.json`:
  ```json
  {
    "scripts": {
      "dev": "tsx watch src/index.ts",
      "build": "tsc",
      "start": "node dist/index.js",
      "test": "vitest run",
      "test:watch": "vitest",
      "migrate": "tsx src/db/migrations.ts"
    }
  }
  ```
- [ ] Create local PostgreSQL setup instructions (Docker)
- [ ] Document `.env` setup for local development

**Local testing checklist:**
- [ ] Start local PostgreSQL container
- [ ] Run migrations successfully
- [ ] Server starts without errors
- [ ] Health endpoint returns 200
- [ ] Auth rejects requests without token
- [ ] Auth rejects requests with wrong token

### 4.2 Integration Tests

**File: `tests/integration/tools.test.ts`**

Set up test database:
- [ ] Use separate test database or transaction rollbacks
- [ ] Run migrations before each test suite
- [ ] Clean up data after tests

Test cases:
- [ ] **write_context**: Creates new entry, returns success
- [ ] **write_context**: Updates existing entry, updates timestamp
- [ ] **write_context**: Validates key format
- [ ] **write_context**: Validates content size limits
- [ ] **read_context**: Retrieves existing entry
- [ ] **read_context**: Returns "not found" for missing key
- [ ] **delete_context**: Removes entry successfully
- [ ] **delete_context**: Returns "not found" for missing key
- [ ] **list_context**: Returns entries sorted by updated_at
- [ ] **list_context**: Respects limit parameter
- [ ] **list_context**: Filters by search parameter
- [ ] **read_all_context**: Returns all entries with content
- [ ] **read_all_context**: Respects limit parameter
- [ ] **context_history**: Records create action
- [ ] **context_history**: Records update action
- [ ] **context_history**: Records delete action

Test utilities:
- [ ] Helper to call tools through MCP server
- [ ] Helper to query database directly for verification
- [ ] Fixtures for test data

### 4.3 Manual Testing with MCP Inspector

- [ ] Install MCP Inspector CLI
- [ ] Test `tools/list` endpoint
- [ ] Test each tool with sample data
- [ ] Verify error responses
- [ ] Test with invalid authentication

---

## Phase 5: Railway Deployment

### 5.1 Pre-deployment Preparation

- [ ] Create Railway account
- [ ] Install Railway CLI (optional but recommended)
- [ ] Push code to GitHub repository
- [ ] Create `.dockerignore` (node_modules, .env, tests)

### 5.2 Railway Project Setup

- [ ] Create new Railway project
- [ ] Connect GitHub repository
- [ ] Add PostgreSQL database service
  - Railway auto-creates and links DATABASE_URL
- [ ] Configure environment variables in Railway dashboard:
  - `MCP_AUTH_TOKEN` (generate with `openssl rand -base64 32`)
  - `NODE_ENV=production`
  - `LOG_LEVEL=info`
- [ ] Configure build settings:
  - Build command: `npm run build`
  - Start command: `npm start`
  - Root directory: `/`

### 5.3 Health Check Configuration

**File: `railway.json`** (optional but recommended)
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

### 5.4 First Deployment

- [ ] Trigger deployment (push to main branch or manual deploy)
- [ ] Monitor build logs for errors
- [ ] Check deployment logs for startup messages
- [ ] Verify migrations ran successfully
- [ ] Test `/health` endpoint from Railway URL
- [ ] Test `/mcp` endpoint with curl and auth token

**Deployment verification curl commands:**
```bash
# Health check
curl https://your-app.up.railway.app/health

# List tools
curl -X POST https://your-app.up.railway.app/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Write context
curl -X POST https://your-app.up.railway.app/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"write_context","arguments":{"key":"test","content":"Hello from Railway"}}}'

# Read context
curl -X POST https://your-app.up.railway.app/mcp \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_context","arguments":{"key":"test"}}}'
```

---

## Phase 6: Claude.ai Integration

### 6.1 Connect to Claude.ai

**Note:** As of January 2026, the exact UI flow may have changed. Consult current Claude.ai documentation.

Expected steps:
- [ ] Navigate to claude.ai → Settings → Connectors
- [ ] Click "Add custom connector" or similar
- [ ] Enter Railway URL: `https://your-app.up.railway.app/mcp`
- [ ] Configure authentication:
  - Method: Bearer token or custom header
  - Add header: `Authorization: Bearer YOUR_TOKEN`
- [ ] Test connection (should see 5 tools available)
- [ ] Save connector configuration

### 6.2 End-to-End Testing in Claude

Test each tool through natural language:

- [ ] **Write**: "Save to shared context with key 'test-001': This is a test message"
  - Verify success response
  - Check Railway logs for write operation

- [ ] **Read**: "Read the shared context for 'test-001'"
  - Should return "This is a test message"

- [ ] **List**: "List all shared context entries"
  - Should show 'test-001' with timestamp

- [ ] **Update**: "Update 'test-001' to say: Updated message"
  - Should succeed
  - Re-read should show new content

- [ ] **Read All**: "Show me all shared context"
  - Should return all entries with content

- [ ] **Delete**: "Delete the context for 'test-001'"
  - Should succeed
  - List should no longer show it

- [ ] **Cross-conversation persistence**:
  - Write context in conversation A
  - Start new conversation B
  - Read same context successfully

### 6.3 Audit History Verification

- [ ] Connect to Railway PostgreSQL with `psql` or GUI client
- [ ] Query `context_history` table
- [ ] Verify all actions (create, update, delete) are logged
- [ ] Check timestamps are accurate

---

## Phase 7: Documentation & Handoff

### 7.1 README.md

Create comprehensive README with:
- [ ] Project overview and purpose
- [ ] Architecture diagram
- [ ] Prerequisites (Railway account, Claude.ai access)
- [ ] Local development setup instructions
- [ ] Deployment instructions
- [ ] Configuration reference (environment variables)
- [ ] Usage examples from Claude
- [ ] Troubleshooting section
- [ ] Cost estimates (Railway usage)
- [ ] Security best practices

### 7.2 Operational Documentation

**File: `docs/OPERATIONS.md`**
- [ ] How to rotate MCP_AUTH_TOKEN
- [ ] How to access Railway logs
- [ ] How to connect to production database
- [ ] How to run manual migrations
- [ ] Monitoring recommendations
- [ ] Backup strategy (Railway auto-backups)

**File: `docs/TROUBLESHOOTING.md`**
- [ ] Common error messages and solutions
- [ ] Authentication failures
- [ ] Database connection issues
- [ ] Railway deployment problems
- [ ] Claude.ai connector issues

### 7.3 Code Quality Checklist

- [ ] All TypeScript strict mode errors resolved
- [ ] No console.error without context
- [ ] All database queries use parameterized queries
- [ ] All async operations have error handling
- [ ] Environment variables validated on startup
- [ ] No secrets in code or git history

---

## Success Criteria Checklist

- [ ] **Deploy in under 15 minutes**: From Railway project creation to live URL
- [ ] **Claude.ai connection works**: All 5 tools visible and functional
- [ ] **Read/write works**: Can store and retrieve context from Claude
- [ ] **Cross-conversation persistence**: Context survives across sessions
- [ ] **Low cost**: Estimated under $10/month for light usage
- [ ] **Zero maintenance**: No regular maintenance tasks required

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP SDK API changes | High | Pin SDK version, check changelog before updates |
| Railway pricing changes | Medium | Monitor usage, have backup deployment plan (Render, Fly.io) |
| Token leakage | High | Never log tokens, use Railway env vars, document rotation |
| Database connection limits | Medium | Use connection pooling, monitor Railway metrics |
| Large context storage | Low | Implement content size limits (100KB per entry) |
| Claude.ai connector API changes | High | Monitor Anthropic announcements, test regularly |

---

## Post-Launch Enhancements (Future Scope)

Not required for v1 but consider for future iterations:

- [ ] **Namespaces**: Support multiple projects in one database
- [ ] **TTL/Expiration**: Auto-delete old context entries
- [ ] **Context versioning**: Keep full history with rollback capability
- [ ] **Webhooks**: Notify external services of context changes
- [ ] **Rate limiting**: Prevent abuse (per key or global)
- [ ] **Automatic summarization**: Compress large contexts with Claude
- [ ] **OAuth flow**: Replace bearer token with OAuth
- [ ] **Prometheus metrics**: Export usage metrics
- [ ] **Admin UI**: Web interface to view/edit context

---

## Notes & Decisions Log

**2026-01-10**: Initial plan created
- Decided on Express over Fastify for HTTP server
- Including context_history audit table in v1
- Basic integration tests chosen over comprehensive suite
- Console logging sufficient for v1
- Railway selected as deployment platform

---

## Next Immediate Steps

1. Run through Phase 1.1: Initialize project structure and dependencies
2. Set up local PostgreSQL with Docker
3. Implement database layer (Phase 1.2)
4. Implement first MCP tool (read_context) as proof of concept
5. Get local MCP server running and testable

**Ready to start? Ask me to begin with Phase 1.1!**
