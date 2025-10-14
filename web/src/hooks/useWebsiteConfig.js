// web/src/hooks/useWebsiteConfig.js
import { useState, useEffect } from "react";

const trim = (s) => String(s ?? "").trim();
const noTrail = (s) => trim(s).replace(/\/+$/, "");

/* Resolve API base from build-time env or optional runtime override */
function resolveApiBase() {
  const envBase = noTrail(process.env.REACT_APP_API_BASE || "");
  const runtimeBase =
    typeof window !== "undefined" ? noTrail(window.__WOSS_API_BASE || "") : "";
  return envBase || runtimeBase || "";
}

/* Helper to fetch JSON with consistent options */
async function fetchJson(url, signal) {
  const res = await fetch(url, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json().catch(() => ({}));
}

export default function useWebsiteConfig() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const base = resolveApiBase();
    // Prefer /api/... first, then fallback to non-/api (absolute or relative)
    const primary = base ? `${base}/api/website/config` : `/api/website/config`;
    const fallback = base ? `${base}/website/config` : `/website/config`;

    const ctrl = new AbortController();

    (async () => {
      try {
        let data;
        let used = "primary";
        try {
          data = await fetchJson(primary, ctrl.signal);
        } catch (err) {
          console.warn(`[useWebsiteConfig] Primary failed (${primary}). Trying fallback…`, err);
          used = "fallback";
          data = await fetchJson(fallback, ctrl.signal);
        }

        if (data?.success && data?.config) {
          const domain = noTrail(data.config.domain || base || "");
          setConfig({ ...data.config, domain });
          console.info(`[useWebsiteConfig] Loaded (${used})`, used === "primary" ? primary : fallback);
        } else {
          console.error("[useWebsiteConfig] Unexpected payload:", data);
        }
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("[useWebsiteConfig] fetch failed:", err, "URLs:", { primary, fallback });
        }
      }
    })();

    return () => ctrl.abort();
  }, []);

  return config;
}
