import React from "react";
import { Card, CardHeader, CardBody } from "reactstrap";
import { useNavigate } from "react-router-dom";

export default function AdminGrid({ setSection }) {
  const navigate = useNavigate();

  // Prefer deep-linking; fall back to setSection if needed
  const go = (path, fallbackSection) => () => {
    try {
      navigate(path);
    } catch {
      // if navigate isn’t available (unlikely), keep old behavior
      if (typeof setSection === "function") setSection(fallbackSection);
    }
  };

  return (
    <Card className="shadow-card ap-actions-card">
      <CardHeader className="border-0">
        <h3 className="mb-0 text-white">
          <i className="fa fa-cogs ap-header-icon" /> Admin Panel
        </h3>
      </CardHeader>

      <CardBody>
        <div className="ap-tiles">
          <button
            type="button"
            className="ap-tile"
            onClick={go("/app/admin/user-permissions", "perms")}
            aria-label="User Permissions"
          >
            <i className="fa fa-cog" aria-hidden="true" />
            <span>User Permissions</span>
            <small>Toggle per-user capabilities</small>
          </button>

          <button
            type="button"
            className="ap-tile"
            onClick={go("/app/admin/approve-release", "approveRelease")}
            aria-label="Approve Release"
          >
            <i className="fa fa-check" aria-hidden="true" />
            <span>Approve Release</span>
            <small>Set status, UPC/EAN &amp; dates</small>
          </button>

          <button
            type="button"
            className="ap-tile"
            onClick={go("/app/admin/approve-user", "approveUser")}
            aria-label="Approve User"
          >
            <i className="fa fa-id-badge" aria-hidden="true" />
            <span>Approve User</span>
            <small>Activate user accounts</small>
          </button>

          <button
            type="button"
            className="ap-tile"
            onClick={go("/app/admin/send-invite", "invite")}
            aria-label="Send Invite"
          >
            <i className="fa fa-paper-plane" aria-hidden="true" />
            <span>Send Invite</span>
            <small>Email registration codes</small>
          </button>

          <button
            type="button"
            className="ap-tile"
            onClick={go("/app/admin/royalties", "royalties")}
            aria-label="Royalties / Payouts"
          >
            <i className="fa fa-signal" aria-hidden="true" />
            <span>Royalties / Payouts</span>
            <small>Import reports &amp; manage payouts</small>
          </button>

          <button
            type="button"
            className="ap-tile"
            onClick={go("/app/admin/transfer-releases", "transfer")}
            aria-label="Transfer Releases"
          >
            <i className="fa fa-exchange-alt" aria-hidden="true" />
            <span>Transfer Releases</span>
            <small>Move releases between users</small>
          </button>

          {/* NEW: Maintenance Mode */}
          <button
            type="button"
            className="ap-tile"
            onClick={go("/app/admin/maintenance", "maintenance")}
            aria-label="Maintenance Mode"
          >
            <i className="fa fa-wrench" aria-hidden="true" />
            <span>Maintenance Mode</span>
            <small>Manage global maintenance keys</small>
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
