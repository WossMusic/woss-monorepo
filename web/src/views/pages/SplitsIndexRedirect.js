// src/views/pages/SplitsIndexRedirect.jsx
import React from "react";
import { Navigate } from "react-router-dom";

/**
 * When user clicks the "Splits" menu (index route), decide their landing page:
 * - Royalty Share  → /app/portal/splits/receiving-from
 * - Others (Artist/Manager, Distributor, Admin) → /app/portal/splits/sharing-with
 */
export default function SplitsIndexRedirect() {
  const [dest, setDest] = React.useState(null); // string | null

  React.useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    async function run() {
      try {
        const token = localStorage.getItem("woss_token") || "";
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        // Try current FE origin first; if FE runs on :3000, also try :4000 backend as fallback
        const bases = (() => {
          const out = [];
          const here = window.location.origin.replace(/\/$/, "");
          out.push(here);
          if (/localhost:3000$/.test(here)) out.push("http://localhost:4000");
          return out;
        })();

        let role = "";
        let splitView = false;

        for (const base of bases) {
          try {
            const url = `${base}/api/permissions/me?keys=split.view`;
            const r = await fetch(url, {
              headers,
              credentials: "include",
              signal: ctrl.signal,
            });
            if (!r.ok) continue;
            const j = await r.json();
            role = String(j?.role || "").toLowerCase();
            splitView = !!j?.permissions?.["split.view"];
            break;
          } catch {
            /* try next base */
          }
        }

        const basePath = "/app/portal/splits";
        let target = "/app/portal/catalog";

        if (splitView) {
          target =
            role === "royalty share"
              ? `${basePath}/receiving-from`
              : `${basePath}/sharing-with`;
        }

        if (!cancelled) setDest(target);
      } catch {
        if (!cancelled) setDest("/app/portal/catalog");
      }
    }

    run();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, []);

  if (!dest) return null; // can swap for a spinner if desired
  return <Navigate to={dest} replace />;
}
