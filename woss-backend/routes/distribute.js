const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const { execute } = require("../config/db");

router.post("/send-distribution-email", async (req, res) => {
  const { to, subject, attachment } = req.body;

  try {
    const tempDir = path.resolve(__dirname, "../temp");
    const excelPath = path.join(tempDir, attachment);

    if (!fs.existsSync(excelPath)) {
      return res.status(404).json({ success: false, message: "Excel file not found" });
    }

    // Extract display_title from filename
   const titleSlug = path.basename(attachment, ".xlsx"); // e.g. Hola or hola

    // Match display_title ignoring case and special formatting
    const [[release]] = await execute(
    "SELECT * FROM releases WHERE LOWER(REPLACE(REPLACE(display_title, ' ', '_'), '-', '_')) = ?",
    [titleSlug.toLowerCase()]
    );

    if (!release) throw new Error("Release not found by display_title");

    const releaseId = release.id;

    // Prepare zip filename from sanitized display_title
    const releaseTitle = (release.display_title || `release_${release.id}`)
    .replace(/[^a-z0-9]/gi, "_"); 
    const zipFileName = `${releaseTitle}.zip`;
    const zipPath = path.join(tempDir, zipFileName);

    // Load tracks
    const [tracks] = await execute("SELECT * FROM release_tracks WHERE release_id = ?", [releaseId]);

    // Resolve artwork and tracks
    const artworkDir = path.resolve(__dirname, "../uploads/artworks");
    const trackDir = path.resolve(__dirname, "../uploads/tracks");

    const artworkFile = release.artwork_url;
    const artworkPath = artworkFile ? path.join(artworkDir, path.basename(artworkFile)) : null;

    const trackFiles = tracks
      .map(t => t.track_file_name)
      .filter(Boolean)
      .map(file => path.join(trackDir, file))
      .filter(fp => fs.existsSync(fp));

    // Create ZIP archive
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);

    archive.file(excelPath, { name: attachment });

    if (artworkFile && fs.existsSync(artworkPath)) {
      archive.file(artworkPath, { name: `Artwork/${path.basename(artworkFile)}` });
    }

    trackFiles.forEach(trackPath => {
      archive.file(trackPath, { name: `Track/${path.basename(trackPath)}` });
    });

    await archive.finalize();

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Woss Music" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                <!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Download Your Release</title>
                <style>
                body {
                    background-color: #1A2120; /* Top background color */
                    color: #FFFFFF; /* Text color white */
                    font-family: 'Albert Sans', sans-serif;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    padding: 40px;
                    text-align: center;
                    background-color: #1A2120; /* Ensures top container uses the correct color */
                    color: #FFFFFF; /* Ensures container text is white */
                }
                .logo {
                    margin-bottom: 30px;
                }
                h1, p {
                    color: #FFFFFF; /* Ensures header and paragraph text is white */
                }
                a { text-decoration: none; color: #FFFFFF !important; } 
                .ii a[href] { color: #FFFFFF !important; text-decoration: none !important; }
                .button {
                    background-color: #56BCB6; /* Updated button color */
                    color: #FFFFFF; /* Button text color white */
                    padding: 15px 30px;
                    border: none;
                    border-radius: 4px;
                    text-decoration: none;
                    font-size: 16px;
                    font-weight: bold;
                    display: inline-block;
                }
                .footer {
                    background-color: #56BCB6; /* Bottom section preserved */
                    color: #FFFFFF; /* Footer text white */
                    padding: 20px;
                    font-size: 14px;
                    text-align: center;
                }
                </style>
                </head>
                 <body>
                    <div class="container">
                    <img src="https://drive.google.com/uc?export=view&id=1R9Qu32Np3NKxfrx9p55b41uRtqgQop80" style="max-width:300px;" />
                    <h1>Your Release is Ready!</h1>
                    <p>The full release package (.xlsx${artworkFile ? ' + artwork' : ''}${trackFiles.length > 0 ? ' + track' : ''}) is attached and also available via the button below.</p>
                    <a class="button" href="http://localhost:4000/temp/${zipFileName}">Download Release</a>
                    </div>
                    <div class="footer">
                    <p>Woss Music / Warner Music Latina Inc. All rights reserved.</p>
                    </div>
                </body>
                </html>
                `,      
        };
        await transporter.sendMail(mailOptions);
        // ✅ Update release status to "In Review" after successful email
        await execute("UPDATE releases SET status = 'In Review' WHERE id = ?", [releaseId]);

        // Optionally, fetch the updated release to return status to the client
        const [[afterUpdate]] = await execute("SELECT id, status FROM releases WHERE id = ?", [releaseId]);

        res.json({
          success: true,
          message: "Email with release package sent successfully.",
          releaseId: releaseId,
          status: afterUpdate?.status || 'In Review'
        });

     } catch (err) {
      console.error("❌ Email send error:", err.message);
      res.status(500).json({ error: "Failed to send distribution email." });
    }
});

module.exports = router;