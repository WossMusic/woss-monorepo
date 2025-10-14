const express = require("express");
const router = express.Router();
const { websiteConfig } = require("../config/db");

// GET /api/website/config
router.get("/config", (req, res) => {
  res.json({
    success: true,
    config: websiteConfig,
  });
});

module.exports = router;
