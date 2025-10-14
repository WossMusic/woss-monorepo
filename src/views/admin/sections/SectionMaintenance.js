// src/views/admin/sections/SectionMaintenance.js
import React from "react";
import {
  Card, CardHeader, CardBody, Button, Table, Badge,
  Input, Form, FormGroup, Label, Row
} from "reactstrap";
import useWebsiteConfig from "hooks/useWebsiteConfig";
import sidebarRoutesLite from "components/Guards/sidebarRoutesLite";

/* ===== utilities (same API base logic as elsewhere) ===== */
function computeApiBase(config) {
  const env = String(process.env.REACT_APP_API || "").trim().replace(/\/$/, "");
  if (env) return env;
  const fromConfig = String(
    (config?.apiBase || config?.backend || config?.api_url || config?.api || "")
  ).trim().replace(/\/$/, "");
  if (fromConfig) return fromConfig;
  const { protocol, hostname, port } = window.location;
  if (port === "3000") return `${protocol}//${hostname}:4000`;
  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}
const safeJson = async (resp) => {
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) return resp.json();
  throw new Error(`Non-JSON ${resp.status}`);
};
const readLocal = () => {
  try { return JSON.parse(localStorage.getItem("maintenance_pages") || "{}"); }
  catch { return {}; }
};
const writeLocal = (map) => {
  const s = JSON.stringify(map || {});
  localStorage.setItem("maintenance_pages", s);
  // keep other tabs in sync
  window.dispatchEvent(new StorageEvent("storage", { key: "maintenance_pages", newValue: s }));
};

/* ===== key normalization ===== */
// All of these should map to the single accounting gate the page uses.
const ACCOUNTING_ALIASES = new Set([
  "accounting", "statement", "statements", "categories", "countries", "tracks", "trends", "shared"
]);
const normalizeKey = (k) => {
  const key = String(k || "").trim().toLowerCase();
  if (ACCOUNTING_ALIASES.has(key) && key !== "accounting") return "accounting";
  return key;
};

/* ===== derive selectable items ===== */
function keyFromPath(path) {
  if (!path) return null;

  if (/^\/portal\/catalog$/.test(path)) return "my-project";

  // Any /portal/accounting/* becomes "accounting"
  if (/^\/portal\/accounting(\/|$)/.test(path)) return "accounting";

  if (/^\/portal\/splits(\/|$)/.test(path)) return "splits";
  if (/^\/portal\/publishing$/.test(path)) return "publishing";
  if (/^\/portal\/music-videos$/.test(path)) return "music-videos";
  if (/^\/portal\/analytics$/.test(path)) return "analytics";
  if (/^\/portal\/whitelist$/.test(path)) return "whitelist";
  if (/^\/portal\/promotion$/.test(path)) return "promotion";
  if (/^\/portal\/marketing$/.test(path)) return "marketing";
  if (/^\/maps$/.test(path) || /^\/portal\/public-relations$/.test(path)) return "public-relations";

  return null;
}

function collectRouteOptions(allRoutes) {
  const map = new Map(); // key -> { key, label }

  const add = (k, label) => {
    const key = normalizeKey(k);
    if (!key) return;
    if (!map.has(key)) map.set(key, { key, label: label || key });
  };

  const walk = (list) => {
    (list || []).forEach((r) => {
      const hasLayout = typeof r?.layout !== "undefined";
      const eligible = hasLayout ? (r.layout === "/app" && !r.hidden) : true;
      if (!eligible) return;

      if (r?.collapse && Array.isArray(r.views)) {
        walk(r.views);
      } else {
        const k = keyFromPath(r.path);
        if (k) add(k, r.name);
      }
    });
  };

  walk(allRoutes || []);

  // 🔒 Ensure "accounting" exists even if only subpaths were discovered
  add("accounting", "Accounting");

  // External sidebar links
  const EXTERNALS = [
    { key: "tiktok-for-artists", label: "TikTok For Artists" },
    { key: "music-tab-tiktok",   label: "Music Tab - TikTok" },
    { key: "marketing-playbook", label: "Marketing Playbook" },
  ];
  EXTERNALS.forEach(({ key, label }) => add(key, label));

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

export default function SectionMaintenance({ onBack, toast }) {
  const config = useWebsiteConfig();
  const API_BASE = React.useMemo(() => computeApiBase(config), [config]);
  const token = React.useMemo(() => localStorage.getItem("woss_token") || "", []);
  const headers = React.useMemo(() => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  // selectable candidates from lite routes (no cycles)
  const candidates = React.useMemo(() => collectRouteOptions(sidebarRoutesLite), []);

  // keys: { [key:string]: boolean }
  const [state, setState] = React.useState(readLocal());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // select inputs
  const [selKey, setSelKey] = React.useState(candidates[0]?.key || "");
  const [selEnabled, setSelEnabled] = React.useState(true);

  // load from server or fallback to local
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/admin/maintenance-pages`, {
          headers, credentials: "include"
        });
        if (!r.ok) throw new Error(String(r.status));
        const j = await safeJson(r);
        const raw = j?.pages && typeof j.pages === "object" ? j.pages : {};
        // normalize any stray accounting subkeys in persisted data
        const normalized = Object.keys(raw).reduce((acc, k) => {
          acc[normalizeKey(k)] = !!raw[k];
          return acc;
        }, {});
        if (!cancelled) { setState(normalized); writeLocal(normalized); }
      } catch {
        if (!cancelled) setState(readLocal());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [API_BASE, headers]);

  const persist = async (nextMap) => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/admin/maintenance-pages`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ pages: nextMap }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await safeJson(r);
      if (!j?.success) throw new Error("Save failed");
      writeLocal(nextMap);
      toast && toast("success", "Maintenance map saved.");
    } catch {
      writeLocal(nextMap);
      toast && toast("warning", "Saved locally (server not reachable).");
    } finally {
      setSaving(false);
    }
  };

  const addKey = (e) => {
    e?.preventDefault?.();
    let k = normalizeKey(selKey);
    if (!k) return;

    // If user picked an Accounting sub-tab option (shouldn't happen now),
    // it becomes "accounting" and we inform once.
    if (k === "accounting" && selKey.toLowerCase() !== "accounting") {
      toast && toast("info", "Accounting uses a single maintenance switch. Sub-tabs are covered by the 'accounting' key.");
    }

    setState((s) => {
      const next = { ...s, [k]: !!selEnabled };
      persist(next);
      return next;
    });
  };

  const toggleKey = (k) => {
    const key = normalizeKey(k);
    setState((s) => {
      const next = { ...s, [key]: !s[key] };
      persist(next);
      return next;
    });
  };

  const removeKey = (k) => {
    const key = normalizeKey(k);
    setState((s) => {
      const next = { ...s };
      delete next[key];
      persist(next);
      return next;
    });
  };

  const keys = Object.keys(state).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <Button color="secondary" className="mb-3" onClick={onBack}>
        <i className="fa fa-arrow-left mr-2" /> Back
      </Button>

      <Card className="shadow-card">
        <CardHeader>
          <strong>Maintenance Mode — Manage Keys</strong>
        </CardHeader>
        <CardBody>
          <Form onSubmit={addKey} className="mb-3">
            <Row form>
              <div className="col-md-6">
                <FormGroup>
                  <Label className="font-weight-bold">Page</Label>
                  <Input
                    type="select"
                    value={selKey}
                    onChange={(e) => setSelKey(e.target.value)}
                  >
                    {candidates.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </Input>
                  <small className="text-muted">
                    Pick a page from the sidebar (derived from routes).
                  </small>
                </FormGroup>
              </div>
              <div className="col-md-3">
                <FormGroup>
                  <Label className="font-weight-bold">Initial status</Label>
                  <Input
                    type="select"
                    value={String(selEnabled)}
                    onChange={(e) => setSelEnabled(e.target.value === "true")}
                  >
                    <option value="true">Maintenance</option>
                    <option value="false">Live</option>
                  </Input>
                </FormGroup>
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <Button color="warning" type="submit" disabled={saving || loading || !selKey}>
                  <i className="fa fa-plus mr-1" /> Add
                </Button>
              </div>
            </Row>
          </Form>

          <Table className="align-items-center table-flush" responsive>
            <thead className="thead-light">
              <tr>
                <th>Key</th>
                <th className="text-center">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr>
                  <td colSpan="3" className="text-center text-muted py-4">
                    No keys yet — add one above.
                  </td>
                </tr>
              )}
              {keys.map((k) => {
                const on = !!state[k];
                // Try to show user-friendly labels for common keys
                const pretty =
                  {
                    "my-project": "My Project",
                    publishing: "Publishing",
                    splits: "Splits",
                    accounting: "Accounting",
                    analytics: "Analytics",
                    "music-videos": "Music Videos",
                    promotion: "Promotion",
                    whitelist: "Whitelist",
                    marketing: "Marketing Plan",
                    "public-relations": "Public Relations",
                  }[k] || k;

                return (
                  <tr key={k}>
                    <td>
                      <code>{pretty}</code> <small className="text-muted">({k})</small>
                    </td>
                    <td className="text-center">
                      {on ? <Badge color="warning">Maintenance</Badge> : <Badge color="success">Live</Badge>}
                    </td>
                    <td className="text-right">
                      <Button
                        size="sm"
                        color={on ? "success" : "warning"}
                        className="mr-2"
                        onClick={() => toggleKey(k)}
                        disabled={saving || loading}
                      >
                        {on ? <><i className="fa fa-toggle-on mr-1" /> Turn OFF</> : <><i className="fa fa-wrench mr-1" /> Turn ON</>}
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        outline
                        onClick={() => removeKey(k)}
                        disabled={saving || loading}
                      >
                        <i className="fa fa-trash mr-1" /> Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <p className="text-muted mt-3 mb-0">
            These keys are global. Admins bypass maintenance automatically. Accounting uses a single key: <code>accounting</code>.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
