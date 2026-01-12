#!/usr/bin/env npx tsx
/**
 * Admin script to create a new user with an API key
 *
 * Usage:
 *   npx tsx scripts/create-user.ts <user_id> <email>
 *
 * Example:
 *   npx tsx scripts/create-user.ts testuser test@example.com
 *
 * Output:
 *   Creates the user and generates an API key
 *   The API key is shown ONLY ONCE - save it immediately!
 *
 * Requirements:
 *   - DATABASE_URL environment variable
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import crypto from 'crypto';

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: npx tsx scripts/create-user.ts <user_id> <email>');
  console.error('Example: npx tsx scripts/create-user.ts testuser test@example.com');
  process.exit(1);
}

const [userId, email] = args;

// Validate user ID format
if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
  console.error('Error: user_id must contain only alphanumeric characters, underscores, and hyphens');
  process.exit(1);
}

// Validate email format (basic)
if (!email.includes('@')) {
  console.error('Error: Invalid email format');
  process.exit(1);
}

function generateApiKey(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hashApiKey(plainKey: string): string {
  return crypto.createHash('sha256').update(plainKey).digest('hex');
}

async function createUser(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (existingUser.rows.length > 0) {
      console.error(`Error: User '${userId}' already exists`);
      await client.query('ROLLBACK');
      process.exit(1);
    }

    // Check if email already exists
    const existingEmail = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingEmail.rows.length > 0) {
      console.error(`Error: Email '${email}' is already in use`);
      await client.query('ROLLBACK');
      process.exit(1);
    }

    // Create user
    await client.query(
      `INSERT INTO users (id, email, auth_provider, created_at, updated_at)
       VALUES ($1, $2, 'manual', NOW(), NOW())`,
      [userId, email]
    );

    // Generate and store API key
    const plainKey = generateApiKey();
    const keyHash = hashApiKey(plainKey);

    await client.query(
      `INSERT INTO api_keys (key_hash, user_id, name, created_at)
       VALUES ($1, $2, 'default', NOW())`,
      [keyHash, userId]
    );

    await client.query('COMMIT');

    console.log('\n=== User created successfully! ===\n');
    console.log(`User ID: ${userId}`);
    console.log(`Email: ${email}`);
    console.log(`\nAPI Key (SAVE THIS - shown only once!):`);
    console.log(`\n  ${plainKey}\n`);
    console.log(`MCP URL format: https://your-server.railway.app/mcp/${plainKey}`);
    console.log('\nTo test locally:');
    console.log(`  curl -X POST http://localhost:3000/mcp/${plainKey} \\`);
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"jsonrpc":"2.0","id":1,"method":"tools/list"}\'');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating user:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createUser().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
