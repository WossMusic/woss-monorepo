/*!
=========================================================
* Woss Music Template Version 1.0
=========================================================
* Copyright 2024 Woss Music.
* Coded by Jetix Web
=========================================================
*/
import React from "react";
import { Button, Container, Row, Col } from "reactstrap";
import useWebsiteConfig from "hooks/useWebsiteConfig";

/* ---------- helpers ---------- */
function normalizeStatus(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}
const isDraftStatus = (s) => normalizeStatus(s) === "draft";

export default function NewReleaseHeader({
  onDistribute,
  onEdit,
  onUpdate,
  releaseStatus,
  isReadOnly,
  canEditAction,  // optional override from parent
}) {
  // API base (same as SplitHeader/AdminPanel)
  const config = useWebsiteConfig();
  const API_BASE = React.useMemo(() => {
    const d = String(config?.domain || "").replace(/\/$/, "");
    if (d) return d;
    const { protocol, host } = window.location;
    return `${protocol}//${host}`;
  }, [config]);

  // Permission state (NO "create" here anymore)
  const [loadingPerms, setLoadingPerms] = React.useState(true);
  const [perms, setPerms] = React.useState({
    distribute: false,
    edit: false, // covers Edit / Update / Request Edit
  });

  React.useEffect(() => {
    let cancelled = false;
    const log = (...a) => console.log("%c[NewReleaseHeader]", "color:#56BCB6", ...a);

    async function safeFetchJson(url, init) {
      const r = await fetch(url, init);
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status} ${r.statusText} — ${txt.slice(0, 160)}`);
      }
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("application/json")) {
        const txt = await r.text().catch(() => "");
        throw new Error(`Non-JSON response (content-type="${ct}") — ${txt.slice(0, 160)}`);
      }
      return r.json();
    }

    (async () => {
      try {
        const token = localStorage.getItem("woss_token") || "";
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        // Only the permissions this header cares about
        const url = `${API_BASE}/api/permissions/me?keys=release.distribute,release.edit`;
        const j = await safeFetchJson(url, { credentials: "include", headers });
        if (cancelled) return;

        const P = j?.permissions || {};
        const next = {
          distribute: !!P["release.distribute"],
          edit: !!P["release.edit"],
        };
        setPerms(next);
        log("perms:", next);
      } catch (e) {
        if (!cancelled) {
          console.warn("[NewReleaseHeader] perm fetch failed:", e?.message || e);
          setPerms({ distribute: false, edit: false });
        }
      } finally {
        if (!cancelled) setLoadingPerms(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [API_BASE]);

  // Decide intended primary action from release status
  const normalized = normalizeStatus(releaseStatus);
  const wantsEdit =
    typeof canEditAction === "boolean"
      ? canEditAction
      : normalized !== "" && normalized !== "draft";

  let intendedAction; // {kind, label, icon, onClick}
  if (!wantsEdit) {
    intendedAction = {
      kind: "distribute",
      label: "Distribute",
      icon: "fa-user-plus",
      onClick: onDistribute,
    };
  } else {
    intendedAction = isReadOnly
      ? { kind: "edit", label: "Edit Release", icon: "fa-edit", onClick: onEdit }
      : { kind: "edit", label: "Update Release", icon: "fa-save", onClick: onUpdate };
  }

  // Gate the intended action by permissions and status
  const isAllowed =
    intendedAction.kind === "distribute"
      ? perms.distribute && isDraftStatus(releaseStatus)
      : intendedAction.kind === "edit"
      ? perms.edit
      : false;

  return (
    <div className="header pb-6">
      <Container fluid>
        <div className="header-body">
          <Row className="align-items-center py-4">
            <Col
              lg="6"
              xs="12"
              className="d-flex justify-content-between align-items-center"
            >
              <h6 className="h1 d-inline-block mb-0 mr-2">
                <i className="fa fa-users"></i> New Release
              </h6>

              {/* Mobile primary action */}
              {!loadingPerms && isAllowed && (
                <Button
                  className="btn-icon d-inline-block d-sm-none"
                  color="primary"
                  onClick={intendedAction.onClick}
                >
                  <span className="btn-inner--text">
                    <i className={`fa ${intendedAction.icon}`}></i>{" "}
                    {intendedAction.label}
                  </span>
                </Button>
              )}
            </Col>

            {/* Desktop primary action */}
            <Col className="mt-2 mt-md-0 text-md-right" lg="6" xs="6">
              {!loadingPerms && isAllowed && (
                <Button
                  className="btn-icon d-none d-sm-inline-block"
                  color="primary"
                  onClick={intendedAction.onClick}
                >
                  <span className="btn-inner--text">
                    <i className={`fa ${intendedAction.icon}`}></i>{" "}
                    {intendedAction.label}
                  </span>
                </Button>
              )}
            </Col>
          </Row>
        </div>
      </Container>
    </div>
  );
}
