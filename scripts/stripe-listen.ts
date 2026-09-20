import { spawn } from "node:child_process";

/**
 * Starts `stripe listen`, forwarding webhooks to the local dev server.
 *
 * This exists as a script rather than a plain npm command because of Windows.
 * npm runs scripts through `cmd.exe`, which treats commas as argument
 * delimiters — so a `--events a,b,c` list written directly in package.json
 * arrives at the CLI as `--events "a b c"`, one nonsense event name, and
 * nothing is ever forwarded. It fails silently: the listener starts, prints a
 * signing secret, and simply never delivers anything.
 *
 * Spawning with an explicit argument array bypasses shell parsing entirely, so
 * the list survives intact on every platform.
 */

/** Exactly the events `src/app/api/webhooks/stripe/route.ts` acts on. */
const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

const PORT = process.env.PORT ?? "3000";
const FORWARD_TO = `localhost:${PORT}/api/webhooks/stripe`;

const args = ["listen", "--forward-to", FORWARD_TO, "--events", EVENTS.join(",")];

console.log(`\nForwarding ${EVENTS.length} event types to ${FORWARD_TO}`);
console.log("Copy the whsec_… below into STRIPE_WEBHOOK_SECRET in .env.local,");
console.log("then restart the dev server (Next.js reads env files at boot).\n");

// `shell: true` on Windows so the `stripe` shim (a .ps1/.cmd wrapper from the
// npm install) is resolvable; the arguments are still passed as an array, so
// no comma-splitting occurs.
const child = spawn("stripe", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("error", (error) => {
  console.error(
    `\nCould not start the Stripe CLI: ${error.message}\n` +
      `Install it with: npm install -g @stripe/cli   (then: stripe login)\n`,
  );
  process.exit(1);
});

child.on("exit", (code) => process.exit(code ?? 0));
