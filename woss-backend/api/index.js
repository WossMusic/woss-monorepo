// woss-backend/api/index.js
// Vercel Node Function entry -> delegate to the Express app
const app = require('../app');
module.exports = app;              // Express is a valid (req, res) handler
// OR: const serverless = require('serverless-http'); module.exports = serverless(app);
