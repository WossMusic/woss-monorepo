// src/views/system/MaintenancePage.js
import React from "react";
import { Container, Row, Col, Alert, Button } from "reactstrap";
import { useNavigate } from "react-router-dom";

/** Map maintenance keys -> friendly labels shown to users */
function labelFromKey(key = "") {
  const k = String(key).toLowerCase();
  const map = {
    // Core/portal
    "my-project": "My Project",
    catalog: "My Project",
    products: "My Project",

    // Publishing & Splits
    publishing: "Publishing",
    splits: "Splits",

    // Accounting + common sub-tabs
    accounting: "Accounting",
    statement: "Statements",
    statements: "Statements",
    categories: "Categories",
    countries: "Countries",
    tracks: "Tracks",
    trends: "All Trends & Analyses",
    shared: "All Shared Royalties",

    // Analytics
    analytics: "Analytics",

    // Video / promo tools
    "music-videos": "Music Videos",
    promotion: "Promotion",
    whitelist: "Whitelist",

    // Marketing (keep only this)
    marketing: "Marketing Plan",

    // Misc
    "public-relations": "Public Relations",
  };

  if (map[k]) return map[k];

  // Fallback: prettify kebab/underscore keys
  return k
    .split(/[-_]/g)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
}

export default function MaintenancePage({ pageKey = "" }) {
  const navigate = useNavigate();
  const label = labelFromKey(pageKey);

  return (
    <Container className="py-5">
      <Row className="justify-content-center">
        <Col md="8" className="text-center">
          <Alert color="warning" className="shadow-sm">
            <div className="wm-maint mb-3">
              <div className="wm-maint__wrap">
                <svg viewBox="0 0 200 200" width="100%" height="100%">
                  <circle cx="100" cy="100" r="78" fill="none" className="wm-maint__ring" strokeWidth="6" />

                  {/* Big gear */}
                  <g className="wm-gear-big">
                    <circle cx="100" cy="100" r="28" fill="none" stroke="var(--wm-accent)" strokeWidth="6" />
                    {Array.from({ length: 12 }).map((_, i) => {
                      const a = (i * Math.PI * 2) / 12;
                      const x1 = 100 + Math.cos(a) * 36;
                      const y1 = 100 + Math.sin(a) * 36;
                      const x2 = 100 + Math.cos(a) * 48;
                      const y2 = 100 + Math.sin(a) * 48;
                      return (
                        <line
                          key={i}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="var(--wm-accent)"
                          strokeWidth="6"
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </g>

                  {/* Small gear */}
                  <g className="wm-gear-small">
                    <circle cx="62" cy="62" r="16" fill="none" stroke="var(--wm-accent)" strokeWidth="5" />
                    {Array.from({ length: 10 }).map((_, i) => {
                      const a = (i * Math.PI * 2) / 10;
                      const x1 = 62 + Math.cos(a) * 22;
                      const y1 = 62 + Math.sin(a) * 22;
                      const x2 = 62 + Math.cos(a) * 30;
                      const y2 = 62 + Math.sin(a) * 30;
                      return (
                        <line
                          key={i}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke="var(--wm-accent)"
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </g>

                  {/* Subtle tool mark */}
                  <g transform="translate(128 120) rotate(-18)">
                    <path d="M0 0 L36 0" stroke="var(--wm-warn)" strokeWidth="7" strokeLinecap="round" opacity="0.95" />
                    <circle cx="0" cy="0" r="7" fill="none" stroke="var(--wm-warn)" strokeWidth="7" opacity="0.95" />
                    <rect x="29" y="-4" width="16" height="8" rx="3" fill="var(--wm-warn)" opacity="0.95" />
                  </g>
                </svg>
              </div>

              <div className="d-inline-flex align-items-center mb-2">
                <span className="badge badge-warning wm-badge mr-2">
                  <i className="fa fa-wrench mr-1" />
                  Mantenimiento
                </span>
                <span className="wm-subtle">Actualizaciones en curso</span>
              </div>

              <h4 className="mb-2 wm-headline">Estamos actualizando esta sección</h4>
              <p className="mb-0 wm-copy">
                <strong>{label}</strong> estará disponible pronto. ¡Gracias por tu paciencia!
              </p>

              <div className="mt-3 wm-shimmer" />
            </div>
          </Alert>

          <Button color="secondary" onClick={() => navigate("/app/portal/catalog")}>
            Volver al catálogo
          </Button>
        </Col>
      </Row>
    </Container>
  );
}
