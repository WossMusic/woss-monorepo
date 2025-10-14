// Optional catch-all: handles /api and /api/* in one file
const app = require('../app');

module.exports = (req, res) => {
  // Forward the request to the Express app
  return app(req, res);
};
