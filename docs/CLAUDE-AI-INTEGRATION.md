# Claude.ai Integration Guide

This guide walks you through connecting your MCP Shared Context Server to Claude.ai.

## Prerequisites

Before starting, ensure you have:

1. **Deployed server** running on Railway (or another public URL)
2. **API key** created via `npx tsx scripts/create-user.ts`
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
| URL | `https://your-app.up.railway.app/mcp/YOUR_API_KEY` |
| Transport | HTTP/SSE (Streamable HTTP) |

> **Important**: The API key goes in the URL path, not in a header!

## Step 3: Authentication

**No additional authentication headers are needed.** The API key in the URL path handles authentication.

If Claude.ai shows OAuth or header configuration fields, you can leave them empty - authentication is handled via the URL.

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
- URL includes your API key after `/mcp/`
- API key is valid (created via admin script)
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

## Multi-User Data Isolation

The server supports multiple users, each with their own isolated data:

- **Each API key** is tied to a specific user
- **Data isolation**: You can only access context entries created with your API key
- **No cross-user access**: User A cannot see User B's data, even if they know the keys

This means:
- Different team members can each have their own shared context
- Each person uses their own API key in their Claude.ai connector
- Complete privacy between users

## Troubleshooting

### "Tool not found" or "No tools available"

- Verify the connector is enabled
- Check the URL includes `/mcp/YOUR_API_KEY`
- Test the health endpoint: `curl https://your-app.up.railway.app/health`

### "Invalid API key" or "Authentication failed"

- Verify your API key is correct (it was shown only once when created)
- The API key must be in the URL path: `/mcp/YOUR_API_KEY`
- If you lost your key, create a new user: `npx tsx scripts/create-user.ts`

### "Not authenticated"

- The API key in the URL may be invalid
- Create a new API key using the admin script
- Check Railway logs for authentication errors

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

### Can't see data from another conversation

- Make sure you're using the same API key in both conversations
- Each API key has its own isolated data store
- Check that the write operation succeeded (look for confirmation)

## Viewing Audit History

To see all changes made to your shared context:

1. Connect to your Railway PostgreSQL database
2. Run this query (replace `your_user_id` with your actual user ID):

```sql
SELECT key, action, changed_at,
       LEFT(content, 50) as content_preview
FROM context_history
WHERE user_id = 'your_user_id'
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
- `config.preferences` (but don't store actual secrets!)

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
- **API key security**: Keep your API key secret - anyone with it can access your data
- **Content limits**: Max 100KB per entry, max 255 char keys
- **Audit trail**: All changes are logged in `context_history` with your user ID
- **Data isolation**: Your data is completely isolated from other users
