import React, { useEffect, useState, useCallback } from "react";
import "assets/css/argon-dashboard-pro-react.css";
import {
  Badge,
  Card,
  CardHeader,
  Table,
  Container,
  Row,
  Col,
  Button,
} from "reactstrap";
import SplitsHeader from "components/Headers/SplitsHeader.js";

function Splits() {
  const [view, setView] = useState("sharing"); // "sharing" | "receiving"
  const [splits, setSplits] = useState({ sharing: [], receiving: [] });
  const [userRole, setUserRole] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [fadeOut, setFadeOut] = useState(false);

  /* ---------- data loaders ---------- */
  const fetchSplitsCb = useCallback(async () => {
    try {
      const token = localStorage.getItem("woss_token");
      const res = await fetch("http://localhost:4000/api/splits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSplits({ sharing: data.sharing, receiving: data.receiving });
      }
    } catch (err) {
      console.error("Failed to load splits", err);
    }
  }, []);

  const fetchProfileAndSplitsCb = useCallback(async () => {
    try {
      const token = localStorage.getItem("woss_token");

      const resProfile = await fetch("http://localhost:4000/api/auth/profile/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileData = await resProfile.json();
      if (profileData.success) {
        const role = profileData.profile.role;
        setUserRole(role);
        // default tab by role
        setView(role === "Royalty Share" ? "receiving" : "sharing");
      }

      const resSplits = await fetch("http://localhost:4000/api/splits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const splitsData = await resSplits.json();
      if (splitsData.success) {
        setSplits({ sharing: splitsData.sharing, receiving: splitsData.receiving });
      }
    } catch (err) {
      console.error("Failed to fetch profile or splits:", err);
    }
  }, []);

  /* ---------- effects ---------- */
  useEffect(() => {
    fetchSplitsCb();
  }, [fetchSplitsCb]);

  useEffect(() => {
    fetchProfileAndSplitsCb();
  }, [fetchProfileAndSplitsCb]);

  // show success popup once (auto-hide)
  useEffect(() => {
    const state = window.history.state;
    const sMsg = state && state.usr && state.usr.successMessage;
    if (sMsg) {
      setPopupMessage(sMsg);
      setShowPopup(true);
      setFadeOut(false);
      setTimeout(() => setFadeOut(true), 1500);
      setTimeout(() => setShowPopup(false), 3000);
      // clear transient state
      window.history.replaceState({ ...window.history.state, usr: undefined }, "");
    }
  }, []);

  /* ---------- actions ---------- */
  const handleSplitAction = async (splitId, action) => {
    try {
      const token = localStorage.getItem("woss_token");
      const res = await fetch("http://localhost:4000/api/splits/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ split_id: splitId, action }),
      });

      const data = await res.json();
      if (data.success) {
        fetchSplitsCb();
      } else {
        alert("Action failed: " + data.message);
      }
    } catch (err) {
      console.error("Split action error", err);
    }
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const handleDelete = async (splitId) => {
    try {
      const token = localStorage.getItem("woss_token");
      const res = await fetch(`http://localhost:4000/api/splits/${splitId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchSplitsCb();
      } else {
        alert(data.message || "Failed to delete.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Server error while deleting.");
    }
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem("woss_token");
      const res = await fetch(`http://localhost:4000/api/splits/${pendingDeleteId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchSplitsCb();
      } else {
        alert(data.message || "Failed to delete.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Server error while deleting.");
    } finally {
      setShowConfirmModal(false);
      setPendingDeleteId(null);
    }
  };

  /* ---------- render helpers ---------- */
  const activeList = [
    ...(view === "sharing"
      ? splits.sharing
      : splits.receiving.filter((item) => String(item.status).toLowerCase() !== "rejected")),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const renderStatusBadge = (statusRaw) => {
    const key = String(statusRaw || "Draft").trim().toLowerCase();
    const map = {
      draft: { dot: "bg-gray", label: "Draft" },
      "in review": { dot: "bg-warning", label: "In Review" },
      "update in review": { dot: "bg-warning", label: "Update In Review" },
      approved: { dot: "bg-success", label: "Approved" },
      distributed: { dot: "bg-success", label: "Distributed" },
      pending: { dot: "bg-warning", label: "Pending" },
      accepted: { dot: "bg-success", label: "Accepted" },
      rejected: { dot: "bg-danger", label: "Rejected" },
      completed: { dot: "bg-success", label: "Completed" },
    };
    const { dot, label } = map[key] || { dot: "bg-secondary", label: statusRaw || "Unknown" };
    return (
      <Badge className="badge-dot mr-4">
        <i className={dot} />
        <span className="status text-sm font-weight-bold">{label}</span>
      </Badge>
    );
  };

  /* ---------- UI ---------- */
  return (
    <>
      {showPopup && (
        <div className={`success-popup ${fadeOut ? "fade-out" : ""}`}>{popupMessage}</div>
      )}

      {showConfirmModal && (
        <>
          <div className="modal-overlay" />
          <div className="confirm-modal">
            <h4 className="mb-4">Are you sure you want to delete this split?</h4>
            <div>
              <Button color="dark" className="mr-3" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </Button>
              <Button color="primary" onClick={confirmDelete}>
                Yes
              </Button>
            </div>
          </div>
        </>
      )}

      <SplitsHeader />

      <Container className="mt--6" fluid>
        <div className="mb-3">
          {userRole !== "Royalty Share" && (
            <Button
              className={`custom-toggle-button ${view === "sharing" ? "primary" : "secondary"}`}
              size="sm"
              type="button"
              onClick={() => setView("sharing")}
            >
              Share With
            </Button>
          )}
          <Button
            className={`custom-toggle-button ${view === "receiving" ? "primary" : "secondary"}`}
            size="sm"
            type="button"
            onClick={() => setView("receiving")}
          >
            Receive From
          </Button>
        </div>

        <Row className="mt-4">
          <Col xs="12">
            <Card className="shadow-card">
              <CardHeader className="border-0">
                <h3 className="mb-0 text-white">
                  <i className={`fa fa-share-alt ${view === "receiving" ? "flip-horizontal" : ""}`} />{" "}
                  {view === "sharing" ? "Share With" : "Receive From"}
                </h3>
              </CardHeader>

              <Table className="align-items-center table-flush split-table" responsive>
                <thead className="thead">
                  <tr>
                    <th>
                      <i className="fa fa-user" /> Name
                    </th>
                    <th>
                      <i className="fa fa-music" /> Song Title
                    </th>
                    {view === "sharing" && (
                      <th>
                        <i className="fa fa-envelope" /> Email
                      </th>
                    )}
                    <th>
                      <i className="fa fa-percentage" /> Shares
                    </th>
                    <th>
                      <i className="fa fa-toggle-on" /> Status
                    </th>
                    <th>
                      <i className="fa fa-bolt" /> Action
                    </th>
                  </tr>
                </thead>
                <tbody className="list">
                  {activeList.map((item, idx) => {
                    const statusLabel =
                      view === "sharing"
                        ? item.status === "accepted"
                          ? "Completed"
                          : item.status
                        : item.status === "accepted"
                        ? "Accepted"
                        : item.status;

                    return (
                      <tr key={idx}>
                        <td className="text-sm font-weight-bold">
                          {item.project_name || "—"}
                        </td>
                        <td className="text-sm font-weight-bold">{item.track_title}</td>
                        {view === "sharing" && (
                          <td className="text-sm font-weight-bold">{item.email}</td>
                        )}
                        <td className="text-sm font-weight-bold">{item.percentage}%</td>
                        <td>{renderStatusBadge(statusLabel)}</td>
                        <td>
                          {view === "receiving" && item.status === "Pending" ? (
                            <>
                              <Button
                                size="sm rounded-circle"
                                color="success"
                                className="mr-1"
                                onClick={() => handleSplitAction(item.id, "Accept")}
                              >
                                <i className="fa fa-check" />
                              </Button>
                              <Button
                                size="sm rounded-circle"
                                color="danger"
                                onClick={() => handleSplitAction(item.id, "Reject")}
                              >
                                <i className="fa fa-times" />
                              </Button>
                            </>
                          ) : view === "sharing" && ["Pending", "Rejected"].includes(item.status) ? (
                            <Button
                              size="sm"
                              color={item.status === "Pending" ? "danger" : "dark"}
                              className="text-white"
                              onClick={() => {
                                if (item.status === "Pending") {
                                  setPendingDeleteId(item.id);
                                  setShowConfirmModal(true);
                                } else {
                                  handleDelete(item.id);
                                }
                              }}
                            >
                              <i
                                className={`fa ${
                                  item.status === "Pending" ? "fa-times" : "fa-trash"
                                }`}
                              />{" "}
                              {item.status === "Pending" ? "Cancel" : "Remove"}
                            </Button>
                          ) : (
                            <span className="text-sm font-weight-bold">
                              {item.status === "Accepted" ? (
                                <>
                                  <i className="fa fa-check text-success mr-1" />
                                  Completed
                                </>
                              ) : (
                                item.status
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {activeList.length === 0 && (
                    <tr>
                      <td colSpan={view === "sharing" ? "6" : "5"} className="text-center text-muted">
                        No splits found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

export default Splits;
