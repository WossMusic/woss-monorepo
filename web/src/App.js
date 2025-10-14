// src/App.js
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  Outlet,
} from "react-router-dom";

/* Public pages */
import Index from "./pages/Index";
import Contact from "./pages/Contact";

/* Auth */
import Register from "./views/auth/Register";
import Login from "./views/auth/Login";
import PendingVerification from "./views/auth/PendingVerification";
import ForgotPassword from "./views/auth/ForgotPassword";
import NewPassword from "./views/auth/NewPassword";
import AuthLayout from "layouts/Auth.js";

/* Context */
import { MonthProvider } from "./components/Custom/MonthContext";

/* Portal */
import Catalog from "./views/portal/Catalog";
import NewRelease from "./views/portal/NewRelease";
import Accounting from "./views/portal/Accounting"; // <-- ensure path is correct

/* Admin */
import AdminPanel from "./views/admin/AdminPanel";

/* Allowlist helper */
import { isPathAllowed } from "./utils/allowlist";

/* ---- Token helpers ---- */
function decodeJwt(token) {
  try {
    const payload = JSON.parse(atob(String(token).split(".")[1] || ""));
    return payload && typeof payload === "object" ? payload : null;
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

function getUserRole() {
  const t = localStorage.getItem("woss_token");
  const p = decodeJwt(t);
  return String(p?.role || "").toLowerCase();
}

/* ---- Route guards / helpers ---- */
function RequireAuth() {
  const ok = isTokenValid();
  const loc = useLocation();
  return ok ? <Outlet /> : <Navigate to="/auth/login" replace state={{ from: loc }} />;
}

function RequireAdmin() {
  const ok = isTokenValid();
  const loc = useLocation();
  if (!ok) return <Navigate to="/auth/login" replace state={{ from: loc }} />;
  const role = getUserRole();
  const isAdmin = role === "admin" || role === "super admin";
  return isAdmin ? <Outlet /> : <Navigate to="/app/portal/catalog" replace />;
}

/** If signed in already, route to the right home:
 *  Royalty Share → /app/portal/splits
 *  Others → /app/portal/catalog
 */
function LoginGate({ children }) {
  const ok = isTokenValid();
  if (!ok) return children;
  const role = getUserRole();
  const dest = role === "royalty share" ? "/app/portal/splits" : "/app/portal/catalog";
  return <Navigate to={dest} replace />;
}

/** /app landing pick based on role */
function AppHomeRedirect() {
  const role = getUserRole();
  const dest = role === "royalty share" ? "/app/portal/splits" : "/app/portal/catalog";
  return <Navigate to={dest} replace />;
}

/** Block Royalty Share from Catalog; send to Splits */
function CatalogGate({ children }) {
  const role = getUserRole();
  if (role === "royalty share") {
    return <Navigate to="/app/portal/splits" replace />;
  }
  return children;
}

/** ✅ Allowlist gate for any /app/* path based on RBAC routes */
function AllowRoutesGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const raw = localStorage.getItem("rbac_allowed_routes");
  const allowedRoutes = raw ? JSON.parse(raw) : [];
  const homeRoute = localStorage.getItem("rbac_home_route") || "/app/portal/splits/receive-from";

  useEffect(() => {
    // Only guard inside /app
    if (!location.pathname.startsWith("/app")) return;
    const ok = isPathAllowed(location.pathname, allowedRoutes);
    if (!ok) navigate(homeRoute, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return <Outlet />;
}

export default function App() {
  return (
    <MonthProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Index />} />
          <Route path="/contact" element={<Contact />} />

          {/* Auth (public) */}
          <Route
            path="/auth/login"
            element={
              <AuthLayout>
                <LoginGate>
                  <Login />
                </LoginGate>
              </AuthLayout>
            }
          />
          <Route
            path="/auth/register"
            element={
              <AuthLayout>
                <Register />
              </AuthLayout>
            }
          />
          <Route
            path="/auth/pending"
            element={
              <AuthLayout>
                <PendingVerification />
              </AuthLayout>
            }
          />
          <Route
            path="/auth/forgot-password"
            element={
              <AuthLayout>
                <ForgotPassword />
              </AuthLayout>
            }
          />
          <Route
            path="/auth/new-password/:token"
            element={
              <AuthLayout>
                <NewPassword />
              </AuthLayout>
            }
          />

          {/* ---------- Guarded APP area ---------- */}
          <Route path="/app" element={<RequireAuth />}>
            {/* Wrap ALL /app routes with the allowlist gate */}
            <Route element={<AllowRoutesGate />}>
              {/* default -> role-based home */}
              <Route index element={<AppHomeRedirect />} />

              {/* Portal */}
              <Route
                path="portal/catalog"
                element={
                  <CatalogGate>
                    <Catalog />
                  </CatalogGate>
                }
              />

              {/* ✅ Explicit Accounting routes for deep links */}
              <Route path="portal/accounting" element={<Accounting />} />
              <Route path="portal/accounting/:tab" element={<Accounting />} />

              {/* Canonical editor routes */}
              <Route path="portal/catalog/core-info/:publicId" element={<NewRelease />} />
              <Route path="portal/catalog/tracks/:publicId" element={<NewRelease />} />
              <Route path="portal/catalog/tracks/:publicId/track/:trackId" element={<NewRelease />} />
              <Route path="portal/catalog/scheduling/:publicId" element={<NewRelease />} />
              <Route path="portal/catalog/review/:publicId" element={<NewRelease />} />

              {/* Back-compat deep links */}
              <Route path="portal/catalog/core-info/:publicId/tracks" element={<NewRelease />} />
              <Route path="portal/catalog/core-info/:publicId/track/:trackId" element={<NewRelease />} />
              <Route path="portal/catalog/core-info/:publicId/scheduling" element={<NewRelease />} />
              <Route path="portal/catalog/core-info/:publicId/review" element={<NewRelease />} />

              {/* Legacy slug editor */}
              <Route path="portal/new-release/:slug" element={<NewRelease />} />
              <Route path="portal/new-release/:slug/tracks" element={<NewRelease />} />
              <Route path="portal/new-release/:slug/track/:trackId" element={<NewRelease />} />
              <Route path="portal/new-release/:slug/scheduling" element={<NewRelease />} />
              <Route path="portal/new-release/:slug/review" element={<NewRelease />} />

              {/* ---------- Admin (guarded by admin role) ---------- */}
              <Route path="admin" element={<RequireAdmin />}>
                <Route index element={<AdminPanel />} />
                <Route path="user-permissions" element={<AdminPanel />} />
                <Route path="approve-release" element={<AdminPanel />} />
                <Route path="approve-user" element={<AdminPanel />} />
                <Route path="send-invite" element={<AdminPanel />} />
                <Route path="royalties" element={<AdminPanel />} />
                <Route path="transfer-releases" element={<AdminPanel />} />
              </Route>

              {/* Unknown under /app -> role-based home */}
              <Route path="*" element={<AppHomeRedirect />} />
            </Route>
          </Route>

          {/* Fallback — anything else -> login */}
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Router>
    </MonthProvider>
  );
}
