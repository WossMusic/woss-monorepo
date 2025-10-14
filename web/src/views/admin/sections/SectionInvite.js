// src/views/admin/sections/SectionInvite.js
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
} from "reactstrap";
import CustomSelect from "components/Custom/CustomSelect.js";

const ARTIST_TYPE_OPTIONS = ["Collaborator", "Artist Name", "Producer", "Company"];

export default function SectionInvite({
  onBack,
  api,
  headers,
  toast,
  genre,
  handleGenreChange,
  genreOptions,
}) {
  // Keep percentage between 0 and 100 while typing
  const clampPercent = (e) => {
    let v = e.target.value;
    if (v === "") return; // allow empty while editing
    let n = parseFloat(v);
    if (Number.isNaN(n)) {
      e.target.value = "";
      return;
    }
    if (n < 0) n = 0;
    if (n > 100) n = 100;
    e.target.value = n;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Final clamp on submit (safety)
    let fee = fd.get("distribution_fee");
    let feeNum = fee === "" ? "" : Number(fee);
    if (feeNum !== "" && !Number.isNaN(feeNum)) {
      if (feeNum < 0) feeNum = 0;
      if (feeNum > 100) feeNum = 100;
    }

    const payload = {
      role: fd.get("role") || "Royalty Share",
      email: (fd.get("email") || "").trim(),
      projectName: (fd.get("projectName") || "").trim(),
      label: (fd.get("label") || "Woss Music").trim(),
      genre: genre?.value || "",
      artistType: (fd.get("artistType") || "").trim(),
      distribution_fee: feeNum === "" ? "" : String(feeNum),
    };

    try {
      const r = await fetch(api("/api/admin/send-invite"), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const text = await r.text();
      let j;
      try {
        j = JSON.parse(text);
      } catch {}
      if (r.ok && j?.success) {
        toast("success", "Invitation sent.");
        form.reset();
      } else {
        console.error("invite response:", text);
        toast("danger", (j && (j.error || j.message)) || "Send invite failed.");
      }
    } catch (err) {
      console.error("send-invite error:", err);
      toast("danger", "Send invite failed.");
    }
  };

  return (
    <>
      <Button color="secondary" className="mb-3" onClick={onBack}>
        <i className="fa fa-arrow-left mr-2" /> Back
      </Button>

      <Card className="shadow-card">
        <CardHeader>
          <strong>Send Invite</strong>
        </CardHeader>
        <CardBody>
          <Form onSubmit={handleSubmit} autoComplete="off" spellCheck={false}>
            <Row form>
              <Col md="4">
                <FormGroup>
                  <Label className="custom-label">Role *</Label>
                  <Input type="select" name="role" defaultValue="Royalty Share">
                    <option>Royalty Share</option>
                    <option>Artist/Manager</option>
                    <option>Distributor</option>
                  </Input>
                </FormGroup>
              </Col>
              <Col md="8">
                <FormGroup>
                  <Label className="custom-label">Email *</Label>
                  <Input type="email" name="email" defaultValue="" />
                </FormGroup>
              </Col>
            </Row>

            <Row form>
              <Col md="6">
                <FormGroup>
                  <Label className="custom-label">Project *</Label>
                  <Input type="text" name="projectName" defaultValue="" />
                </FormGroup>
              </Col>
              <Col md="6">
                <FormGroup>
                  <Label className="custom-label">Label *</Label>
                  <Input type="text" name="label" defaultValue="Woss Music" />
                </FormGroup>
              </Col>
            </Row>

            <Row form>
              <Col md="4">
                <FormGroup>
                  <Label className="custom-label">Genre *</Label>
                  <CustomSelect
                    readOnly={false}
                    options={[{ value: "", label: "Select Genre" }, ...genreOptions]}
                    value={genre}
                    onChange={handleGenreChange}
                    className={`react-select-container ${
                      !genre || genre.value === "" ? "border-warning" : ""
                    }`}
                  />
                </FormGroup>
              </Col>

              <Col md="4">
                <FormGroup>
                  <Label className="custom-label">Artist Type *</Label>
                  <Input type="select" name="artistType" defaultValue="">
                    <option value="">Select Artist Type</option>
                    {ARTIST_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>

              <Col md="4">
                <FormGroup>
                  <Label className="custom-label">Distribution Fee *</Label>
                  {/* Percent sign INSIDE the input */}
                  <div className="pct-input">
                    <Input
                      type="number"
                      name="distribution_fee"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max="100"
                      onInput={clampPercent}
                      placeholder="0–100"
                      defaultValue=""
                      className="pct-input__field"
                    />
                    <span className="pct-input__suffix">%</span>
                  </div>
                </FormGroup>
              </Col>
            </Row>

            <Button color="primary" type="submit">
              Send Invite
            </Button>
          </Form>
        </CardBody>
      </Card>
    </>
  );
}
