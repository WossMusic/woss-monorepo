let maintenanceMap = {};

function setMaintenanceMap(next) {
  maintenanceMap = { ...(next || {}) };
}
function isMaintOn(key) {
  return !!maintenanceMap[String(key).toLowerCase()];
}
function isAdminRole(role = "") {
  const r = String(role).toLowerCase();
  return r === "admin" || r === "super admin";
}

/* Use on write routes; admins bypass automatically */
function guardMaintenance(pageKey, { blockRead = false, status = 423 } = {}) {
  return (req, res, next) => {
    const role = String(req.user?.role || req.auth?.role || "").toLowerCase();
    if (isAdminRole(role)) return next();
    if (!isMaintOn(pageKey)) return next();

    const method = (req.method || "").toUpperCase();
    const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    if (isWrite || blockRead) {
      return res.status(status).json({
        success: false,
        maintenance: true,
        page: pageKey,
        message: "This feature is temporarily under maintenance.",
      });
    }
    return next();
  };
}

module.exports = { setMaintenanceMap, guardMaintenance, isMaintOn };
