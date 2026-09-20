import { config } from "dotenv";

/**
 * Loads .env.local for scripts that run outside Next.js.
 *
 * This must be a module whose only job is the side effect, imported *first* by
 * any standalone script. Calling `dotenv.config()` inline at the top of a
 * script does not work: ES module imports are hoisted and evaluated before any
 * statement in the importing file runs, so `@/lib/env` would parse a still-empty
 * `process.env` and throw before the call was ever reached.
 *
 * Next.js loads .env.local itself, so the app never needs this.
 */
config({ path: [".env.local", ".env"], quiet: true });
