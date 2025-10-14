// web/src/hooks/useWebsiteConfig.js
import { useState, useEffect } from "react";

const trim = (s) => String(s ?? "").trim();
const withoutTrailingSlash = (s) => trim(s).replace(/\/+$/, "");

// Resolve API base (build-time via REACT_APP_API_BASE, or optional runtime override)
function resolveApiBase() {
  const envBase = trim(process.env.REACT_APP_API_BASE);
  const runtimeBase =
    typeof window !== "undefined" ? trim(window.__WOSS_API_BASE) : "";
  return withoutTrailingSlash(envBase || runtimeBase || "");
}

const useWebsiteConfig = () => {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const base = resolveApiBase();
    const url = base ? `${base}/api/website/config` : `/api/website/config`;
    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (data?.success && data?.config) {
          const domain = withoutTrailingSlash(data.config.domain || base || "");
          setConfig({ ...data.config, domain });
        } else {
          console.error("Website config: unexpected payload", data);
        }
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("Website config: fetch failed", err);
        }
      }
    })();

    return () => ctrl.abort();
  }, []);

  return config;
};

export default useWebsiteConfig;
