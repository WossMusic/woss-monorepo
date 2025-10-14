import React from "react";
import { useLocation, Routes, Route, Navigate } from "react-router-dom";

import AdminNavbar from "components/Navbars/AdminNavbar.js";
import AdminFooter from "components/Footers/AdminFooter.js";
import Sidebar from "components/Sidebar/Sidebar.js";
import routes from "routes.js";

/* ---------- JWT helpers ---------- */
function decodeJwt(token) {
  try {
    return JSON.parse(atob(String(token).split(".")[1] || ""));
  } catch {
    return null;
  }
}
function isTokenValid() {
  const t = localStorage.getItem("woss_token");
  if (!t) return false;
  const p = decodeJwt(t);
  if (!p?.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return now < Number(p.exp);
}

/* ---------- RBAC helpers ---------- */
const ROLE_MAP = {
  "royalty share": new Set(["Splits", "Analytics", "Accounting", "Profile", "Banking"]),
  "artist/manager": "__ALL__",
  distributor: "__ALL__",
  admin: "__ALL__",
};
const FULL_ACCESS_ROLES = new Set(["artist/manager", "distributor", "admin"]);
const norm = (s) => String(s || "").trim().toLowerCase();
const isAdminName = (n) => /(^|\s)admin(\s|$)/i.test(String(n || ""));

async function fetchJSON(url, headers) {
  const r = await fetch(url, { credentials: "include", headers });
  if (r.status === 401 || r.status === 403) {
    localStorage.removeItem("woss_token");
  }
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}

function getRoleFromJWT() {
  try {
    const token = localStorage.getItem("woss_token") || "";
    if (!token.includes(".")) return "";
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(decodeURIComponent(escape(window.atob(base64))));
    return json?.role || "";
  } catch {
    return "";
  }
}

/* ---------- Unauthorized UI ---------- */
function UnauthorizedNotice({ page, role }) {
  const accent = "#56BCB6";
  return (
    <div className="container-fluid py-6" style={{ paddingTop: 48 }}>
      <div className="row justify-content-center">
        <div className="col-lg-11 mb--4">
          <div className="card shadow border-0">
            <div className="card-body text-center" style={{ padding: "8rem 2rem" }}>
              <div
                className="mx-auto mb-4 d-flex align-items-center justify-content-center"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: accent,
                  color: "#fff",
                  fontSize: 36,
                }}
              >
                <i className="ni ni-lock-circle-open" />
              </div>
              <h2 className="mb-2" style={{ color: "#1A2120" }}>Access restricted</h2>
              <p className="text-muted mb-4" style={{ fontSize: 16 }}>
                Your account role{role ? ` (${role})` : ""} doesn’t have access to{" "}
                <strong>{page}</strong>.
              </p>
              <a
                href="/app/portal/splits"
                className="btn"
                style={{ background: accent, color: "#fff", fontWeight: 700, padding: "12px 20px", borderRadius: 8 }}
              >
                Go to Splits
              </a>
            </div>
            <div className="card-footer bg-transparent" style={{ borderTop: `3px solid ${accent}` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Per-route RBAC notice ---------- */
function RbacGuard({ name, element, rbac, requiresAdmin = false }) {
  const { loaded, allowed, role } = rbac;
  if (!loaded) return <div className="container-fluid py-6 text-center text-muted">Loading…</div>;
  if (!name) return element;

  const mustBeAdmin = requiresAdmin || isAdminName(name);
  const isAdminUser = norm(role) === "admin" || norm(role) === "super admin";
  if (mustBeAdmin && !isAdminUser) return <UnauthorizedNotice page={name} role={role} />;

  const permitted = allowed === "__ALL__" || (allowed?.has && allowed.has(name));
  return permitted ? element : <UnauthorizedNotice page={name} role={role} />;
}

function Admin() {
  /* ✅ HOOKS ARE AT THE TOP, unconditionally */
  const location = useLocation();
  const [sidenavOpen, setSidenavOpen] = React.useState(true);
  const mainContentRef = React.useRef(null);
  const authed = isTokenValid();

  const isMobile = () => window.innerWidth < 1200;

  const forceLogout = React.useCallback((reason = "role_changed") => {
    try {
      localStorage.removeItem("woss_token");
      localStorage.removeItem("mfa_trust_token");
      sessionStorage.clear();
    } catch {}
    window.location.replace(`/auth/login?reason=${encodeURIComponent(reason)}`);
  }, []);

  /* Only run these effects when authenticated */
  React.useEffect(() => {
    if (!authed) return;
    document.body.classList.remove("g-sidenav-hidden", "g-sidenav-pinned", "g-sidenav-show");
    if (isMobile()) {
      document.body.classList.add("g-sidenav-show");
      setSidenavOpen(true);
    } else {
      document.body.classList.add("g-sidenav-pinned");
      setSidenavOpen(true);
    }
  }, [authed]);

  React.useEffect(() => {
    if (!authed) return;
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
  }, [location, authed]);

  /* ---------- RBAC state ---------- */
  const [rbac, setRbac] = React.useState({ loaded: false, allowed: null, role: "" });

  React.useEffect(() => {
    if (!authed) return; // don’t fetch if not authenticated
    let cancelled = false;

    (async () => {
      const token = localStorage.getItem("woss_token") || "";
      const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

      // STEP 0: Bootstrap from JWT
      const jwtRole = getRoleFromJWT();
      const jwtRoleN = norm(jwtRole);
      if (!cancelled) {
        if (FULL_ACCESS_ROLES.has(jwtRoleN) || jwtRoleN === "super admin") {
          setRbac({ loaded: true, allowed: "__ALL__", role: jwtRole });
        } else if (jwtRoleN === "royalty share") {
          setRbac({ loaded: true, allowed: ROLE_MAP["royalty share"], role: jwtRole });
        } else {
          setRbac({
            loaded: true,
            allowed: new Set(["Splits", "Analytics", "Accounting", "Profile", "Banking"]),
            role: jwtRole,
          });
        }
      }

      // STEP 1: Authoritative role from server
      try {
        const data = await fetchJSON("/api/rbac/sections", headers);
        if (cancelled || !data?.success) throw new Error("rbac/sections failed");

        const serverRole = data.role || jwtRole;
        const serverRoleN = norm(serverRole);

        if (jwtRole && serverRole && serverRoleN !== jwtRoleN) {
          forceLogout("role_changed");
          return;
        }

        if (FULL_ACCESS_ROLES.has(serverRoleN) || serverRoleN === "super admin") {
          if (!cancelled) setRbac({ loaded: true, allowed: "__ALL__", role: serverRole });
          return;
        }

        let arr = Array.isArray(data.allowedSections) ? data.allowedSections.filter(Boolean) : [];
        if (serverRoleN === "royalty share") {
          if (!arr.includes("Profile")) arr.push("Profile");
          if (!arr.includes("Banking")) arr.push("Banking");
        }
        if (arr.length) {
          if (!cancelled) setRbac({ loaded: true, allowed: new Set(arr), role: serverRole });
          return;
        }

        const mapped = ROLE_MAP[serverRoleN];
        if (!cancelled && mapped) setRbac({ loaded: true, allowed: mapped, role: serverRole });
      } catch {
        // STEP 2: Fallback to /api/auth/profile/me
        try {
          const prof = await fetchJSON("/api/auth/profile/me", headers);
          const serverRole = prof?.profile?.role || jwtRole;
          const serverRoleN = norm(serverRole);

          if (jwtRole && serverRole && serverRoleN !== jwtRoleN) {
            forceLogout("role_changed");
            return;
          }

          if (!cancelled) {
            if (FULL_ACCESS_ROLES.has(serverRoleN) || serverRoleN === "super admin") {
              setRbac({ loaded: true, allowed: "__ALL__", role: serverRole });
            } else if (serverRoleN === "royalty share") {
              setRbac({ loaded: true, allowed: ROLE_MAP["royalty share"], role: serverRole });
            } else {
              setRbac({ loaded: true, allowed: "__ALL__", role: serverRole });
            }
          }
        } catch {
          // keep JWT-derived permissions
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed, forceLogout]);

  const visibleRoutes = routes.filter((route) => !route.hidden);

  const getRoutes = (rs) =>
    rs.map((prop, key) => {
      if (prop.collapse) return getRoutes(prop.views);
      if (prop.layout === "/app") {
        return (
          <Route
            key={key}
            path={prop.path}
            element={
              <RbacGuard
                name={prop.name}
                requiresAdmin={!!prop.requiresAdmin}
                element={prop.component}
                rbac={rbac}
              />
            }
          />
        );
      }
      return null;
    });

  const getBrandText = () => {
    for (let i = 0; i < routes.length; i++) {
      if (location.pathname.indexOf(routes[i].layout + routes[i].path) !== -1) {
        return routes[i].name;
      }
    }
    return "Brand";
  };

  const openSidenav = () => {
    document.body.classList.remove("g-sidenav-hidden", "g-sidenav-pinned", "g-sidenav-show");
    if (isMobile()) {
      document.body.classList.add("g-sidenav-show");
    } else {
      document.body.classList.add("g-sidenav-pinned");
    }
    setSidenavOpen(true);
  };
  const closeSidenav = () => {
    document.body.classList.remove("g-sidenav-pinned", "g-sidenav-show");
    document.body.classList.add("g-sidenav-hidden");
    setSidenavOpen(false);
  };
  const toggleSidenav = () => {
    if (
      document.body.classList.contains("g-sidenav-show") ||
      document.body.classList.contains("g-sidenav-pinned")
    ) {
      closeSidenav();
    } else {
      openSidenav();
    }
  };

  /* 🔐 Redirect before rendering any chrome when not authenticated */
  if (!authed) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  const getNavbarTheme = () =>
    location.pathname.indexOf("app/portal") === -1 ? "dark" : "light";

  return (
    <>
      <Sidebar
        routes={visibleRoutes}
        rbac={rbac}
        toggleSidenav={toggleSidenav}
        sidenavOpen={sidenavOpen}
        logo={{
          innerLink: "/app/portal/catalog",
          imgSrc: require("assets/img/brand/woss-white.png"),
          imgAlt: "...",
        }}
      />
      <div className="main-content" ref={mainContentRef}>
        <AdminNavbar
          theme={getNavbarTheme()}
          toggleSidenav={toggleSidenav}
          sidenavOpen={sidenavOpen}
          brandText={getBrandText(location.pathname)}
        />
        <Routes>
          {getRoutes(routes)}
          <Route path="*" element={<Navigate to="/app/portal/catalog" replace />} />
        </Routes>
        <AdminFooter />
      </div>
      {sidenavOpen ? <div className="backdrop d-xl-none" onClick={toggleSidenav} /> : null}
    </>
  );
}

export default Admin;
