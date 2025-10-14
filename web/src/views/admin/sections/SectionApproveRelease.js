// src/views/admin/sections/SectionApproveRelease.js
import React from "react";
import { Card, CardHeader, CardBody, Button, Form, FormGroup, Label, Input, Row, Col } from "reactstrap";

export default function SectionApproveRelease({
  onBack,
  ar,
  setAR,
  pendingReleases,
  fmt,
  loadPendingReleases,
  runApproveRelease,
}) {
  return (
    <>
      <Button color="secondary" className="mb-3" onClick={onBack}>
        <i className="fa fa-arrow-left mr-2" /> Back
      </Button>

      <Card className="shadow-card">
        <CardHeader>
          <strong>Approve / Distribute Release</strong>
        </CardHeader>
        <CardBody>
          <Form onSubmit={(e) => e.preventDefault()}>
            <Row form>
              <Col md="6">
                <FormGroup>
                  <Label>Choose a release (In Review / Update In Review)</Label>
                  <Input
                    type="select"
                    value={ar.releaseId}
                    onChange={(e) => {
                      const id = Number(e.target.value) || "";
                      setAR((s) => ({ ...s, releaseId: id }));
                      const found = pendingReleases.find((x) => x.id === id);
                      if (found) {
                        setAR({
                          releaseId: id,
                          gpid_type: found.gpid_type || "EAN",
                          gpid_code: found.gpid_code || "",
                          product_release_date: fmt(found.product_release_date),
                        });
                      }
                    }}
                  >
                    <option value="">— select release —</option>
                    {pendingReleases.map((r) => (
                      <option key={r.id} value={r.id}>
                        {(r.display_title || r.release_title || "Untitled") +
                          " · " +
                          (r.project_name || "Unknown") +
                          " · " +
                          r.status}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
              </Col>

              <Col md="3">
                <FormGroup>
                  <Label>GPID Type</Label>
                  <Input
                    type="select"
                    value={ar.gpid_type}
                    onChange={(e) => setAR((s) => ({ ...s, gpid_type: e.target.value }))}
                  >
                    <option value="EAN">EAN</option>
                    <option value="UPC">UPC</option>
                  </Input>
                </FormGroup>
              </Col>

              <Col md="3">
                <FormGroup>
                  <Label>Product Release Date</Label>
                  <Input
                    type="date"
                    value={ar.product_release_date}
                    onChange={(e) => setAR((s) => ({ ...s, product_release_date: e.target.value }))}
                  />
                </FormGroup>
              </Col>
            </Row>

            <Row form>
              <Col md="9">
                <FormGroup>
                  <Label>GPID Code</Label>
                  <Input
                    value={ar.gpid_code}
                    onChange={(e) => setAR((s) => ({ ...s, gpid_code: e.target.value }))}
                  />
                </FormGroup>
              </Col>
              <Col md="3" className="d-flex align-items-end">
                <div className="w-100 d-flex justify-content-between">
                  <Button color="secondary" type="button" onClick={loadPendingReleases}>
                    Refresh list
                  </Button>
                </div>
              </Col>
            </Row>

            <div className="d-flex flex-wrap gap-2">
              <Button
                color="primary"
                type="button"
                disabled={!ar.releaseId}
                onClick={() => runApproveRelease("Approved")}
              >
                <i className="fa fa-check mr-1" /> Approve
              </Button>
              <Button
                color="dark"
                type="button"
                disabled={!ar.releaseId}
                onClick={() => runApproveRelease("Distributed")}
              >
                <i className="fa fa-share-square mr-1" /> Distribute
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </>
  );
}
