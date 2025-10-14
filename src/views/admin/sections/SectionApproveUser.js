// src/views/admin/sections/SectionApproveUser.js
import React from "react";
import { Card, CardHeader, CardBody, Button, Form, FormGroup, Label, Input, Row, Col } from "reactstrap";

export default function SectionApproveUser({
  onBack,
  pendingUsers,
  selectedPendingUserId,
  setSelectedPendingUserId,
  approveUserEmail,
  setApproveUserEmail,
  loadPendingUsers,
  runApproveUser,
}) {
  return (
    <>
      <Button color="secondary" className="mb-3" onClick={onBack}>
        <i className="fa fa-arrow-left mr-2" /> Back
      </Button>

      <Card className="shadow-card" style={{ borderRadius: 12 }}>
        <CardHeader>
          <strong>Approve User</strong>
        </CardHeader>
        <CardBody>
          <Form onSubmit={runApproveUser}>
            <Row form>
              <Col md="8">
                <FormGroup>
                  <Label>Pending users</Label>
                  <Input
                    type="select"
                    value={selectedPendingUserId}
                    onChange={(e) => setSelectedPendingUserId(e.target.value)}
                  >
                    <option value="">— select a user with Pending Verification —</option>
                    {pendingUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.fullName || u.email) + " — " + (u.email || "")}
                      </option>
                    ))}
                  </Input>
                </FormGroup>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Tip: you can still approve by email if needed:
                </div>
                <FormGroup className="mt-2">
                  <Label>Email (optional)</Label>
                  <Input
                    type="email"
                    value={approveUserEmail}
                    onChange={(e) => setApproveUserEmail(e.target.value)}
                    placeholder="Alternatively, type an email…"
                  />
                </FormGroup>
              </Col>
              <Col md="4" className="d-flex align-items-end">
                <div className="w-100 d-flex gap-2">
                  <Button color="primary" type="submit">
                    Approve
                  </Button>
                  <Button color="secondary" type="button" onClick={loadPendingUsers}>
                    Refresh
                  </Button>
                </div>
              </Col>
            </Row>
          </Form>
        </CardBody>
      </Card>
    </>
  );
}
