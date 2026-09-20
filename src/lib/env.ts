import { z } from "zod";

/**
 * Server environment validation.
 *
 * Parsed once, at first import, so a missing or malformed variable fails loudly
 * at boot with the variable's name — rather than surfacing later as a confusing
 * runtime error deep inside Stripe or the database driver.
 *
 * Only import this from server code. Client components must reference
 * `process.env.NEXT_PUBLIC_*` literally, because Next.js inlines those at build
 * time and cannot substitute a dynamic lookup.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Used to derive session token hashes. Must be long enough to be unguessable. */
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Stripe is optional at boot so the app still runs before keys are added;
  // the payment routes check for it explicitly and fail with a clear message.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  /** ISO 4217 code. All stored amounts are in this currency's minor unit. */
  NEXT_PUBLIC_CURRENCY: z.string().length(3).default("EUR"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Copy .env.example to .env.local and fill in the missing values.`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();

/** True when Stripe is fully configured for server-side calls. */
export const isStripeConfigured = Boolean(env.STRIPE_SECRET_KEY);
