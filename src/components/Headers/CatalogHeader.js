// src/components/Headers/CatalogHeader.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Breadcrumb, Container, Button, Row, Col } from "reactstrap";
import useWebsiteConfig from "hooks/useWebsiteConfig";

/* Maintenance seed (hide actions if this page is gated) */
function isMaintOn(pageKey) {
  try {
    const map = JSON.parse(localStorage.getItem("maintenance_pages") || "{}");
    return !!map[String(pageKey).toLowerCase()];
  } catch {
    return false;
  }
}

function CatalogHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projectName, setProjectName] = useState("");
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [canCreate, setCanCreate] = useState(false);

  // hide header actions if "my-project" is under maintenance
  const hideActions = isMaintOn("my-project");

  const config = useWebsiteConfig();

  // Resolve API base like AdminPanel (robust + dev-friendly)
  const API_BASE = useMemo(() => {
    const env = String(process.env.REACT_APP_API || "").trim().replace(/\/$/, "");
    if (env) return env;

    const fromConfig = String(
      config?.apiBase || config?.backend || config?.api_url || config?.api || ""
    )
      .trim()
      .replace(/\/$/, "");
    if (fromConfig) return fromConfig;

    const { protocol, hostname, port } = window.location;
    if (port === "3000") return `${protocol}//${hostname}:4000`;
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }, [config]);

  const api = useCallback(
    (path) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`,
    [API_BASE]
  );

  // Robust JSON parser (handles HTML error pages gracefully)
  const safeJson = useCallback(async (resp) => {
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) return resp.json();
    const text = await resp.text();
    throw new Error(
      `Non-JSON response (${resp.status} ${resp.statusText}). First 120 chars: ${text.slice(0, 120)}`
    );
  }, []);

  // Load project name
  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("woss_token") || "";
        if (!token) return;

        const res = await fetch(api("/api/auth/profile/me"), {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          credentials: "include",
        });

        if (!res.ok) return;

        const data = await safeJson(res);
        if (!cancelled && data?.success) {
          setProjectName(data.profile?.project_name || "");
        }
      } catch (error) {
        console.error("Error fetching project name:", error);
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [api, safeJson]);

  // Fetch permission to gate "+ New Release"
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = localStorage.getItem("woss_token") || "";
        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const r = await fetch(api("/api/permissions/me?keys=release.create"), {
          credentials: "include",
          headers,
        });

        if (!r.ok) {
          if (!cancelled) setCanCreate(false);
          return;
        }

        const j = await safeJson(r);
        if (!cancelled) {
          const allowed = !!j?.permissions?.["release.create"];
          setCanCreate(allowed);
        }
      } catch {
        if (!cancelled) setCanCreate(false);
      } finally {
        if (!cancelled) setLoadingPerms(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, safeJson]);

  // robust navigate helper: try SPA navigate first, then hard redirect if needed
  const navGuardRef = useRef(null);
  const robustNavigate = useCallback(
    (to) => {
      // cancel any previous guard
      if (navGuardRef.current) clearTimeout(navGuardRef.current);

      const before = location.pathname + location.search + location.hash;
      navigate(to);

      // If route didn't change shortly (e.g., a guard stalled it), force it.
      navGuardRef.current = setTimeout(() => {
        const after = window.location.pathname + window.location.search + window.location.hash;
        if (after === before) {
          window.location.assign(to);
        }
      }, 250);
    },
    [navigate, location.pathname, location.search, location.hash]
  );

  const handleNewReleaseClick = async () => {
    const token = localStorage.getItem("woss_token") || "";
    try {
      const res = await fetch(api("/api/user/releases"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          title: null,
          release_type: null,
          project_name: null,
        }),
      });

      if (!res.ok) return;

      const data = await safeJson(res);
      if (data.success && data.release_id) {
        localStorage.setItem("currentReleaseId", data.release_id);
        // navigate reliably
        robustNavigate("/app/portal/new-release");
      } else {
        console.error("Draft creation failed", data);
      }
    } catch (err) {
      console.error("API error:", err);
    }
  };

  return (
    <div className="header pb-6">
      <Container fluid>
        <div className="header-body">
          <Row className="align-items-center py-4">
            <Col lg="6" xs="6">
              <h6 className="h1 d-inline-block mb-0 mr-2">
                <i className="fa fa-folder" /> Catalog
              </h6>{" "}
              <Breadcrumb
                className="h1 d-none d-md-inline-block ml-md-0"
                listClassName="breadcrumb-links "
              >
                <h6 className="h1 d-inline-block mb-0 ml-0 mr-2">•</h6>
                {projectName}
              </Breadcrumb>
            </Col>

            {/* Hide the action column entirely if maintenance is active */}
            {!hideActions && (
              <Col className="mt-2 mt-md-0 text-md-right" lg="6" xs="6">
                {/* Show only if release.create is allowed */}
                {!loadingPerms && canCreate && (
                  <Button color="primary" onClick={handleNewReleaseClick}>
                    <i className="fa fa-plus" /> New Release
                  </Button>
                )}
              </Col>
            )}
          </Row>
        </div>
      </Container>
    </div>
  );
}

export default CatalogHeader;
