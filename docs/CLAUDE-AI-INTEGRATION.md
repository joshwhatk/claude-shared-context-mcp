# Claude.ai Integration Guide

This guide walks you through connecting your MCP Shared Context Server to Claude.ai.

## Prerequisites

Before starting, ensure you have:

1. **Deployed server** running on Railway (or another public URL)
2. **Auth token** (`MCP_AUTH_TOKEN`) configured in your deployment
3. **Health check passing**: `curl https://your-app.up.railway.app/health`

## Step 1: Access Claude.ai Connectors

1. Go to [claude.ai](https://claude.ai)
2. Click on your profile icon (bottom-left)
3. Select **Settings**
4. Navigate to **Connectors** or **Integrations** tab

> **Note**: The UI may vary. Look for options like "MCP Servers", "Custom Connectors", or "Integrations".

## Step 2: Add Custom MCP Connector

1. Click **Add Connector** or **Add MCP Server**
2. Select **Custom** or **HTTP** connector type
3. Configure the connection:

| Field | Value |
|-------|-------|
| Name | `Shared Context` (or any name you prefer) |
| URL | `https://your-app.up.railway.app/mcp` |
| Transport | HTTP/SSE (Streamable HTTP) |

## Step 3: Configure Authentication

Add the Authorization header:

1. Find the **Headers** or **Authentication** section
2. Add a custom header:
   - **Header Name**: `Authorization`
   - **Header Value**: `Bearer YOUR_MCP_AUTH_TOKEN`

> **Important**: Replace `YOUR_MCP_AUTH_TOKEN` with your actual token from Railway environment variables.

## Step 4: Test Connection

1. Click **Test Connection** or **Verify**
2. You should see:
   - Connection successful
   - 5 tools available:
     - `read_context`
     - `write_context`
     - `delete_context`
     - `list_context`
     - `read_all_context`

If the test fails, check:
- URL is correct and accessible
- Token matches exactly (no extra spaces)
- Server health check passes

## Step 5: Save and Enable

1. Click **Save** or **Add Connector**
2. Ensure the connector is **enabled**
3. Return to a Claude conversation

## Using the Shared Context Tools

Once connected, you can use natural language to interact with your shared context:

### Writing Context

```
Save to shared context with key 'project-notes':
This is my project documentation that I want to persist across conversations.
```

```
Store this in shared context as 'meeting-2024-01-10':
- Discussed Q1 roadmap
- Action items: Review PRs, update docs
- Next meeting: Friday
```

### Reading Context

```
Read the shared context for 'project-notes'
```

```
What's stored in the 'meeting-2024-01-10' context?
```

### Listing All Keys

```
List all my shared context entries
```

```
Show me what keys I have in shared context
```

### Reading All Content

```
Show me all shared context with their content
```

```
Display everything in my shared context
```

### Updating Context

```
Update the 'project-notes' context to include: Added new feature specs
```

### Deleting Context

```
Delete the shared context for 'old-notes'
```

```
Remove 'meeting-2024-01-10' from shared context
```

## Testing Checklist

Run through these tests to verify everything works:

### Basic Operations

- [ ] **Write**: Create a new entry
  ```
  Save to shared context with key 'test-001': Hello from Claude!
  ```

- [ ] **Read**: Retrieve the entry
  ```
  Read the shared context for 'test-001'
  ```

- [ ] **List**: See all entries
  ```
  List all shared context entries
  ```

- [ ] **Update**: Modify the entry
  ```
  Update 'test-001' to say: Updated message!
  ```

- [ ] **Read Again**: Verify update
  ```
  Read 'test-001' again
  ```

- [ ] **Delete**: Remove the entry
  ```
  Delete the context for 'test-001'
  ```

- [ ] **Verify Deletion**: Confirm it's gone
  ```
  Try to read 'test-001'
  ```

### Cross-Conversation Persistence

This is the main feature - context persists across conversations:

1. **In Conversation A**:
   ```
   Save to shared context with key 'persistent-data':
   This should survive across conversations!
   ```

2. **Start a NEW conversation (Conversation B)**

3. **In Conversation B**:
   ```
   Read the shared context for 'persistent-data'
   ```

4. **Verify**: You should see "This should survive across conversations!"

## Troubleshooting

### "Tool not found" or "No tools available"

- Verify the connector is enabled
- Check the URL ends with `/mcp`
- Test the health endpoint: `curl https://your-app.up.railway.app/health`

### "Authentication failed"

- Verify the token matches exactly
- Check for extra spaces or newlines in the token
- Ensure the header is `Authorization: Bearer <token>` (with space after Bearer)

### "Connection timeout"

- Check if Railway app is running
- Verify the URL is correct
- Check Railway logs for errors

### "Rate limit exceeded"

- Wait 1 minute (limit is 100 requests/minute)
- Check if multiple conversations are using the connector simultaneously

### Tools work but data doesn't persist

- Check Railway PostgreSQL is connected
- Verify `DATABASE_URL` is set in Railway
- Check Railway logs for database errors

## Viewing Audit History

To see all changes made to your shared context:

1. Connect to your Railway PostgreSQL database
2. Run this query:

```sql
SELECT key, action, changed_at,
       LEFT(content, 50) as content_preview
FROM context_history
ORDER BY changed_at DESC
LIMIT 20;
```

This shows:
- What keys were modified
- What action was taken (create/update/delete)
- When it happened
- Preview of the content

## Best Practices

### Key Naming

Use descriptive, hierarchical keys:
- `project.frontend.notes`
- `meeting.2024-01-10.summary`
- `config.api-keys` (but don't store actual secrets!)

### Content Organization

Store structured data as JSON for easy parsing:
```
Save to shared context with key 'project-status':
{
  "phase": "development",
  "progress": 75,
  "blockers": ["waiting for API access"],
  "nextSteps": ["implement auth", "add tests"]
}
```

### Regular Cleanup

Periodically clean up old entries:
```
List all shared context entries
```
Then delete entries you no longer need.

## Security Notes

- **Don't store secrets**: API keys, passwords, tokens should not go in shared context
- **Token security**: Keep your `MCP_AUTH_TOKEN` secret
- **Content limits**: Max 100KB per entry, max 255 char keys
- **Audit trail**: All changes are logged in `context_history`
