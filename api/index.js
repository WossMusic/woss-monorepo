const serverless = require("serverless-http");
const app = require("../woss-backend/app"); // we export the Express app below
module.exports = (req, res) => serverless(app)(req, res);
