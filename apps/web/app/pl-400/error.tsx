"use client";

/**
 * Route-level error boundary: a client-side exception must never strand the
 * learner (or a judge) on Next's bare error page. Offers retry and a
 * session-data reset — corrupted persisted state is the most likely
 * self-healing cause.
 */
export default function Pl400Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const handleResetSession = () => {
    try {
      window.localStorage.removeItem("mastery-gate:v1");
    } catch {
      // storage unavailable — nothing to clear
    }
    window.location.reload();
  };

  return (
    <main style={{ maxWidth: "42rem", margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1>Something broke on this page</h1>
      <p>
        The lesson engine hit an unexpected error. The details are in the
        browser console{error.digest ? ` (digest ${error.digest})` : ""}.
      </p>
      <p style={{ display: "flex", gap: "0.75rem" }}>
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
        <button type="button" onClick={handleResetSession}>
          Reset session data and reload
        </button>
      </p>
    </main>
  );
}
