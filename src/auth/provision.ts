/**
 * Shared Clerk user auto-provisioning logic
 *
 * Consolidates the duplicate provisioning code from transport/http.ts
 * and api/index.ts into a single function.
 */

import { createClerkClient } from '@clerk/express';
import { getUserByClerkId, findOrProvisionClerkUser, User } from '../db/queries.js';

/**
 * Auto-provision a Clerk user in our database.
 * 1. Check if user already exists by clerk_id — return if found.
 * 2. Fetch email from Clerk API.
 * 3. Compare email to ADMIN_EMAIL (case-insensitive).
 * 4. Call findOrProvisionClerkUser to create/link the user.
 *
 * @param clerkId - The Clerk user ID (e.g. "user_abc123")
 * @returns The provisioned or existing database user
 */
export async function provisionClerkUser(clerkId: string): Promise<User> {
  // Fast path: user already exists
  const existing = await getUserByClerkId(clerkId);
  if (existing) return existing;

  // Fetch email from Clerk API
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const clerkUser = await clerk.users.getUser(clerkId);
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? `${clerkId}@clerk.user`;

  // Case-insensitive admin email comparison
  const isAdmin = !!(
    process.env.ADMIN_EMAIL &&
    email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()
  );

  const user = await findOrProvisionClerkUser(clerkId, email, isAdmin);
  console.log('[clerk] Provisioned user:', email, isAdmin ? '(admin)' : '');
  return user;
}
