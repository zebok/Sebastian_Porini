"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F9F9F7",
          fontFamily: "system-ui, sans-serif",
          flexDirection: "column",
          gap: "1.5rem",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: "#1A1A18",
            margin: 0,
          }}
        >
          Critical error
        </h1>
        <p style={{ color: "#6B6B65", margin: 0 }}>
          Something went deeply wrong. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.65rem 1.5rem",
            backgroundColor: "#2D5BE3",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
