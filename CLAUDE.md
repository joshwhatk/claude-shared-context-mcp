# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Shared Context Server - A production-ready Model Context Protocol (MCP) server that enables persistent, shared context across Claude conversations with multi-tenant support. Deployed to Railway with PostgreSQL, exposing 10 MCP tools (5 core + 5 admin) via HTTP/SSE transport with Clerk OAuth, plus a REST API and React web frontend.

**Key Features:**
- 8 MCP tools for context management and admin operations
- Multi-tenant architecture with user isolation via Clerk OAuth
- React web frontend with Clerk sign-in for browsing and editing context
- Admin panel for user management
- Audit logging for all context changes and admin actions

**Target Use Case:** Solve the limitation that Claude Projects don't natively support Claude-writable shared files across conversations.

## Technology Stack

**Backend:**
- **Runtime:** Node.js 20+ with TypeScript (strict mode, ES2022)
- **HTTP Server:** Express (chosen over Fastify for better MCP transport examples)
- **Database:** PostgreSQL with `pg` (node-postgres) - no ORM
- **MCP SDK:** `@modelcontextprotocol/sdk` (official Anthropic SDK)
- **Auth:** Clerk OAuth via `@clerk/express` and `@clerk/mcp-tools`
- **Testing:** Vitest with integration tests against separate test database
- **Deployment:** Railway with managed PostgreSQL

**Frontend:**
- **Framework:** React 19 with TypeScript
- **Build Tool:** Vite
- **Routing:** React Router v7
- **Styling:** Tailwind CSS
- **Auth:** Clerk React SDK (`@clerk/clerk-react`)
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
# Set DATABASE_URL and Clerk keys in .env
```

## Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection string (auto-injected by Railway)
- `CLERK_PUBLISHABLE_KEY` - Clerk public key (from Clerk dashboard)
- `CLERK_SECRET_KEY` - Clerk secret key (from Clerk dashboard)
- `VITE_CLERK_PUBLISHABLE_KEY` - Same publishable key, exposed to Vite frontend
- `ADMIN_EMAIL` - Email address to auto-provision as admin on first Clerk login

**Optional:**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (info/debug)
- `TEST_DATABASE_URL` - Test database connection string

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
│       ├── admin-delete-user.ts
│       ├── admin-create-api-key.ts
│       └── admin-revoke-api-key.ts
├── db/
│   ├── client.ts         # PostgreSQL connection pool with SSL and retry logic
│   ├── migrations.ts     # Schema setup using PostgreSQL advisory locks
│   └── queries.ts        # Parameterized SQL queries with transaction support
├── auth/
│   ├── identity.ts       # Unified identity resolver (Clerk authInfo → userId)
│   └── provision.ts      # Shared Clerk auto-provisioning logic
├── api/                  # REST API routes
│   ├── index.ts          # Main router with Clerk JWT auth middleware
│   ├── context.ts        # Context CRUD endpoints
│   ├── keys.ts           # Self-service API key management endpoints
│   ├── admin.ts          # Admin user management endpoints
│   └── waitlist.ts       # Public waitlist signup endpoint (no auth)
└── transport/
    └── http.ts           # Express HTTP/SSE transport with Clerk OAuth, CORS

frontend/                 # React web application
├── src/
│   ├── main.tsx          # App entry point with ClerkProvider
│   ├── App.tsx           # Router with Clerk-based route protection
│   ├── pages/            # Login, Marketing, List, View, Edit, Admin, Setup, Keys
│   ├── components/       # Layout, MarkdownEditor, marketing/ (nav, hero, sections)
│   ├── hooks/            # usePageTitle, useScrollAnimation
│   ├── context/          # AuthContext wrapping Clerk hooks + backend admin check
│   └── api/              # API client using Clerk JWT tokens
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

**4. Clerk OAuth Identity Resolution**
MCP tools receive `authInfo` from the Clerk OAuth middleware. The identity resolver (`src/auth/identity.ts`) extracts the Clerk user ID and looks up the corresponding database user:
```typescript
// Identity resolver: authInfo.extra.userId → database user
const userId = await resolveUserId(extra);
if (!userId) return formatError('UNAUTHORIZED', 'Not authenticated');
// Then pass userId to all queries
const result = await getContext(userId, key);
```

**5. MCP Tool Pattern**
Each tool follows this structure:
```typescript
// 1. Resolve userId from Clerk authInfo via identity resolver
// 2. Validate inputs using validators.ts
// 3. Call database query from queries.ts (passing userId)
// 4. Return standardized response (success + data OR error via formatToolError)
// 5. All errors are ToolError instances with code and message
```

**6. Clerk OAuth Authentication**
- MCP clients authenticate via OAuth 2.1 (RFC 9728) at `/mcp`
- Well-known metadata at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`
- Backend validates Clerk JWTs via `@clerk/express` middleware
- Frontend uses `@clerk/clerk-react` for sign-in and session management
- New users can only sign up via Clerk invitation
- First admin is auto-provisioned when their email matches `ADMIN_EMAIL`

**7. Security Layers**
- **Clerk OAuth:** JWT validation via `@clerk/express` middleware
- **Input validation:** Key format (alphanumeric + dash/underscore/dot, max 255 chars)
- **Content validation:** Max 100KB per entry
- **SQL sanitization:** Search patterns escape LIKE wildcards
- **Request logging:** Authorization headers redacted, body never logged
- **Rate limiting:** 100 requests/minute per client on API endpoints
- **Multi-tenant isolation:** All queries scoped by user_id

## Database Schema

**Users table:**
```sql
users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  clerk_id TEXT UNIQUE,
  auth_provider TEXT NOT NULL DEFAULT 'manual',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
INDEX: idx_users_clerk_id ON clerk_id
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
  action TEXT NOT NULL,           -- e.g., 'create_user', 'delete_user'
  target_user_id TEXT,
  details JSONB,                  -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
INDEX: idx_admin_audit_log_admin_user_id ON admin_user_id
```

**Waitlist table (public, no auth):**
```sql
waitlist (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  preferred_login TEXT NOT NULL,
  agreed_to_contact BOOLEAN NOT NULL DEFAULT true,
  agreed_to_terms BOOLEAN NOT NULL DEFAULT true,
  consent_text TEXT NOT NULL,       -- exact disclaimer copy for legal record
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
INDEX: idx_waitlist_email ON email
```

## MCP Tools Exposed

**Core Tools (5):**
1. **read_context(key)** - Read single context entry
2. **write_context(key, content)** - Create/update context (UPSERT)
3. **delete_context(key)** - Delete context entry
4. **list_context(limit?, search?)** - List keys with metadata (default limit: 50, max: 200)
5. **read_all_context(limit?)** - Get all entries with content (default limit: 20, max: 50)

**Admin Tools (5)** - Require `is_admin=true` on user:
1. **admin_list_users()** - List all users with context entry count
2. **admin_create_user(userId, email)** - Create user manually
3. **admin_delete_user(userId)** - Delete user and cascade delete all their data
4. **admin_create_api_key(userId, name)** - Create API key for a user
5. **admin_revoke_api_key(userId, apiKeyName)** - Revoke API key by name

All tools return standardized responses:
- Success: `{ success: true, data: {...}, timestamp?: string }`
- Error: `{ success: false, error: string, code: string }`

## REST API Endpoints

**Public (no auth):**
- `POST /api/waitlist` - Join the waitlist (rate-limited, stores consent record)

**Authentication:**
- `GET /api/auth/me` - Get current user info (from Clerk JWT)

**Context Operations:**
- `GET /api/context` - List context entries (query: limit, search)
- `PUT /api/context/:key` - Create/update context entry
- `GET /api/context/:key` - Read single entry
- `DELETE /api/context/:key` - Delete entry

**API Key Management (self-service):**
- `GET /api/keys` - List own API keys
- `POST /api/keys` - Create new API key (max 10 per user)
- `DELETE /api/keys/:keyName` - Revoke own API key by name

**Admin Operations (admin-only):**
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user with initial API key
- `DELETE /api/admin/users/:userId` - Delete user
- `GET /api/admin/users/:userId/keys` - List API keys for a user
- `POST /api/admin/users/:userId/keys` - Create API key for a user (max 10)
- `DELETE /api/admin/users/:userId/keys/:keyName` - Revoke API key

**MCP OAuth Endpoints:**
- `GET /.well-known/oauth-protected-resource` - OAuth protected resource metadata
- `GET /.well-known/oauth-authorization-server` - OAuth authorization server metadata
- `POST /mcp` - MCP Streamable HTTP transport (Clerk OAuth protected)
- `GET /mcp` - MCP SSE transport
- `DELETE /mcp` - MCP session cleanup

## Frontend Pages

**Public:**
- `/` - Marketing landing page with waitlist form
- `/login` - Clerk OAuth sign-in

**App (authenticated, `/app/*`):**
- `/app` - List all context entries with search
- `/app/view/:key` - Read-only view of context entry
- `/app/edit/:key` - Edit existing context entry
- `/app/new` - Create new context entry
- `/app/setup` - Setup instructions for MCP clients
- `/app/keys` - Self-service API key management
- `/app/admin` - Admin panel for user management (admin-only)

## Critical Security Requirements

**Before deploying to production, verify:**

1. ✅ **Migration advisory locks** - Implemented in `src/db/migrations.ts`
2. ✅ **SSL enabled** - Railway uses self-signed certs, so `rejectUnauthorized: false` in `src/db/client.ts`
3. ✅ **Transaction-based audit** - All writes in `src/db/queries.ts` use transactions
4. ✅ **Clerk OAuth** - JWT validation via `@clerk/express` and `@clerk/mcp-tools`
5. ✅ **Input validation** - All tools validate via `src/tools/validators.ts`
6. ✅ **Rate limiting** - Applied to `/api` endpoints in `src/api/index.ts`
7. ✅ **Sanitized logging** - Authorization headers redacted, no body logging
8. ✅ **Environment validation** - Required vars checked in `src/index.ts`
9. ✅ **Graceful shutdown** - 30s timeout for in-flight requests
10. ✅ **CORS configuration** - Allow claude.ai origins
11. ✅ **Multi-tenant isolation** - All queries scoped by user_id from Clerk identity
12. ✅ **Admin audit logging** - All admin actions logged to admin_audit_log table
13. ✅ **Admin authorization** - Admin tools check `is_admin` flag via `requireAdmin()` guard
14. ✅ **Invitation-only signup** - Clerk configured for invitation-only mode

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

**5. Always pass userId to database queries**
Multi-tenant isolation requires every query to be scoped by user_id. Get the userId from the identity resolver:
```typescript
const userId = await resolveUserId(extra);
if (!userId) return formatError('UNAUTHORIZED', 'Not authenticated');
// Then pass userId to all queries
const result = await getContext(userId, key);
```

**6. Admin tools must use requireAdmin guard**
All admin tools must call `await requireAdmin(extra)` before performing any operations:
```typescript
const adminCheck = await requireAdmin(extra);
if (!adminCheck.authorized) return adminCheck.error;
// adminCheck.adminUserId is the verified admin user ID
```

**7. Auto-provisioning on first login**
When a Clerk user authenticates for the first time, a database user is auto-created. If their email matches `ADMIN_EMAIL`, they get `is_admin = true`. This happens in both the MCP transport middleware and the REST API auth middleware.

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
- `CLERK_PUBLISHABLE_KEY` (from Clerk dashboard)
- `CLERK_SECRET_KEY` (from Clerk dashboard)
- `VITE_CLERK_PUBLISHABLE_KEY` (same as CLERK_PUBLISHABLE_KEY)
- `ADMIN_EMAIL` (admin's email address)

**Post-deployment verification:**
```bash
# Health check
curl https://your-app.up.railway.app/health

# OAuth metadata
curl https://your-app.up.railway.app/.well-known/oauth-protected-resource
```

## Claude.ai Integration

Claude connects via MCP OAuth (RFC 9728):
1. Claude.ai → Settings → Connectors → Add custom connector
2. URL: `https://your-app.up.railway.app/mcp`
3. Claude triggers OAuth flow, user authorizes via Clerk in browser
4. Should see the tools available after authorization

Test with natural language:
- "Save to shared context with key 'test': Hello World"
- "Read the shared context for 'test'"
- "List all shared context entries"

## Web Frontend

Access the web UI at the root URL:
- `https://your-app.up.railway.app/`
- Sign in with Clerk OAuth (invitation-only)
- Browse, create, edit, and delete context entries
- Admin users can access `/admin` to manage users

## Clerk Setup

1. Create a Clerk application at https://dashboard.clerk.com
2. Enable invitation-only sign-up mode
3. Send invitation to admin email
4. Copy publishable key and secret key to environment variables
5. Admin is auto-provisioned on first login when email matches `ADMIN_EMAIL`

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
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
