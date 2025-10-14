import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Container, Row, Col } from "reactstrap";
import useWebsiteConfig from "hooks/useWebsiteConfig";

/* Read maintenance map safely */
function readMaint() {
  try {
    return JSON.parse(localStorage.getItem("maintenance_pages") || "{}");
  } catch {
    return {};
  }
}
const isMaintOn = (key) => !!readMaint()[String(key).toLowerCase()];

function SplitHeader({ hideActions = false }) {
  const navigate = useNavigate();

  const [, setRole] = React.useState("");
  const [canCreate, setCanCreate] = React.useState(false);

  // watch maintenance flag (updates if localStorage changes)
  const [maintOn, setMaintOn] = React.useState(() => isMaintOn("splits"));
  React.useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "maintenance_pages") setMaintOn(isMaintOn("splits"));
    };
    window.addEventListener("storage", onStorage);
    // small polling fallback for same-tab updates
    const id = setInterval(() => setMaintOn(isMaintOn("splits")), 1000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(id);
    };
  }, []);

  const config = useWebsiteConfig();
  const BASE = React.useMemo(() => {
    const d = (config?.domain || "").replace(/\/$/, "");
    if (d) return d;
    const { protocol, host } = window.location;
    return `${protocol}//${host}`;
  }, [config]);

  React.useEffect(() => {
    let cancelled = false;
    const log = (...a) => console.log("%c[SplitHeader]", "color:#56BCB6", ...a);

    (async () => {
      const token = localStorage.getItem("woss_token") || "";
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      try {
        const ping = await fetch(`${BASE}/api/admin/ping`, {
          credentials: "include",
          headers,
        });
        if (ping.ok) {
          const pj = await ping.json();
          if (!cancelled && pj?.ok) setRole("Admin");
        }
      } catch {}

      try {
        const r = await fetch(
          `${BASE}/api/permissions/me?keys=split.create,splits.create`,
          { credentials: "include", headers }
        );
        if (r.ok) {
          const j = await r.json();
          const p = j?.permissions || {};
          const allowed = !!p["split.create"] || !!p["splits.create"];
          if (!cancelled) {
            setRole((prev) => prev || j?.role || "");
            setCanCreate(allowed);
            log(
              "role:",
              j?.role,
              "| split.create:",
              !!p["split.create"],
              "| splits.create:",
              !!p["splits.create"],
              "| canCreate:",
              allowed
            );
          }
          return;
        } else {
          log("permissions/me not ok:", r.status);
        }
      } catch (e) {
        log("permissions/me failed:", e?.message || e);
      }

      if (!cancelled) setCanCreate(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [BASE]);

  const handleNewSplitClick = () => navigate("/app/portal/splits/new-split");

  // final visibility: parent can force-hide via prop OR maintenance flag hides it
  const hide = hideActions || maintOn;

  return (
    <div className="header pb-6">
      <Container fluid>
        <div className="header-body">
          <Row className="align-items-center py-4">
            <Col lg="6" xs="6">
              <h6 className="h1 d-inline-block mb-0 mr-2">
                <i className="fa fa-users" /> Splits
              </h6>
            </Col>

            {!hide && (
              <Col className="mt-2 mt-md-0 text-md-right" lg="6" xs="6">
                {canCreate && (
                  <Button
                    className="btn-icon"
                    color="primary"
                    type="button"
                    onClick={handleNewSplitClick}
                  >
                    <span className="btn-inner--text">
                      <i className="fa fa-user-plus" /> New Split
                    </span>
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

export default SplitHeader;
