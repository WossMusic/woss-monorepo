<<<<<<< Updated upstream
// web/src/hooks/useWebsiteConfig.js
=======
>>>>>>> Stashed changes
import { useState, useEffect } from "react";
import { API_BASE } from "../apiBase";

const strip = (s) => String(s || "").trim().replace(/\/+$/, "");

const trim = (s) => String(s || "").trim();
const withoutTrailingSlash = (s) => trim(s).replace(/\/+$/, "");

// Resolve API base (no hardcoded localhost)
function resolveApiBase() {
  // 1) Primary: build-time env (Vercel → Project → Env Vars)
  const envBase = trim(process.env.REACT_APP_API_BASE);

  // 2) Optional runtime override (you can set this in a <script> tag if needed)
  const runtimeBase = typeof window !== "undefined" ? trim(window.__WOSS_API_BASE) : "";

  // Use whichever is set; otherwise leave empty (we’ll fallback to a relative path)
  return withoutTrailingSlash(envBase || runtimeBase || "");
}

const useWebsiteConfig = () => {
  const [config, setConfig] = useState(null);

  useEffect(() => {
<<<<<<< Updated upstream
    const API_BASE = resolveApiBase();
    // If API_BASE exists, call the absolute backend; else use relative path (/api/*)
    const url = API_BASE
      ? `${API_BASE}/api/website/config`
      : `/api/website/config`;

=======
    const url = API_BASE ? `${API_BASE}/api/website/config` : `/api/website/config`;
>>>>>>> Stashed changes
    const ctrl = new AbortController();

    (async () => {
      try {
<<<<<<< Updated upstream
        const res = await fetch(url, {
          signal: ctrl.signal,
          cache: "no-store",
          // credentials: "include", // uncomment if your API uses cookies for this route
        });
        const data = await res.json().catch(() => ({}));
        if (data?.success && data?.config) {
          // If backend didn’t provide its domain, inject the base we used
          const domain = data.config.domain || API_BASE || "";
          setConfig({ ...data.config, domain: withoutTrailingSlash(domain) });
        } else {
          console.error("Website config endpoint returned unexpected payload:", data);
        }
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("Error loading website config:", err);
        }
=======
        const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (data?.success && data?.config) {
          const domain = data.config.domain || API_BASE || "";
          setConfig({ ...data.config, domain: strip(domain) });
        } else {
          console.error("Website config returned unexpected payload:", data);
        }
      } catch (err) {
        if (err?.name !== "AbortError") console.error("Error loading website config:", err);
>>>>>>> Stashed changes
      }
    })();

    return () => ctrl.abort();
  }, []);

  return config;
};

export default useWebsiteConfig;
