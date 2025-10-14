import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function AccessDenied({ role, pageName, onGoto }) {
  return (
    <div className="py-6 text-center">
      <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>🔒</div>
      <h3>Access restricted</h3>
      <p className="text-muted">
        Your account role ({role || "unknown"}) doesn’t have access to {pageName}.
      </p>
      <button className="btn btn-primary" onClick={onGoto}>
        Go to Splits
      </button>
    </div>
  );
}

/**
 * RequirePerm (with DEBUG LOGS)
 * - Reads /auth/profile/me (role)
 * - Reads /rbac/sections (role → sections)
 * - Tries /auth/permissions or /permissions (map { "split.view": true })
 * - Final decision prints ALLOWED/DENIED + reason
 *
 * SPECIAL FLOORS:
 *   - Allow Royalty Share to access Splits even if split.view missing
 *   - Allow Royalty Share to access Accounting (all tabs)
 */
export default function RequirePerm({
  children,
  keys,
  fallback = "/app/portal/splits",
  pageName = "this page",
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const required = useMemo(() => {
    if (!keys) return [];
    return Array.isArray(keys)
      ? keys
      : String(keys)
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
  }, [keys]);

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [debug, setDebug] = useState({
    path: location.pathname,
    tokenPresent: false,
    role: null,
    userId: null,
    rbacAllowedSections: [],
    permMap: null,
    checkedKeys: required,
    reason: "unknown",
    errors: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const token = localStorage.getItem("woss_token");
      const d = {
        path: location.pathname,
        tokenPresent: !!token,
        role: null,
        userId: null,
        rbacAllowedSections: [],
        permMap: null,
        checkedKeys: required,
        reason: "start",
        errors: [],
      };

      const LOG = "[RequirePerm]";
      console.groupCollapsed(
        `${LOG} route=%c${location.pathname}`,
        "color:#56BCB6;font-weight:700"
      );
      console.log(LOG, "required keys:", required);
      console.log(LOG, "token present:", !!token);

      // 1) Profile
      try {
        if (!token) throw new Error("No token");
        const r = await fetch("http://localhost:4000/api/auth/profile/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (j?.success) {
          d.role = j.profile?.role || null;
          d.userId = j.profile?.id || j.profile?.userId || null;
          console.log(LOG, "profile:", j.profile);
        } else {
          d.errors.push("profile fetch not success");
          console.warn(LOG, "profile not success:", j);
        }
      } catch (e) {
        d.errors.push(`profile error: ${e?.message || e}`);
        console.error(LOG, "profile error:", e);
      }

      // 2) RBAC sections (server-driven menu)
      try {
        if (!token) throw new Error("No token");
        const r = await fetch("http://localhost:4000/api/rbac/sections", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (j?.success) {
          d.rbacAllowedSections = Array.isArray(j.allowedSections) ? j.allowedSections : [];
          console.log(LOG, "rbac sections:", d.rbacAllowedSections);
          if (Array.isArray(j.allowedRoutes)) console.log(LOG, "rbac routes:", j.allowedRoutes);
          if (j.homeRoute) console.log(LOG, "rbac homeRoute:", j.homeRoute);
        } else {
          d.errors.push("rbac/sections not success");
          console.warn(LOG, "rbac/sections not success:", j);
        }
      } catch (e) {
        d.errors.push(`rbac/sections error: ${e?.message || e}`);
        console.error(LOG, "rbac/sections error:", e);
      }

      // 3) Permission map (optional)
      let permMap = null;
      async function tryFetch(url) {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        return r.json();
      }
      try {
        let j = await tryFetch("http://localhost:4000/api/auth/permissions");
        if (j?.success && j.permissions) {
          permMap = j.permissions;
          console.log(LOG, "permissions (auth/permissions):", permMap);
        } else {
          j = await tryFetch("http://localhost:4000/api/permissions");
          if (j?.success && j.permissions) {
            permMap = j.permissions;
            console.log(LOG, "permissions (fallback /permissions):", permMap);
          } else {
            console.warn(LOG, "no permissions endpoint returned a map");
          }
        }
      } catch (e) {
        d.errors.push(`permissions fetch error: ${e?.message || e}`);
        console.warn(LOG, "permissions fetch error:", e);
      }
      d.permMap = permMap;

      // 4) Decision
      let ok = true;
      let reason = "no keys required";
      if (required.length > 0) {
        ok = false;
        reason = "missing permission(s)";

        // A) via permission map
        if (permMap) {
          const results = required.map((k) => !!permMap[k]);
          console.log(LOG, "permMap results", { required, results });
          if (results.every(Boolean)) {
            ok = true;
            reason = "permMap satisfied";
          } else {
            reason = "permMap denied";
          }
        }

        // B) fallback via RBAC sections for Splits only (legacy safety)
        const isSplitsPage =
          d.path.includes("/portal/splits") ||
          required.includes("split.view") ||
          /splits/i.test(pageName || "");
        if (!ok && isSplitsPage) {
          const hasSplitsByRole = (d.rbacAllowedSections || []).some(
            (s) => String(s).toLowerCase() === "splits"
          );
          console.log(LOG, "fallback RBAC check for Splits:", {
            role: d.role,
            hasSplitsByRole,
          });
          if (hasSplitsByRole) {
            ok = true;
            reason = "rbac allowed (fallback)";
          }
        }

        // C) FLOOR #1: Royalty Share → Splits
        if (!ok && isSplitsPage && String(d.role || "").toLowerCase() === "royalty share") {
          ok = true;
          reason = "force-allow Royalty Share for Splits";
          console.warn(LOG, "FORCE ALLOW: Royalty Share accessing Splits while split.view missing");
        }
      }

      // D) FLOOR #2: Royalty Share → ACCOUNTING (ALL TABS)
      //    If the current route is under /portal/accounting, allow Royalty Share regardless of permMap.
      const isAccounting =
        /\/portal\/accounting(\/|$)/i.test(d.path) ||
        /accounting/i.test(pageName || "");
      if (!ok && isAccounting && String(d.role || "").toLowerCase() === "royalty share") {
        ok = true;
        reason = "force-allow Royalty Share for Accounting";
        console.warn(LOG, "FORCE ALLOW: Royalty Share accessing Accounting (all tabs)");
      }

      d.reason = reason;
      if (!cancelled) {
        setAllowed(ok);
        setDebug(d);
        setLoading(false);
      }

      console.log(
        `${LOG} result → %c${ok ? "ALLOWED" : "DENIED"}`,
        ok ? "color:#10bc6c;font-weight:700" : "color:#e55353;font-weight:700"
      );
      console.log(LOG, "reason:", reason);
      if (d.errors.length) console.warn(LOG, "errors:", d.errors);
      console.groupEnd();
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (loading) return null;

  if (!allowed) {
    const showDebug =
      process.env.NODE_ENV !== "production" || localStorage.getItem("debug_perms") === "1";

    return (
      <div className="container-fluid mt-6">
        <AccessDenied
          role={debug.role}
          pageName={pageName || location.pathname}
          onGoto={() => navigate("/app/portal/splits")}
        />
        {showDebug && (
          <pre
            style={{
              background: "#0f1414",
              border: "2px solid #56BCB6",
              color: "#fff",
              padding: 16,
              borderRadius: 10,
              fontSize: 12,
              maxWidth: 960,
              margin: "16px auto",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(debug, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
