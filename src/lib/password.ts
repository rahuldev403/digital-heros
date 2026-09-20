import bcrypt from "bcryptjs";

/**
 * Password hashing.
 *
 * bcrypt with a work factor of 12 — roughly 250ms per hash on current hardware,
 * which is slow enough to make offline cracking expensive and fast enough that
 * a login request does not feel sluggish. Chosen over argon2 because bcryptjs
 * is pure JavaScript: it needs no native build step, so it works identically on
 * this Windows machine, in CI, and in Vercel's serverless runtime.
 */
const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a password against a stored hash.
 *
 * bcrypt.compare is constant-time with respect to the hash, so it does not leak
 * how much of a guess was correct.
 */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Burns roughly one hash's worth of time.
 *
 * Called on login when the email does not exist. Without it, a missing account
 * returns noticeably faster than a wrong password, which lets an attacker
 * enumerate who has an account here — and membership of a paid golf-charity
 * platform is not something users have agreed to make public.
 */
export async function fakePasswordCheck(): Promise<void> {
  await bcrypt.compare(
    "not-a-real-password",
    "$2b$12$C6UzMDM.H6dfI/f/IKcEe.7FuoVX3RAqnZ7kCEDTGP8zC7ZNCJzKa",
  );
}
