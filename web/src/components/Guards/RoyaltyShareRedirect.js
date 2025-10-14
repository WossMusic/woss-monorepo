import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Lightweight guard:
 * - If user role === "Royalty Share" -> redirect to /app/portal/splits
 * - Else render children
 *
 * Tries localStorage first (instant), then falls back to a profile fetch.
 */
export default function RoyaltyShareRedirect({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [decided, setDecided] = React.useState(false);
  const [redirecting, setRedirecting] = React.useState(false);

  const goSplits = React.useCallback(() => {
    if (redirecting) return;
    setRedirecting(true);
    navigate("/app/portal/splits", { replace: true, state: { from: location.pathname } });
  }, [navigate, location.pathname, redirecting]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      // 1) Try localStorage (fast path)
      try {
        const raw = localStorage.getItem("woss_user");
        if (raw) {
          const u = JSON.parse(raw);
          const role = String(u?.role || "").trim().toLowerCase();
          if (role === "royalty share") {
            if (!cancelled) goSplits();
            return;
          }
        }
      } catch {
        /* ignore */
      }

      // 2) Fallback to profile (authoritative)
      try {
        const token = localStorage.getItem("woss_token") || "";
        if (!token) {
          // not logged; let router handle elsewhere
          if (!cancelled) setDecided(true);
          return;
        }
        const r = await fetch("http://localhost:4000/api/auth/profile/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        const role = String(j?.profile?.role || "").trim().toLowerCase();
        if (!cancelled) {
          if (role === "royalty share") {
            goSplits();
          } else {
            setDecided(true);
          }
        }
      } catch {
        if (!cancelled) setDecided(true);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [goSplits]);

  // while deciding (and maybe redirecting), render nothing to avoid flicker
  if (!decided) return null;

  return <>{children}</>;
}
