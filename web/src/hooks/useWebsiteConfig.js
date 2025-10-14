// web/src/hooks/useWebsiteConfig.js
import { useState, useEffect } from "react";

/* ---------- helpers ---------- */
const trim = (s) => String(s ?? "").trim();
const noTrail = (s) => trim(s).replace(/\/+$/, "");

/** Resolve the API base:
 *  1) build-time env: REACT_APP_API_BASE (recommended on Vercel)
 *  2) optional runtime global: window.__WOSS_API_BASE
 *  3) fallback: same-origin (assumes a reverse proxy at /api)
 */
function resolveApiBase() {
  const envBase = noTrail(process.env.REACT_APP_API_BASE || "");
  const runtimeBase =
    typeof window !== "undefined" ? noTrail(window.__WOSS_API_BASE || "") : "";
  return envBase || runtimeBase || ""; // empty means same-origin fallback
}

export default function useWebsiteConfig() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const base = resolveApiBase();
    const url = base ? `${base}/api/website/config` : `/api/website/config`;
    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          cache: "no-store",
          // credentials: "include", // <- only if your API uses cookies here
          mode: "cors",
        });

        // If CORS blocks, surface a clearer hint
        if (!res.ok) {
          console.error(
            `Website config request failed (${res.status}).`,
            `URL: ${url}`,
            `Tip: ensure CORS allows ${typeof window !== "undefined" ? window.location.origin : ""} on the API.`
          );
        }

        const data = await res.json().catch(() => ({}));
        if (data?.success && data?.config) {
          const domain = noTrail(data.config.domain || base || "");
          setConfig({ ...data.config, domain });
        } else {
          console.error("Website config: unexpected payload", data);
        }
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("Website config: fetch failed", err, "URL:", url);
        }
      }
    })();

    return () => ctrl.abort();
  }, []);

  return config;
}
