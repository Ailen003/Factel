import "server-only";

import { Client } from "pg";

export type CredentialMutationLock = {
  release: () => Promise<void>;
};

/**
 * Holds a PostgreSQL session advisory lock for the complete Better Auth
 * password mutation. Unlike a transaction-scoped lock, this lock is not
 * released when a Prisma interactive transaction reaches its timeout.
 */
export async function tryAcquireCredentialMutationLock(
  targetUserId: string,
): Promise<CredentialMutationLock | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured before locking credentials");
  }

  const client = new Client({
    connectionString,
    application_name: "talk-flow-credential-mutation",
  });
  await client.connect();

  try {
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1::text, 0)) AS acquired",
      [targetUserId],
    );
    if (result.rows[0]?.acquired !== true) {
      await client.end();
      return null;
    }

    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        try {
          await client.query(
            "SELECT pg_advisory_unlock(hashtextextended($1::text, 0))",
            [targetUserId],
          );
        } finally {
          // Closing the dedicated session also releases the advisory lock if
          // the explicit unlock query failed.
          await client.end();
        }
      },
    };
  } catch (error) {
    await client.end();
    throw error;
  }
}
