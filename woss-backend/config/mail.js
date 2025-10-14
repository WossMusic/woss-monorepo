const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ROYALTIES_EMAIL || 'royalties@wossmusic.com',
    pass: process.env.ROYALTIES_EMAIL_PASS
  }
});


module.exports = transporter;
