// src/views/admin/sections/SectionTransfer.js
import React from "react";
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Form,
  FormGroup,
  Label,
  Input,
  Row,
  Col,
  Spinner,
} from "reactstrap";

export default function SectionTransfer({ onBack, api, headers, toast, users }) {
  const [fromUserId, setFromUserId] = React.useState("");
  const [toUserId, setToUserId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [releases, setReleases] = React.useState([]);
  const [selectedIds, setSelectedIds] = React.useState([]);

  const userLabel = React.useCallback((u) => {
    const project = (u && u.project_name && String(u.project_name).trim()) || "";
    const role = u?.role || "";
    return `${project || "Unknown Project"} — ${role}`;
  }, []);

  const loadReleases = React.useCallback(
    async (uid) => {
      if (!uid) return;
      setLoading(true);
      try {
        const r = await fetch(api(`/api/admin/users/${uid}/releases`), {
          headers,
          credentials: "include",
        });
        const j = await r.json();
        if (j?.success) setReleases(j.releases || []);
        else setReleases([]);
      } catch (e) {
        console.error("load user releases error:", e);
        setReleases([]);
      } finally {
        setLoading(false);
      }
    },
    [api, headers]
  );

  // load releases of source user
  React.useEffect(() => {
    setReleases([]);
    setSelectedIds([]);
    if (fromUserId) loadReleases(fromUserId);
  }, [fromUserId, loadReleases]);

  const onSelectReleases = (e) => {
    const values = Array.from(e.target.selectedOptions || []).map((o) =>
      Number(o.value)
    );
    setSelectedIds(values);
  };

  const handleSelectAll = () => {
    setSelectedIds(releases.map((r) => Number(r.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

 const runTransfer = async () => {
  if (!fromUserId || !toUserId || !selectedIds.length) {
    toast("danger", "Choose source user, target user, and at least one release.");
    return;
  }
  if (String(fromUserId) === String(toUserId)) {
    toast("danger", "Source and target user must be different.");
    return;
  }
  try {
    const r = await fetch(api("/api/admin/transfer-releases"), {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
        releaseIds: selectedIds.map(Number), // <- ensure numeric
      }),
    });

    // Try to parse JSON even on 400 to surface server message
    let j = null;
    try { j = await r.json(); } catch { /* ignore */ }

    if (!r.ok) {
      const msg = j?.message || `Transfer failed (${r.status}).`;
      if (j?.skipped?.length) {
        toast("danger", `${msg} Skipped: ${j.skipped.join(", ")}`);
      } else {
        toast("danger", msg);
      }
      return;
    }

    const proj = j.to_user_project || "target project";
    const lbl  = j.to_user_label || "target label";
    const skippedInfo = j.skipped?.length ? ` Skipped: ${j.skipped.join(", ")}.` : "";
    toast(
      "success",
      `Transferred ${j.transferred || 0} release(s). Main artist → “${proj}”. Label → “${lbl}”. Tracks updated: ${j.updated_tracks ?? 0}.${skippedInfo}`
    );

    // refresh list for the source user after transfer
    await loadReleases(fromUserId);
    setSelectedIds([]);
  } catch (e) {
    console.error("transfer error:", e);
    toast("danger", "Server error.");
  }
};

  return (
    <>
      <Button color="secondary" className="mb-3" onClick={onBack}>
        <i className="fa fa-arrow-left mr-2" /> Back
      </Button>

      <Card className="shadow-card">
        <CardHeader>
          <strong>Transfer Releases</strong>
        </CardHeader>
        <CardBody>
          <Form onSubmit={(e) => e.preventDefault()}>
            <Row form>
              <Col md="6">
                <FormGroup>
                  <Label className="custom-label">From User</Label>
                  <Input
                    type="select"
                    value={fromUserId}
                    onChange={(e) => setFromUserId(e.target.value)}
                  >
                    <option value="">— choose source —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {userLabel(u)}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label className="custom-label">To User</Label>
                  <Input
                    type="select"
                    value={toUserId}
                    onChange={(e) => setToUserId(e.target.value)}
                  >
                    <option value="">— choose target —</option>
                    {users
                      .filter((u) => String(u.id) !== String(fromUserId)) // prevent same user
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {userLabel(u)}
                        </option>
                      ))}
                  </Input>
                </FormGroup>
              </Col>
            </Row>

            <Row form>
              <Col md="12">
                <FormGroup>
                  <Label className="custom-label">
                    Select releases to transfer
                    {selectedIds.length ? ` — ${selectedIds.length} selected` : ""}
                  </Label>

                  {loading ? (
                    <div className="py-2">
                      <Spinner size="sm" /> Loading releases…
                    </div>
                  ) : (
                    <Input
                      type="select"
                      multiple
                      size="10"
                      value={selectedIds.map(String)}
                      onChange={onSelectReleases}
                    >
                      {releases.map((r) => (
                        <option key={r.id} value={r.id}>
                          {`#${r.id} — ${r.title} · ${r.project_name || "—"} · ${
                            r.status || ""
                          }`}
                        </option>
                      ))}
                    </Input>
                  )}

                  <div className="mt-2 d-flex gap-2">
                    <Button
                      size="sm"
                      color="darker"
                      type="button"
                      onClick={handleSelectAll}
                      disabled={!releases.length}
                      className="mr-2"
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      color="darker"
                      type="button"
                      onClick={handleClearSelection}
                      disabled={!selectedIds.length}
                    >
                      Clear
                    </Button>
                  </div>

                  <small className="text-muted d-block mt-1">
                    Hold Ctrl/Cmd to select multiple.
                  </small>
                </FormGroup>
              </Col>
            </Row>

            <Button
              color="primary"
              type="button"
              onClick={runTransfer}
              disabled={!fromUserId || !toUserId || !selectedIds.length}
            >
              <i className="fa fa-exchange-alt mr-1" /> Transfer Selected
            </Button>
          </Form>
        </CardBody>
      </Card>
    </>
  );
}
