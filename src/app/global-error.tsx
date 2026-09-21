"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself.
 *
 * It replaces the whole document, so the app's stylesheet and fonts are not
 * loaded — which is why the styling here is inline. Colours are the same ink
 * and paper values as the design tokens in globals.css, so even a total failure
 * still looks like this product rather than a browser default.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f7efdd",
          color: "#1b1714",
          fontFamily: "system-ui, sans-serif",
          padding: "20px",
        }}
      >
        <title>Something went wrong · Digital Heroes</title>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, textTransform: "uppercase", margin: "0 0 12px" }}>
            Something went wrong.
          </h1>
          <p style={{ color: "#55493e", lineHeight: 1.5, margin: "0 0 20px" }}>
            The page could not be loaded. Please try again in a moment.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#8a7a6a" }}>
              ref {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 12,
              padding: "12px 24px",
              background: "#e2571f",
              color: "#f7efdd",
              border: "2px solid #1b1714",
              borderRadius: 12,
              boxShadow: "2px 2px 0 0 #1b1714",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
