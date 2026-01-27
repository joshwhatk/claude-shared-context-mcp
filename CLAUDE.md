# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Shared Context Server - A production-ready Model Context Protocol (MCP) server that enables persistent, shared context across Claude conversations with multi-tenant support. Deployed to Railway with PostgreSQL, exposing 10 MCP tools (5 core + 5 admin) via HTTP/SSE transport, plus a REST API and React web frontend.

**Key Features:**
- 10 MCP tools for context management and admin operations
- Multi-tenant architecture with user isolation via API keys
- React web frontend for browsing and editing context
- Admin panel for user and API key management
- Audit logging for all context changes and admin actions

**Target Use Case:** Solve the limitation that Claude Projects don't natively support Claude-writable shared files across conversations.

## Technology Stack

**Backend:**
- **Runtime:** Node.js 20+ with TypeScript (strict mode, ES2022)
- **HTTP Server:** Express (chosen over Fastify for better MCP transport examples)
- **Database:** PostgreSQL with `pg` (node-postgres) - no ORM
- **MCP SDK:** `@modelcontextprotocol/sdk` (official Anthropic SDK)
- **Testing:** Vitest with integration tests against separate test database
- **Deployment:** Railway with managed PostgreSQL
- **Auth:** API key authentication with SHA-256 hashing

**Frontend:**
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **Routing:** React Router v7
- **Styling:** Tailwind CSS
- **Markdown:** Milkdown editor + React Markdown renderer

## Development Commands

```bash
# Backend Development
npm run dev              # Start backend dev server with hot reload (tsx watch)
npm run build            # Compile TypeScript to dist/
npm start                # Run production build from dist/

# Frontend Development
cd frontend
npm install              # Install frontend dependencies
npm run dev              # Start Vite dev server (port 5173)
npm run build            # Build frontend for production

# Full Build (backend + frontend)
npm run build            # Builds backend, then frontend into frontend/dist/

# Testing
npm test                 # Run all integration tests
npm run test:watch       # Run tests in watch mode

# Database
npm run migrate          # Run migrations manually (also runs on app startup)

# Local PostgreSQL (Docker)
docker-compose up -d     # Start PostgreSQL via docker-compose
# Or manually:
docker run --name mcp-postgres -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16

# Environment setup
cp .env.example .env     # Copy example env file
# Set DATABASE_URL in .env
```

## Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string (auto-injected by Railway)

**Optional:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (info/debug)
- `TEST_DATABASE_URL` - Test database connection string
- `MCP_AUTH_TOKEN` - Legacy bearer token (deprecated, use API keys instead)

## Architecture

### High-Level Structure

```
src/
├── index.ts              # Entry point: env validation, migration, server start, graceful shutdown
├── server.ts             # MCP server initialization and configuration
├── tools/
│   ├── index.ts          # Tool registration hub (registers all 10 tools)
│   ├── read-context.ts   # read_context tool
│   ├── write-context.ts  # write_context tool (with validation)
│   ├── delete-context.ts # delete_context tool
│   ├── list-context.ts   # list_context tool (with search)
│   ├── read-all.ts       # read_all_context tool
│   ├── validators.ts     # Input validation (key format, content size, user ID, email)
│   ├── errors.ts         # Standardized error handling (ToolError class)
│   └── admin/            # Admin-only tools (5 tools)
│       ├── guards.ts     # requireAdmin authorization check
│       ├── admin-list-users.ts
│       ├── admin-create-user.ts
│       ├── admin-create-api-key.ts
│       ├── admin-revoke-api-key.ts
│       └── admin-delete-user.ts
├── db/
│   ├── client.ts         # PostgreSQL connection pool with SSL and retry logic
│   ├── migrations.ts     # Schema setup using PostgreSQL advisory locks
│   └── queries.ts        # Parameterized SQL queries with transaction support
├── auth/
│   ├── middleware.ts     # Bearer token validation with timing-safe comparison
│   └── session-context.ts # Session-to-user mapping for multi-tenancy
├── api/                  # REST API routes
│   ├── index.ts          # Main router with auth middleware
│   ├── context.ts        # Context CRUD endpoints
│   └── admin.ts          # Admin user/key management endpoints
└── transport/
    └── http.ts           # Express HTTP/SSE transport with rate limiting and CORS

frontend/                 # React web application
├── src/
│   ├── main.tsx          # App entry point
│   ├── pages/            # 5 pages: Login, List, View, Edit, Admin
│   ├── components/       # Layout, MarkdownEditor, Modal, etc.
│   ├── context/          # AuthContext for authentication state
│   └── api/              # API client for backend communication
├── package.json
└── vite.config.ts
```

### Key Architectural Patterns

**1. Database Layer Isolation**
All database operations are in `src/db/queries.ts`. Tools never write SQL directly. Every query:
- Uses parameterized queries (SQL injection prevention)
- Returns typed results
- Handles "not found" gracefully
- Logs errors with context

**2. Transaction-Based Audit Trail**
`shared_context` and `context_history` tables are updated atomically using PostgreSQL transactions. Never use separate queries without transaction wrapper, as audit history must never get out of sync with main data.

**3. Migration Safety**
Migrations use PostgreSQL advisory locks to prevent race conditions when multiple Railway instances start simultaneously. The lock ID is 12345 (arbitrary but must be consistent).

**4. Session Context Management**
MCP tools receive only a sessionId from the HTTP transport. The session context store (`src/auth/session-context.ts`) maps sessionId to user info:
```typescript
// Session store maps: sessionId → { userId, apiKeyHash, isAdmin }
// Tools call getUserIdFromSession(sessionId) to get the authenticated user
// This decouples HTTP authentication from MCP tool logic
```

**5. MCP Tool Pattern**
Each tool follows this structure:
```typescript
// 1. Get userId from session context (multi-tenant isolation)
// 2. Validate inputs using validators.ts
// 3. Call database query from queries.ts (passing userId)
// 4. Return standardized response (success + data OR error via formatToolError)
// 5. All errors are ToolError instances with code and message
```

**6. API Key Authentication**
- Users authenticate via API key in URL path: `/mcp/<api-key>`
- Keys are 32-byte random values (base64url encoded)
- Hashed with SHA-256 before storage (never stored in plaintext)
- `last_used_at` timestamp tracked automatically

**7. Security Layers**
- **API key hashing:** SHA-256 hash stored, plaintext shown only once at creation
- **Timing-safe comparison:** `crypto.timingSafeEqual()` prevents timing attacks
- **Input validation:** Key format (alphanumeric + dash/underscore/dot, max 255 chars)
- **Content validation:** Max 100KB per entry
- **SQL sanitization:** Search patterns escape LIKE wildcards
- **Request logging:** Authorization headers redacted, body never logged
- **Rate limiting:** 100 requests/minute per client
- **Multi-tenant isolation:** All queries scoped by user_id

## Database Schema

**Users table:**
```sql
users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'manual',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

**API Keys table:**
```sql
api_keys (
  key_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
)
INDEX: idx_api_keys_user_id ON user_id
```

**Primary table (multi-tenant):**
```sql
shared_context (
  user_id TEXT NOT NULL,
  key TEXT CHECK(length(key) <= 255),
  content TEXT NOT NULL CHECK(length(content) <= 102400),  -- 100KB
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, key)  -- Composite unique constraint for ON CONFLICT
)
INDEX: idx_shared_context_updated_at ON updated_at DESC
```

**Context audit table:**
```sql
context_history (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  key TEXT NOT NULL,
  content TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'create', 'update', 'delete'
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
```

**Admin audit table:**
```sql
admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,           -- e.g., 'create_user', 'delete_user', 'create_api_key'
  target_user_id TEXT,
  details JSONB,                  -- Additional context (key names, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
INDEX: idx_admin_audit_log_admin_user_id ON admin_user_id
```

## MCP Tools Exposed

**Core Tools (5):**
1. **read_context(key)** - Read single context entry
2. **write_context(key, content)** - Create/update context (UPSERT)
3. **delete_context(key)** - Delete context entry
4. **list_context(limit?, search?)** - List keys with metadata (default limit: 50, max: 200)
5. **read_all_context(limit?)** - Get all entries with content (default limit: 20, max: 50)

**Admin Tools (5)** - Require `is_admin=true` on user:
1. **admin_list_users()** - List all users with API key count and context entry count
2. **admin_create_user(userId, email, keyName?)** - Create user with initial API key (atomic transaction)
3. **admin_create_api_key(userId, keyName)** - Create additional API key for existing user
4. **admin_revoke_api_key(userId, keyName)** - Revoke API key by name
5. **admin_delete_user(userId)** - Delete user and cascade delete all their data

All tools return standardized responses:
- Success: `{ success: true, data: {...}, timestamp?: string }`
- Error: `{ success: false, error: string, code: string }`

## REST API Endpoints

**Authentication:**
- `POST /api/auth/verify` - Verify API key and get user info

**Context Operations:**
- `GET /api/context` - List context entries (query: limit, search)
- `POST /api/context` - Create/update context entry
- `GET /api/context/:key` - Read single entry
- `DELETE /api/context/:key` - Delete entry

**Admin Operations (admin-only):**
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create new user
- `DELETE /api/admin/users/:userId` - Delete user
- `GET /api/admin/users/:userId/keys` - List user's API keys
- `POST /api/admin/users/:userId/keys` - Create API key for user
- `DELETE /api/admin/users/:userId/keys/:keyName` - Revoke API key

## Frontend Pages

- `/login` - API key authentication
- `/` - List all context entries with search
- `/view/:key` - Read-only view of context entry
- `/edit/:key` - Edit existing context entry
- `/new` - Create new context entry
- `/admin` - Admin panel for user/key management (admin-only)

## Critical Security Requirements

**Before deploying to production, verify:**

1. ✅ **Migration advisory locks** - Implemented in `src/db/migrations.ts`
2. ✅ **SSL enabled** - Railway uses self-signed certs, so `rejectUnauthorized: false` in `src/db/client.ts`
3. ✅ **Transaction-based audit** - All writes in `src/db/queries.ts` use transactions
4. ✅ **Timing-safe auth** - `crypto.timingSafeEqual()` in `src/auth/middleware.ts`
5. ✅ **Input validation** - All tools validate via `src/tools/validators.ts`
6. ✅ **Rate limiting** - Applied to `/mcp` and `/api` endpoints in `src/transport/http.ts`
7. ✅ **Sanitized logging** - Authorization headers redacted, no body logging
8. ✅ **Environment validation** - Required vars checked in `src/index.ts`
9. ✅ **Graceful shutdown** - 30s timeout for in-flight requests
10. ✅ **CORS configuration** - Allow claude.ai origins only
11. ✅ **API key hashing** - SHA-256 hash stored, plaintext never persisted
12. ✅ **Multi-tenant isolation** - All queries scoped by user_id from session
13. ✅ **Admin audit logging** - All admin actions logged to admin_audit_log table
14. ✅ **Admin authorization** - Admin tools check `is_admin` flag via `requireAdmin()` guard

## Testing Strategy

**Integration tests only** (no unit tests for v1). Tests run against separate test database.

Test setup:
```typescript
// tests/setup.ts
- Use TEST_DATABASE_URL environment variable
- Truncate tables before each test (not transaction rollback)
- Why: Test actual COMMIT behavior, not simulated transactions
```

Test coverage:
- All 5 core tools with valid inputs
- Admin tools with admin/non-admin users
- Error cases (not found, invalid input, size limits, unauthorized)
- Audit history verification
- Search and limit parameters
- Cross-tool workflows (write → read → delete)
- Multi-tenant isolation (user A can't see user B's data)

## Common Gotchas

**1. Don't use pool.query() directly for writes**
Always get a client from pool and use transactions:
```typescript
// WRONG
await pool.query('INSERT INTO shared_context ...');

// RIGHT
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... queries ...
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**2. Railway SSL uses self-signed certificates**
Railway PostgreSQL internal connections use self-signed certs, so `rejectUnauthorized: false` is required. This is acceptable because Railway's internal network is trusted.

**3. Content size validation in multiple layers**
- Application validation (100KB in `validators.ts`)
- Database constraint (CHECK clause)
- Express body limit (1MB in `transport/http.ts`)

**4. Search parameters must be sanitized**
SQL LIKE wildcards (`%`, `_`, `\`) must be escaped in `list_context` search parameter to prevent SQL injection.

**5. Token comparison must be timing-safe**
Use `crypto.timingSafeEqual()`, never `===` or `!==`. Prevents timing attacks.

**6. Always pass userId to database queries**
Multi-tenant isolation requires every query to be scoped by user_id. Get the userId from session context:
```typescript
const userId = getUserIdFromSession(sessionId);
if (!userId) return formatError('UNAUTHORIZED', 'Not authenticated');
// Then pass userId to all queries
const result = await getContext(userId, key);
```

**7. Admin tools must use requireAdmin guard**
All admin tools must call `requireAdmin(sessionId)` before performing any operations:
```typescript
const adminCheck = requireAdmin(sessionId);
if (!adminCheck.authorized) return adminCheck.error;
// adminCheck.userId is the verified admin user ID
```

## Railway Deployment

**Build process:**
```bash
Build command: npm run build
Start command: npm start
Health check: /health
```

**Environment variables to set in Railway:**
- `NODE_ENV=production`
- `LOG_LEVEL=info`
- `DATABASE_URL` (auto-injected by Railway PostgreSQL)

**Post-deployment verification:**
```bash
# Health check
curl https://your-app.up.railway.app/health

# Test tools list (replace YOUR_API_KEY with actual key)
curl -X POST https://your-app.up.railway.app/mcp/YOUR_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Claude.ai Integration

Connect via custom connector:
1. Claude.ai → Settings → Connectors → Add custom connector
2. URL: `https://your-app.up.railway.app/mcp/{YOUR_API_KEY}`
3. No additional authentication needed (API key is in URL path)
4. Should see the tools available

Test with natural language:
- "Save to shared context with key 'test': Hello World"
- "Read the shared context for 'test'"
- "List all shared context entries"

## Web Frontend

Access the web UI at the root URL:
- `https://your-app.up.railway.app/`
- Enter your API key to authenticate
- Browse, create, edit, and delete context entries
- Admin users can access `/admin` to manage users and API keys

## Planning Documents

- `mcp-shared-context-spec.md` - Original project specification
- `MEGA-PLAN.md` - Phase-by-phase implementation plan (7 phases)
- `MEGA-PLAN-REVIEW.md` - Security review with 5 critical issues and fixes

**When resuming work across conversations:**
Reference MEGA-PLAN.md phase numbers to maintain context. Each phase has checkboxes for progress tracking.

## Commit Conventions

Commit frequently with atomic changes. Use conventional commit format (feat/fix/refactor/docs/etc). Each commit should represent one logical unit that could be independently reviewed or reverted. Prefer small, descriptive commits of working code. Use conventional commit format:
- `feat: add read_context tool`
- `fix: timing attack in auth middleware`
- `security: enable SSL certificate validation`
- `refactor: extract input validators`
- `test: add integration tests for write_context`

Co-authored-by line for Claude contributions:
```
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```
