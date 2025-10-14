// src/views/admin/sections/SectionPerms.js
import React from "react";
import { Card, CardHeader, CardBody, Button, Form, FormGroup, Label, Input, Table, CustomInput, Spinner } from "reactstrap";

export default function SectionPerms({
  onBack,
  users,
  selectedUserId,
  onSelectUser,
  loadingPerm,
  PERMISSION_GROUPS,
  perm,
  toggleKey,
  savePerms,
  savingPerm,
  userLabel,
}) {
  return (
    <>
      <Button color="secondary" className="mb-3" onClick={onBack}>
        <i className="fa fa-arrow-left mr-2" /> Back
      </Button>

      <Card className="shadow-card">
        <CardHeader>
          <strong>User permissions</strong>
        </CardHeader>
        <CardBody>
          <Form>
            <FormGroup>
              <Label>Select User</Label>
              <Input type="select" value={selectedUserId} onChange={onSelectUser}>
                <option value="">— choose —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {userLabel(u)}
                  </option>
                ))}
              </Input>
            </FormGroup>

            {loadingPerm && (
              <div className="py-3">
                <Spinner size="sm" /> Loading…
              </div>
            )}

            {selectedUserId && !loadingPerm && (
              <>
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group.title} className="mb-3">
                    <h6 className="text-uppercase text-muted mb-2">{group.title}</h6>
                    <Table className="align-items-center">
                      <tbody>
                        {group.keys.map(([key, label]) => (
                          <tr key={key}>
                            <td style={{ width: "70%" }}>{label}</td>
                            <td className="text-right">
                              <CustomInput
                                type="switch"
                                id={key}
                                checked={!!perm[key]}
                                onChange={() => toggleKey(key)}
                                name={key}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ))}
                <Button color="primary" onClick={savePerms} disabled={savingPerm}>
                  {savingPerm ? "Saving…" : "Save permissions"}
                </Button>
              </>
            )}
          </Form>
        </CardBody>
      </Card>
    </>
  );
}
