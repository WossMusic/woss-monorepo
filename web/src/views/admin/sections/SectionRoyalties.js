// src/views/admin/sections/SectionRoyalties.js
import React from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  Row,
  Col,
  Modal,
  ModalHeader,
  ModalBody,
} from "reactstrap";

export default function SectionRoyalties({ onBack, postJSON, api, toast }) {
  /* ---------- dates ---------- */
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const defaultMonth = `${yyyy}-${mm}`;
  const defaultDateISO = `${yyyy}-${mm}-${dd}`;

  const token = React.useMemo(() => localStorage.getItem("woss_token") || "", []);

  /* ---------- modal state ---------- */
  const [importOpen, setImportOpen] = React.useState(false);
  const [revertRoyOpen, setRevertRoyOpen] = React.useState(false);
  const [genOpen, setGenOpen] = React.useState(false);
  const [revertOpen, setRevertOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // preview modal
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState("");
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const previewPayloadRef = React.useRef(null);

  /* ---------- import royalties ---------- */
  const [importPeriod, setImportPeriod] = React.useState(defaultMonth);
  const [importFile, setImportFile] = React.useState(null);

  const [users, setUsers] = React.useState([]);
  const [projectChoiceImport, setProjectChoiceImport] = React.useState("");

  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(api("/api/admin/users"), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        const list = Array.isArray(j?.users) ? j.users : [];
        setUsers(list);
      } catch {
        setUsers([]);
      }
    })();
  }, [api, token]);

  const uniqueProjectNames = React.useMemo(() => {
    const set = new Set();
    for (const u of users) {
      const pn = (u?.project_name || "").trim();
      if (pn) set.add(pn);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [users]);

  /* ---------- revert royalties (period rollback) ---------- */
  const [revertPeriod, setRevertPeriod] = React.useState(defaultMonth);
  const [projectChoiceRevert, setProjectChoiceRevert] = React.useState("");

  /* ---------- generate withdrawals (form) ---------- */
  const [genPaymentId, setGenPaymentId] = React.useState("");
  const [genReportDate, setGenReportDate] = React.useState(defaultDateISO);
  const [genVendorInvDate, setGenVendorInvDate] = React.useState(defaultDateISO);
  const [genProjectName, setGenProjectName] = React.useState("");

  /* ---------- revert withdrawals (by date) ---------- */
  const [revProjectName, setRevProjectName] = React.useState("");
  const [revDate, setRevDate] = React.useState(defaultDateISO);

  /* ---------- actions ---------- */
  const doImport = async (e) => {
    e?.preventDefault?.();
    if (!importFile) return toast("danger", "Please choose a royalties file.");

    try {
      setBusy(true);
      const fd = new FormData();
      fd.append("File", importFile); // must be "File" for multer
      fd.append("report_period", importPeriod);
      if (projectChoiceImport) fd.append("project_name", projectChoiceImport);

      const r = await fetch(api("/api/royalties/import"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
        body: fd,
      });
      const j = await r.json().catch(() => ({}));

      if (r.ok && j?.success) {
        toast("success", "Royalties imported.");
        setImportOpen(false);
        setImportFile(null);
        setProjectChoiceImport("");
      } else if (r.status === 401 || r.status === 403) {
        toast("danger", "You don't have permission to import royalties.");
      } else {
        toast("danger", j?.message || "Import failed.");
      }
    } catch (err) {
      console.error("❌ Import error:", err?.message || err);
      toast("danger", "Server error.");
    } finally {
      setBusy(false);
    }
  };

  const doRevertRoyalties = async (e) => {
    e?.preventDefault?.();
    try {
      setBusy(true);
      const payload = { period: revertPeriod };
      if (projectChoiceRevert) payload.project_name = projectChoiceRevert;
      const r = await postJSON("/api/royalties/delete-imported", payload);
      toast(
        r?.success ? "success" : "danger",
        r?.success ? "Reverted royalties for period." : (r?.message || "Revert failed.")
      );
      if (r?.success) setRevertRoyOpen(false);
    } finally {
      setBusy(false);
    }
  };

  // Step 1: PREVIEW
  const doPreview = async (e) => {
    e?.preventDefault?.();
    if (!genProjectName || !genReportDate) {
      return toast("danger", "Project and report date are required.");
    }
    try {
      setBusy(true);
      const payload = {
        payment_id: genPaymentId || null,
        date: genReportDate,
        vendor_invoice_date: genVendorInvDate,
        project_name: genProjectName,
      };
      const r = await postJSON("/api/withdrawals/preview", payload);
      if (r?.success && r?.preview_url) {
        previewPayloadRef.current = payload;
        setPreviewUrl(api(r.preview_url));
        setPreviewOpen(true);
        setGenOpen(false);
      } else {
        toast("danger", r?.message || "Preview failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Step 2: CONFIRM generate
  const doConfirmGenerate = async () => {
    const payload = previewPayloadRef.current;
    if (!payload) return;
    try {
      setConfirmBusy(true);
      const r = await postJSON("/api/withdrawals/generate", payload);
      if (r?.success) {
        toast("success", "Withdrawal generated.");
        setPreviewOpen(false);
        setPreviewUrl("");
      } else {
        toast("danger", r?.message || "Generate failed.");
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  const doRevertWithdrawals = async (e) => {
    e?.preventDefault?.();
    if (!revProjectName || !revDate)
      return toast("danger", "Project and date are required.");
    try {
      setBusy(true);
      const r = await postJSON("/api/withdrawals/revert", {
        project_name: revProjectName,
        date: revDate,
      });
      toast(r?.success ? "success" : "danger", r?.success ? "Reverted." : (r?.message || "Revert failed."));
      if (r?.success) setRevertOpen(false);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- tiles ---------- */
  const Tile = ({ icon, title, sub, onClick }) => (
    <button type="button" className="ap-tile" onClick={onClick}>
      <i className={icon} />
      <span className="mt-1">{title}</span>
      <small>{sub}</small>
    </button>
  );

  return (
    <>
      <Button color="secondary" className="mb-3" onClick={onBack}>
        <i className="fa fa-arrow-left mr-2" /> Back
      </Button>

      <Card className="shadow-card ap-actions-card">
        <CardHeader className="d-flex align-items-center">
          <i className="fa fa-cog ap-header-icon" />
          <strong>Royalties / Withdrawals</strong>
        </CardHeader>
        <CardBody>
          <div className="ap-tiles" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            <Tile
              icon="fa fa-cloud-upload-alt"
              title="Import Royalties"
              sub="Upload .txt/.xlsx and period"
              onClick={() => setImportOpen(true)}
            />
            <Tile
              icon="fa fa-history"
              title="Revert Royalties"
              sub="Rollback an imported period"
              onClick={() => setRevertRoyOpen(true)}
            />
            <Tile
              icon="fa fa-file-invoice-dollar"
              title="Generate Withdrawals"
              sub="Create statement PDF"
              onClick={() => setGenOpen(true)}
            />
            <Tile
              icon="fa fa-undo-alt"
              title="Revert Withdrawals"
              sub="Rollback a run"
              onClick={() => setRevertOpen(true)}
            />
          </div>
        </CardBody>
      </Card>

      {/* ===================== Import Modal ===================== */}
      <Modal
        isOpen={importOpen}
        toggle={() => setImportOpen(false)}
        centered
        className="reset-mfa-modal"
        backdropClassName="modal-backdrop-darker"
      >
        <ModalHeader className="modal-header-primary">Import Royalties</ModalHeader>
        <ModalBody>
          <Form onSubmit={doImport}>
            <FormGroup>
              <Label className="font-weight-bold d-block mb-2">Royalties File</Label>
              <input
                id="royalties-file"
                type="file"
                className="d-none"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              <div className="file-box">
                <div className="mr-3">
                  <div className="filename">
                    {importFile ? importFile.name : "No file selected"}
                  </div>
                  <small>Accepted: .txt, .xlsx</small>
                </div>
                <label htmlFor="royalties-file" className="btn btn-outline-secondary mb-0">
                  Choose file
                </label>
              </div>
            </FormGroup>

            <Row form>
              <Col md="6">
                <FormGroup className="mt-3">
                  <Label className="font-weight-bold">Report Period</Label>
                  <Input
                    type="month"
                    value={importPeriod}
                    onChange={(e) => setImportPeriod(e.target.value)}
                  />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup className="mt-3">
                  <Label className="font-weight-bold">Project Name</Label>
                  <Input
                    type="select"
                    value={projectChoiceImport}
                    onChange={(e) => setProjectChoiceImport(e.target.value)}
                  >
                    <option value="">Select Project</option>
                    {uniqueProjectNames.map((pn) => (
                      <option key={pn} value={pn}>
                        {pn}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
            </Row>

            <div className="d-flex justify-content-center mt-3">
              <Button color="dark" className="mr-2" onClick={() => setImportOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button color="primary" type="submit" disabled={busy}>
                {busy ? "Importing..." : "Import"}
              </Button>
            </div>
          </Form>
        </ModalBody>
      </Modal>

      {/* ===================== Revert Royalties (period) ===================== */}
      <Modal
        isOpen={revertRoyOpen}
        toggle={() => setRevertRoyOpen(false)}
        centered
        className="reset-mfa-modal"
        backdropClassName="modal-backdrop-darker"
      >
        <ModalHeader className="modal-header-primary">Revert Royalties</ModalHeader>
        <ModalBody>
          <Form onSubmit={doRevertRoyalties}>
            <Row form>
              <Col md="6">
                <FormGroup>
                  <Label className="font-weight-bold">Royalties Period</Label>
                  <Input
                    type="month"
                    value={revertPeriod}
                    onChange={(e) => setRevertPeriod(e.target.value)}
                  />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label className="font-weight-bold">Project Name</Label>
                  <Input
                    type="select"
                    value={projectChoiceRevert}
                    onChange={(e) => setProjectChoiceRevert(e.target.value)}
                  >
                    <option value="">Select Project</option>
                    {uniqueProjectNames.map((pn) => (
                      <option key={pn} value={pn}>
                        {pn}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
            </Row>

            <div className="d-flex justify-content-center mt-3">
              <Button color="dark" className="mr-2" onClick={() => setRevertRoyOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button color="danger" type="submit" disabled={busy}>
                {busy ? "Reverting..." : "Revert"}
              </Button>
            </div>
          </Form>
        </ModalBody>
      </Modal>

      {/* ===================== Generate Withdrawals (form) ===================== */}
      <Modal
        isOpen={genOpen}
        toggle={() => setGenOpen(false)}
        centered
        className="reset-mfa-modal"
        backdropClassName="modal-backdrop-darker"
      >
        <ModalHeader className="modal-header-primary">Generate Withdrawals</ModalHeader>
        <ModalBody>
          <Form onSubmit={doPreview}>
            <Row form>
              <Col md="6">
                <FormGroup>
                  <Label className="font-weight-bold">Payment ID</Label>
                  <Input
                    value={genPaymentId}
                    onChange={(e) => setGenPaymentId(e.target.value)}
                    placeholder="EX: 6e5y4i1er4bg15"
                  />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label className="font-weight-bold">Project Name</Label>
                  <Input
                    type="select"
                    value={genProjectName}
                    onChange={(e) => setGenProjectName(e.target.value)}
                    required
                  >
                    <option value="">Select Project</option>
                    {uniqueProjectNames.map((pn) => (
                      <option key={pn} value={pn}>
                        {pn}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
            </Row>

            <Row form>
              <Col md="6">
                <FormGroup>
                  <Label className="font-weight-bold">Report Date</Label>
                  <Input
                    type="date"
                    value={genReportDate}
                    onChange={(e) => setGenReportDate(e.target.value)}
                  />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label className="font-weight-bold">Vendor Invoice Date</Label>
                  <Input
                    type="date"
                    value={genVendorInvDate}
                    onChange={(e) => setGenVendorInvDate(e.target.value)}
                  />
                </FormGroup>
              </Col>
            </Row>

            <div className="d-flex justify-content-center mt-2">
              <Button color="dark" className="mr-2" onClick={() => setGenOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button color="primary" type="submit" disabled={busy}>
                {busy ? "Preparing..." : "Preview"}
              </Button>
            </div>
          </Form>
        </ModalBody>
      </Modal>

      {/* ===================== Preview Modal ===================== */}
      <Modal
        isOpen={previewOpen}
        toggle={() => setPreviewOpen(false)}
        centered
        className="preview-modal reset-mfa-modal"
        backdropClassName="modal-backdrop-darker modal-backdrop-blur"
      >
        <ModalHeader className="modal-header-primary">Preview Payment Advice</ModalHeader>
        <ModalBody>
          <div className="pdf-frame-wrap">
            {previewUrl ? (
              <iframe title="Payment Advice Preview" src={previewUrl} />
            ) : (
              <div className="w-100 text-center text-muted py-5">Loading preview…</div>
            )}
          </div>

          <div className="d-flex justify-content-center mt-3">
            <Button
              color="dark"
              className="mr-2"
              onClick={() => {
                setPreviewOpen(false);
                setPreviewUrl("");
              }}
              disabled={confirmBusy}
            >
              Cancel
            </Button>
            <Button color="success" onClick={doConfirmGenerate} disabled={confirmBusy}>
              {confirmBusy ? "Generating..." : "Confirm"}
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* ===================== Revert Withdrawals (by date) ===================== */}
      <Modal
        isOpen={revertOpen}
        toggle={() => setRevertOpen(false)}
        centered
        className="reset-mfa-modal"
        backdropClassName="modal-backdrop-darker"
      >
        <ModalHeader className="modal-header-primary">Revert Withdrawals</ModalHeader>
        <ModalBody>
          <Form onSubmit={doRevertWithdrawals}>
            <Row form>
              <Col md="6">
                <FormGroup>
                  <Label className="font-weight-bold">Project Name</Label>
                  <Input
                    type="select"
                    value={revProjectName}
                    onChange={(e) => setRevProjectName(e.target.value)}
                    required
                  >
                    <option value="">Select Project</option>
                    {uniqueProjectNames.map((pn) => (
                      <option key={pn} value={pn}>
                        {pn}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label className="font-weight-bold">Date</Label>
                  <Input
                    type="date"
                    value={revDate}
                    onChange={(e) => setRevDate(e.target.value)}
                    required
                  />
                </FormGroup>
              </Col>
            </Row>

            <div className="d-flex justify-content-center mt-2">
              <Button color="dark" className="mr-2" onClick={() => setRevertOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button color="danger" type="submit" disabled={busy}>
                {busy ? "Reverting..." : "Revert"}
              </Button>
            </div>
          </Form>
        </ModalBody>
      </Modal>
    </>
  );
}
