// routes/user.js
const express = require("express");
const router = express.Router();
const { execute } = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");
const { v4: uuidv4 } = require("uuid");
const { getRole, isAdminUser, getPermOverride } = require("../utils/rbac");
const trackUpload = multer({ storage: multer.memoryStorage() });

// --- artists normalization helpers (keep owner project_name as main & REPLACE old main) ---
const norm = (s) => String(s || "").trim().toLowerCase();

const dedupeCIStrings = (arr) => {
  const seen = new Set(), out = [];
  for (const v of Array.isArray(arr) ? arr : []) {
    const k = norm(v);
    if (!k) continue;
    if (!seen.has(k)) { seen.add(k); out.push(String(v).trim()); }
  }
  return out;
};

const forceFirstStrArr = (arr, first) => {
  const f = String(first || "").trim();
  if (!f) return dedupeCIStrings(arr);
  const rest = (Array.isArray(arr) ? arr : []).filter((v) => norm(v) !== norm(f));
  return dedupeCIStrings([f, ...rest]);
};

const forceFirstObjArr = (arr, firstName) => {
  const first = String(firstName || "").trim();
  const list = Array.isArray(arr) ? arr : [];

  // if no "first", just return list de-duped by name
  if (!first) {
    const seen = new Set(), out = [];
    for (const o of list) {
      const k = norm(o?.name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ ...o, name: String(o.name || "").trim() });
    }
    return out;
  }

  const found = list.find((o) => norm(o?.name) === norm(first));
  const head = found ? { ...found, name: (found.name || first).trim() } : { name: first };
  const rest = list
    .filter((o) => norm(o?.name) && norm(o?.name) !== norm(first))
    .map((o) => ({ ...o, name: String(o.name).trim() }));

  // de-dupe by name, keep first occurrence (which is head)
  const seen = new Set(), out = [];
  for (const o of [head, ...rest]) {
    const k = norm(o.name);
    if (!k) continue;
    if (!seen.has(k)) { seen.add(k); out.push(o); }
  }
  return out;
};

/**
 * Re-enforce & REPLACE the main artist across release + tracks after any write
 * - If artists_json / release_artists still contain the previous main, replace with project_name
 * - Force project_name to be first and de-dupe (case-insensitive)
 */
// after the definition of coerceReleaseArtistsState(releaseId)
const normalizeReleaseMainArtist = coerceReleaseArtistsState;

async function coerceReleaseArtistsState(releaseId) {
  // Back-compat alias for older call sites

  // Fetch release core (project_name + artists_json)
  const [[rel]] = await execute(
    "SELECT id, COALESCE(project_name,'') AS project_name, COALESCE(artists_json,'') AS artists_json, COALESCE(release_type,'') AS release_type FROM releases WHERE id = ?",
    [releaseId]
  );
  if (!rel) return;

  const main = String(rel.project_name || "").trim();
  let names = [];
  try {
    const parsed = JSON.parse(rel.artists_json || "[]");
    if (Array.isArray(parsed)) names = parsed;
  } catch {}

  // Discover likely "old main" aliases to replace
  const prevHead = names.length ? String(names[0]).trim() : "";

  const [[raHeadRow]] = await execute(
    "SELECT artist_name FROM release_artists WHERE release_id = ? ORDER BY id ASC LIMIT 1",
    [releaseId]
  );
  const raHead = String(raHeadRow?.artist_name || "").trim();

  const aliasSet = new Set(
    [prevHead, raHead]
      .filter(Boolean)
      .filter((x) => norm(x) !== norm(main))
      .map((x) => norm(x))
  );

  // A) releases.artists_json — replace aliases -> main, then force-first + de-dupe
  let replacedNames = Array.isArray(names)
    ? names.map((n) => (aliasSet.has(norm(n)) ? main : String(n).trim()))
    : [];

  const nextNames = forceFirstStrArr(replacedNames, main);
  if (JSON.stringify(nextNames) !== JSON.stringify(names)) {
    await execute("UPDATE releases SET artists_json = ? WHERE id = ?", [
      JSON.stringify(nextNames),
      releaseId,
    ]);
  }

  // B) release_artists — first row MUST be main; also replace any alias rows with main
  if (main) {
    const [rows] = await execute(
      "SELECT id, artist_name FROM release_artists WHERE release_id = ? ORDER BY id ASC",
      [releaseId]
    );

    if (rows && rows.length) {
      // ensure first row == main
      if (norm(rows[0].artist_name) !== norm(main)) {
        await execute("UPDATE release_artists SET artist_name = ? WHERE id = ?", [
          main,
          rows[0].id,
        ]);
      }
      // replace any alias rows with main
      if (aliasSet.size) {
        const aliasList = Array.from(aliasSet);
        const ph = aliasList.map(() => "?").join(",");
        await execute(
          `UPDATE release_artists SET artist_name = ? WHERE release_id = ? AND LOWER(artist_name) IN (${ph})`,
          [main, releaseId, ...aliasList]
        );
      }
    } else {
      await execute(
        "INSERT INTO release_artists (release_id, artist_name) VALUES (?, ?)",
        [releaseId, main]
      );
    }
  }

  // C) release_tracks.track_artists_json — replace alias names -> main, force-first + de-dupe
  const [tracks] = await execute(
    "SELECT id, COALESCE(track_artists_json,'') AS track_artists_json FROM release_tracks WHERE release_id = ?",
    [releaseId]
  );

  for (const t of tracks || []) {
    let objs = [];
    try {
      const parsed = JSON.parse(t.track_artists_json || "[]");
      if (Array.isArray(parsed)) objs = parsed;
    } catch {}

    // replace alias objects to main; trim names
    const mapped = objs.map((o) => {
      const nm = String(o?.name || "").trim();
      if (!nm) return o;
      if (aliasSet.has(norm(nm))) return { ...o, name: main };
      return { ...o, name: nm };
    });

    const nextObjs = forceFirstObjArr(mapped, main);
    if (JSON.stringify(nextObjs) !== JSON.stringify(objs)) {
      await execute("UPDATE release_tracks SET track_artists_json = ? WHERE id = ?", [
        JSON.stringify(nextObjs),
        t.id,
      ]);
    }
  }
}

// --- status helpers ---
const VALID_STATUSES = new Set([
  "Draft",
  "In Review",
  "Update In Review",
  "Approved",
  "Distributed",
]);

function normalizeStatus(s) {
  if (!s) return null;
  const map = {
    "draft": "Draft",
    "in review": "In Review",
    "update in review": "Update In Review",
    "approved": "Approved",
    "distributed": "Distributed",
  };
  const key = String(s).trim().toLowerCase();
  return map[key] || null;
}

function toStatus(s) {
  return normalizeStatus(s) || "Draft";
}

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../uploads/artworks");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });


/* ──────────────────────────── RBAC: delete permission check ──────────────────────────── */
/**
 * canDeleteRelease(userId, releaseId)
 * Rules:
 *  - Admin/Super Admin: always allow
 *  - Must own the release (non-admin)
 *  - Drafts: allow
 *  - Otherwise: require DB override `release.delete`
 */
async function canDeleteRelease(userId, releaseId) {
  // Ensure release exists
  const [[r]] = await execute(
    "SELECT id, user_id, status FROM releases WHERE id = ?",
    [releaseId]
  );
  if (!r) return { ok: false, reason: "not_found" };

  // Admin bypass
  if (await isAdminUser(userId)) return { ok: true };

  // Ownership check (non-admins)
  if (Number(r.user_id) !== Number(userId)) {
    return { ok: false, reason: "not_owner" };
  }

  // Drafts are deletable
  if (String(r.status || "").trim().toLowerCase() === "draft") {
    return { ok: true };
  }

  // Non-drafts require explicit permission override
  const override = await getPermOverride(userId, "release.delete"); // true | false | null
  if (override === true) return { ok: true };
  return { ok: false, reason: "forbidden" };
}


// =============== PROFILE ===============
router.get("/profile", verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const [user] = await execute(
      `SELECT
         id,
         full_name       AS fullName,
         email,
         phone,
         role,
         project_name    AS projectName,
         label,
         account_status  AS status,
         apple_music_profile,
         spotify_profile
       FROM users
       WHERE id = ?`,
      [userId]
    );
    if (!user.length) return res.status(404).json({ error: "User not found." });
    res.json(user[0]); // includes apple_music_profile & spotify_profile now
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// =============== RELEASES: LIST (BY USER) ===============
router.get("/releases/me", verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const [rows] = await execute(
      `SELECT * FROM releases WHERE user_id = ? ORDER BY created_at DESC`,
      [userId]
    );
    const releases = rows.map((r) => {
      const status = toStatus(r.status);
      return { ...r, status, canDelete: status === "Draft" };
    });
    res.json({ success: true, releases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// =============== CREATE RELEASE (adds public_id + slug) ===============
router.post("/releases", verifyToken, async (req, res) => {
  const { release_title, release_type } = req.body;
  const user_id = req.user.userId;

  try {
    const [userResult] = await execute(
      "SELECT project_name FROM users WHERE id = ?",
      [user_id]
    );
    if (!userResult.length) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const projectName = userResult[0].project_name || "Untitled Project";
    const artistsJson = JSON.stringify([projectName]);
    const cleanTerritory = "Worldwide";
    const cleanExclusivity = "All Partners";
    const publicId = uuidv4();

    const [result] = await execute(
      `INSERT INTO releases (
         user_id, public_id, release_title, display_title, release_type, project_name,
         artists_json, territory, partner_exclusivity, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`,
      [
        user_id,
        publicId,
        release_title || "",
        release_title || "",
        release_type || "Single",
        projectName,
        artistsJson,
        cleanTerritory,
        cleanExclusivity,
      ]
    );

    const id = result.insertId;
    const base = slugify(release_title || projectName || `release-${id}`);
    const slug = `${id}-${base}`.slice(0, 191);
    await execute("UPDATE releases SET slug = ? WHERE id = ?", [slug, id]);

    res.json({
      success: true,
      release_id: id,
      public_id: publicId,
      slug,
      status: "Draft",
    });
  } catch (err) {
    console.error("Create release error:", err);
    res.status(500).json({ success: false });
  }
});


// =============== GET ONE (by numeric id) ===============
router.get("/releases/:id", verifyToken, async (req, res) => {
  const releaseId = req.params.id;
  const userId = req.user.userId;
  try {
    const admin = await isAdminUser(userId);
    const sql = admin
      ? "SELECT * FROM releases WHERE id = ?"
      : "SELECT * FROM releases WHERE id = ? AND user_id = ?";
    const params = admin ? [releaseId] : [releaseId, userId];

    const [rows] = await execute(sql, params);
    if (!rows.length) return res.status(404).json({ success: false });

    const status = toStatus(rows[0].status);
    const release = { ...rows[0], status, canDelete: status === "Draft" };
    res.json({ success: true, release });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});



// =============== GET ONE (by public_id) ===============
router.get("/releases/public/:publicId", verifyToken, async (req, res) => {
  const { publicId } = req.params;
  const userId = req.user.userId;
  try {
    const admin = await isAdminUser(userId);
    const sql = admin ? "SELECT * FROM releases WHERE public_id = ?" 
                      : "SELECT * FROM releases WHERE public_id = ? AND user_id = ?";
    const params = admin ? [publicId] : [publicId, userId];

    const [[release]] = await execute(sql, params);
    if (!release) return res.status(404).json({ success: false, message: "Not found" });
    release.status = toStatus(release.status);
    release.canDelete = release.status === "Draft";
    res.json({ success: true, release });
  } catch (err) {
    console.error("public-id fetch error:", err);
    res.status(500).json({ success: false });
  }
});


// =============== GET ONE (by slug) ===============
router.get("/releases/slug/:slug", verifyToken, async (req, res) => {
  const { slug } = req.params;
  const userId = req.user.userId;
  try {
    const admin = await isAdminUser(userId);
    const sql = admin ? "SELECT * FROM releases WHERE slug = ? LIMIT 1" 
                      : "SELECT * FROM releases WHERE slug = ? AND user_id = ? LIMIT 1";
    const params = admin ? [slug] : [slug, userId];

    const [[release]] = await execute(sql, params);
    if (!release) return res.status(404).json({ success: false, message: "Not found" });
    release.status = toStatus(release.status);
    release.canDelete = release.status === "Draft";
    res.json({ success: true, release });
  } catch (err) {
    console.error("get-by-slug error:", err);
    res.status(500).json({ success: false });
  }
});

// =============== SUBMIT (Draft → In Review) ===============
router.post("/releases/:id/submit", verifyToken, async (req, res) => {
  const releaseId = req.params.id;
  const userId = req.user.userId;

  try {
    const [[r]] = await execute(
      "SELECT status, public_id FROM releases WHERE id = ? AND user_id = ?",
      [releaseId, userId]
    );
    if (!r)
      return res
        .status(404)
        .json({ success: false, message: "Release not found" });

    const curr = toStatus(r.status);
    if (curr !== "Draft" && curr !== "In Review") {
      return res
        .status(400)
        .json({ success: false, message: `Cannot submit from ${curr}` });
    }

    await execute(
      "UPDATE releases SET status = 'In Review', submitted_at = NOW() WHERE id = ? AND user_id = ?",
      [releaseId, userId]
    );

    res.json({ success: true, status: "In Review", public_id: r.public_id });
  } catch (err) {
    console.error("submit error:", err);
    res.status(500).json({ success: false });
  }
});

router.put("/releases/:id", verifyToken, async (req, res) => {
  const releaseId = req.params.id;
  const userId = req.user.userId;

  // role scope
  const role = (await getRole(userId)).trim().toLowerCase();
  const isAdmin = role === "admin" || role === "super admin";

  const allowedFields = new Set([
    "artwork_url",
    "release_type",
    "project_name",
    "release_format",
    "label",
    "release_title",
    "display_title",
    "version",
    "gpid_type",
    "gpid_code",
    "label_catalog_number",
    "primary_genre",
    "sub_genre",
    "metadata_language",
    "meta_language_country",
    "audio_language",
    "audio_presentation",
    "artists_json",
    "contributors_json",
    "c_line_year",
    "p_line_year",
    "c_line_owner",
    "p_line_owner",
    "original_release_date",
    "preorder_date",
    "product_release_date",
    "territory",
    "partner_exclusivity",
    "distribution_notes",
    "distribution_json",
    "status",
  ]);

  try {
    // fetch current (owner scoped unless admin)
    const [[currentRelease]] = await execute(
      isAdmin
        ? "SELECT id, release_type, territory, partner_exclusivity, distribution_json, project_name, artists_json FROM releases WHERE id = ?"
        : "SELECT id, release_type, territory, partner_exclusivity, distribution_json, project_name, artists_json FROM releases WHERE id = ? AND user_id = ?",
      isAdmin ? [releaseId] : [releaseId, userId]
    );
    if (!currentRelease) {
      return res
        .status(404)
        .json({ success: false, message: "Release not found" });
    }

    const currentType = currentRelease.release_type;

    const fields = [];
    const values = [];

    // flags + staged payloads
    let newReleaseType = currentType;
    let updatingArtistsJson = false;
    let updatingContributorsJson = false;
    let updatingTerritory = false;
    let updatingExclusivity = false;

    let incomingArtists = undefined;      // array of strings (if provided)
    let incomingProjectName = undefined;  // string (if provided)

    // build update set, but defer artists_json (we normalize later)
    for (const [key, raw] of Object.entries(req.body)) {
      if (!allowedFields.has(key)) continue;

      let cleanedValue = raw;

      if (key === "territory" || key === "partner_exclusivity") {
        cleanedValue = String(raw).replace(/^'+|'+$/g, "");
      }

      if (key === "status") {
        const normStat = normalizeStatus(raw);
        if (!normStat) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid status value" });
        }
        cleanedValue = normStat;
      }

      if (key === "release_title") {
        fields.push("release_title = ?", "display_title = ?");
        values.push(cleanedValue, cleanedValue);
        continue;
      }

      if (key === "release_type") {
        newReleaseType = cleanedValue;
        fields.push("release_type = ?");
        values.push(cleanedValue);
        continue;
      }

      if (key === "artists_json") {
        updatingArtistsJson = true;
        try {
          incomingArtists = Array.isArray(raw) ? raw : JSON.parse(raw);
        } catch {
          incomingArtists = Array.isArray(raw) ? raw : [];
        }
        // do NOT push this yet; we will normalize & write after project_name is final
        continue;
      }

      if (key === "project_name") {
        incomingProjectName = String(raw || "").trim();
        fields.push("project_name = ?");
        values.push(incomingProjectName);
        continue;
      }

      // default case
      fields.push(`${key} = ?`);
      values.push(cleanedValue);

      if (key === "contributors_json") updatingContributorsJson = true;
      if (key === "territory") updatingTerritory = true;
      if (key === "partner_exclusivity") updatingExclusivity = true;
    }

    // If changing Single -> EP/Album, wipe tracks
    if (currentType === "Single" && ["EP", "Album"].includes(newReleaseType)) {
      await execute("DELETE FROM release_tracks WHERE release_id = ?", [
        releaseId,
      ]);
    }

    // apply immediate fields (excluding artists_json which we normalize below)
    if (fields.length) {
      if (isAdmin) {
        values.push(releaseId);
        await execute(
          `UPDATE releases SET ${fields.join(", ")} WHERE id = ?`,
          values
        );
      } else {
        values.push(releaseId, userId);
        await execute(
          `UPDATE releases SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
          values
        );
      }
    }

    // Read back the persisted project_name & type (truth from DB)
    const [[after]] = await execute(
      "SELECT COALESCE(project_name,'') AS project_name, COALESCE(release_type,'') AS release_type FROM releases WHERE id = ?",
      [releaseId]
    );
    const main =
      String(after?.project_name || incomingProjectName || currentRelease.project_name || "")
        .trim();

    // Normalize artists if artists_json or project_name changed
    if (updatingArtistsJson || incomingProjectName !== undefined) {
      // base = incoming array if provided, else current DB value
      let base = [];
      if (updatingArtistsJson) {
        base = Array.isArray(incomingArtists) ? incomingArtists : [];
      } else {
        try {
          base = JSON.parse(currentRelease.artists_json || "[]");
        } catch {
          base = [];
        }
      }

      // releases.artists_json (main first, dedup)
      const nextNames = forceFirstStrArr(base, main);
      await execute("UPDATE releases SET artists_json = ? WHERE id = ?", [
        JSON.stringify(nextNames),
        releaseId,
      ]);

      // release_artists first row == main (insert if none)
      const [rows] = await execute(
        "SELECT id FROM release_artists WHERE release_id = ? ORDER BY id ASC",
        [releaseId]
      );
      if (rows && rows.length) {
        await execute(
          "UPDATE release_artists SET artist_name = ? WHERE id = ?",
          [main, rows[0].id]
        );
      } else if (main) {
        await execute(
          "INSERT INTO release_artists (release_id, artist_name) VALUES (?, ?)",
          [releaseId, main]
        );
      }

      // tracks.track_artists_json (objects, main first, dedup by name)
      const [tracks] = await execute(
        "SELECT id, COALESCE(track_artists_json,'') AS track_artists_json FROM release_tracks WHERE release_id = ?",
        [releaseId]
      );
      for (const t of tracks || []) {
        let objs = [];
        try {
          const parsed = JSON.parse(t.track_artists_json || "[]");
          if (Array.isArray(parsed)) objs = parsed;
        } catch {}
        const nextObjs = forceFirstObjArr(objs, main);
        await execute(
          "UPDATE release_tracks SET track_artists_json = ? WHERE id = ?",
          [JSON.stringify(nextObjs), t.id]
        );
      }
    }

    // keep distribution_json territory/exclusivity in sync
    if (updatingTerritory || updatingExclusivity) {
      const [[updatedRelease]] = await execute(
        "SELECT distribution_json, territory, partner_exclusivity FROM releases WHERE id = ?",
        [releaseId]
      );
      if (updatedRelease?.distribution_json) {
        try {
          let distJson = JSON.parse(updatedRelease.distribution_json);
          if (Array.isArray(distJson)) {
            const updatedTerritory = updatingTerritory
              ? String(req.body.territory).replace(/^'+|'+$/g, "")
              : currentRelease.territory;
            const updatedExclusivity = updatingExclusivity
              ? String(req.body.partner_exclusivity).replace(/^'+|'+$/g, "")
              : currentRelease.partner_exclusivity;

            distJson = distJson.map((d) => ({
              ...d,
              territory: updatedTerritory || d.territory,
              exclusivity: updatedExclusivity || d.exclusivity,
            }));

            await execute(
              "UPDATE releases SET distribution_json = ? WHERE id = ?",
              [JSON.stringify(distJson), releaseId]
            );
          }
        } catch (err) {
          console.error("❌ Error parsing distribution_json:", err);
        }
      }
    }

    // (Optional) Single-only mirroring for contributors/artists if you still want it.
    // Your earlier logic already covered that elsewhere; keeping it unchanged.

    // Return updated row
    const [[updated]] = await execute(
      "SELECT * FROM releases WHERE id = ?",
      [releaseId]
    );
    updated.status = toStatus(updated.status);

    return res.json({ success: true, release: updated });
  } catch (err) {
    console.error("❌ Update error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Update failed" });
  }
});




// =============== ARTWORK ===============
router.post(
  "/releases/:id/artwork",
  verifyToken,
  upload.single("artwork"),
  async (req, res) => {
    const releaseId = req.params.id;
    const artworkFile = req.file;
    if (!artworkFile) {
      return res
        .status(400)
        .json({ success: false, message: "No image uploaded" });
    }
    const artworkUrl = `/uploads/artworks/${artworkFile.filename}`;
    try {
      await execute("UPDATE releases SET artwork_url = ? WHERE id = ?", [
        artworkUrl,
        releaseId,
      ]);
      res.json({ success: true, artworkUrl });
    } catch (err) {
      console.error("Artwork upload error:", err);
      res.status(500).json({ success: false });
    }
  }
);

// =============== RELEASE ARTISTS (read) ===============
router.get("/releases/:id/artists", verifyToken, async (req, res) => {
  const releaseId = req.params.id;
  const userId = req.user.userId;

  try {
    const [[rel]] = await execute(
      "SELECT id FROM releases WHERE id = ? AND user_id = ?",
      [releaseId, userId]
    );
    if (!rel) {
      return res.status(404).json({ success: false, message: "Release not found" });
    }

    // 🔧 ensure DB is consistent before returning rows
    await normalizeReleaseMainArtist(releaseId);

    const [rows] = await execute(
      `SELECT
         id,
         release_id,
         artist_name,
         artist_legal_name,
         artist_type,
         artist_country,
         artist_genre,
         artist_language,
         artist_spotify_url,
         artist_apple_url,
         created_at,
         updated_at
       FROM release_artists
       WHERE release_id = ?
       ORDER BY id ASC`,
      [releaseId]
    );

    return res.json({ success: true, artists: rows });
  } catch (err) {
    console.error("❌ Failed to fetch release artists:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});



// =============== CONTRIBUTORS CRUD (+ search/frequent) ===============
router.get("/releases/:id/contributors", verifyToken, async (req, res) => {
  const releaseId = req.params.id;
  try {
    const [rows] = await execute(
      `SELECT id, contributor_name AS name FROM release_contributors WHERE release_id = ?`,
      [releaseId]
    );
    res.json({ success: true, contributors: rows });
  } catch (err) {
    console.error("❌ Failed to fetch contributors:", err);
    res.status(500).json({ success: false, message: "Fetch error" });
  }
});

router.post("/releases/:id/contributors", verifyToken, async (req, res) => {
  const releaseId = req.params.id;
  const userId = req.user.userId;
  const { contributor_name } = req.body;

  if (!contributor_name || !releaseId) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Missing contributor name or release ID",
      });
  }

  try {
    const [existing] = await execute(
      "SELECT id FROM release_contributors WHERE contributor_name = ? AND user_id = ?",
      [contributor_name, userId]
    );

    if (existing.length > 0) {
      const existingContributorId = existing[0].id;
      await execute(
        "UPDATE release_contributors SET release_id = ? WHERE id = ?",
        [releaseId, existingContributorId]
      );
      return res.json({
        success: true,
        id: existingContributorId,
        reused: true,
      });
    } else {
      const [insert] = await execute(
        "INSERT INTO release_contributors (contributor_name, release_id, user_id) VALUES (?, ?, ?)",
        [contributor_name, releaseId, userId]
      );
      return res.json({ success: true, id: insert.insertId, reused: false });
    }
  } catch (err) {
    console.error("❌ Failed to add contributor:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
});

router.put(
  "/releases/:releaseId/contributors/:id",
  verifyToken,
  async (req, res) => {
    const contributorId = req.params.id;
    const { contributor_category, contributor_role, contributor_role_type } =
      req.body;

    try {
      const updates = [];
      const values = [];

      if (contributor_category !== undefined) {
        updates.push("contributor_category = ?");
        values.push(contributor_category);
      }
      if (contributor_role !== undefined) {
        updates.push("contributor_role = ?");
        values.push(contributor_role);
      }
      if (contributor_role_type !== undefined) {
        updates.push("contributor_role_type = ?");
        values.push(contributor_role_type);
      }

      if (!updates.length) {
        return res
          .status(400)
          .json({ success: false, message: "No fields to update" });
      }

      values.push(contributorId);
      await execute(
        `UPDATE release_contributors SET ${updates.join(", ")} WHERE id = ?`,
        values
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Error updating contributor:", err);
      res.status(500).json({ success: false });
    }
  }
);

router.delete(
  "/releases/:releaseId/contributors/:id",
  verifyToken,
  async (req, res) => {
    const { id } = req.params;
    try {
      await execute("DELETE FROM release_contributors WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting contributor:", err);
      res.status(500).json({ success: false, message: "Delete failed" });
    }
  }
);

router.put(
  "/releases/:releaseId/contributors/:id/disconnect",
  verifyToken,
  async (req, res) => {
    const contributorId = req.params.id;
    const releaseId = req.params.releaseId;
    try {
      await execute(
        `UPDATE release_contributors SET release_id = NULL WHERE id = ? AND release_id = ?`,
        [contributorId, releaseId]
      );
      res.json({
        success: true,
        message: "Contributor disconnected from release.",
      });
    } catch (err) {
      console.error("Error disconnecting contributor:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to disconnect contributor." });
    }
  }
);

router.get(
  "/releases/:id/contributors/search",
  verifyToken,
  async (req, res) => {
    const { name } = req.query;
    try {
      const [results] = await execute(
        `SELECT DISTINCT contributor_name FROM release_contributors WHERE contributor_name LIKE ? LIMIT 5`,
        [`%${name}%`]
      );
      res.json({ success: true, results });
    } catch (err) {
      console.error("Search contributors error:", err);
      res.status(500).json({ success: false });
    }
  }
);

router.get("/contributors/frequent", verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const [rows] = await execute(
      `
      SELECT contributor_name AS name, COUNT(*) AS uses
      FROM release_contributors
      WHERE user_id = ?
      GROUP BY contributor_name
      ORDER BY uses DESC
      LIMIT 5
      `,
      [userId]
    );
    res.json({ success: true, contributors: rows });
  } catch (err) {
    console.error("Failed to load frequent contributors:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// =============== ARTISTS helpers ===============
router.post("/releases/:releaseId/artists", verifyToken, async (req, res) => {
  const { releaseId } = req.params;
  const {
    artist_name,
    artist_legal_name,
    artist_type,
    artist_country,
    artist_genre,
    artist_language,
    artist_spotify_url,
    artist_apple_url,
  } = req.body;

  try {
    const [existing] = await execute(
      `SELECT id FROM release_artists WHERE release_id = ? AND LOWER(artist_name) = LOWER(?)`,
      [releaseId, artist_name]
    );
    if (existing.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Artist "${artist_name}" already exists.`,
        });
    }

    const [insertResult] = await execute(
      `INSERT INTO release_artists 
      (release_id, artist_name, artist_legal_name, artist_type, artist_country, artist_genre, artist_language, artist_spotify_url, artist_apple_url, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        releaseId,
        artist_name,
        artist_legal_name,
        artist_type,
        artist_country,
        artist_genre,
        artist_language,
        artist_spotify_url,
        artist_apple_url,
      ]
    );

    const artistId = insertResult.insertId;

    const [artists] = await execute(
      `SELECT artist_name FROM release_artists WHERE release_id = ?`,
      [releaseId]
    );
    const artistNamesArray = artists.map((a) => a.artist_name);

    const [[release]] = await execute(
      `SELECT r.project_name, r.release_type FROM releases r WHERE r.id = ?`,
      [releaseId]
    );

    const projectName = release?.project_name || "Unknown Project";
    const releaseType = release?.release_type || "Single";

    const fullArtistList = [
      projectName,
      ...artistNamesArray.filter(
        (name) =>
          name.trim().toLowerCase() !== projectName.trim().toLowerCase()
      ),
    ];

    await execute("UPDATE releases SET artists_json = ? WHERE id = ?", [
      JSON.stringify(fullArtistList),
      releaseId,
    ]);

    if (releaseType === "Single") {
      const structuredTrackArtistsJson = JSON.stringify(
        fullArtistList.map((name) => ({ name }))
      );
      await execute(
        "UPDATE release_tracks SET track_artists_json = ? WHERE release_id = ?",
        [structuredTrackArtistsJson, releaseId]
      );
    }

    await normalizeReleaseMainArtist(releaseId);   // 🔧 keep main first & dedup
    res.json({
      success: true,
      id: artistId,
      artists: fullArtistList,
      message: "Artist added and synced successfully.",
    });
  } catch (error) {
    console.error("Error creating artist:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/releases/:releaseId/artists-json", verifyToken, async (req, res) => {
  const { releaseId } = req.params;
  let { artistNames } = req.body;

  try {
    if (!Array.isArray(artistNames)) {
      try { artistNames = JSON.parse(artistNames); } catch {}
    }
    if (!Array.isArray(artistNames)) {
      return res.status(400).json({ success: false, message: "artistNames must be an array" });
    }

    const [[rel]] = await execute(
      "SELECT COALESCE(project_name,'') AS project_name FROM releases WHERE id = ?",
      [releaseId]
    );
    if (!rel) return res.status(404).json({ success: false, message: "Release not found" });

    const main = String(rel.project_name || "").trim();

    // A) releases.artists_json => enforce main first
    const nextNames = forceFirstStrArr(artistNames, main);
    await execute("UPDATE releases SET artists_json = ? WHERE id = ?", [JSON.stringify(nextNames), releaseId]);

    // B) release_artists first row
    const [rows] = await execute("SELECT id FROM release_artists WHERE release_id = ? ORDER BY id ASC", [releaseId]);
    if (rows && rows.length) {
      await execute("UPDATE release_artists SET artist_name = ? WHERE id = ?", [main, rows[0].id]);
    } else {
      await execute("INSERT INTO release_artists (release_id, artist_name) VALUES (?, ?)", [releaseId, main]);
    }

    // C) tracks: keep main first in object array
    const [tracks] = await execute(
      "SELECT id, COALESCE(track_artists_json,'') AS track_artists_json FROM release_tracks WHERE release_id = ?",
      [releaseId]
    );
    for (const t of tracks || []) {
      let objs = [];
      try { const parsed = JSON.parse(t.track_artists_json || "[]"); if (Array.isArray(parsed)) objs = parsed; } catch {}
      const nextObjs = forceFirstObjArr(objs, main);
      await execute("UPDATE release_tracks SET track_artists_json = ? WHERE id = ?", [JSON.stringify(nextObjs), t.id]);
    }

    await normalizeReleaseMainArtist(releaseId);   // 🔧
    res.json({ success: true });

  } catch (err) {
    console.error("Error updating artists_json and syncing:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.put(
  "/releases/:releaseId/contributors-json",
  verifyToken,
  async (req, res) => {
    const { releaseId } = req.params;
    const { contributors } = req.body;

    if (!Array.isArray(contributors)) {
      return res
        .status(400)
        .json({ success: false, message: "contributors must be an array" });
    }

    try {
      const contributorsJson = JSON.stringify(contributors);
      await execute("UPDATE releases SET contributors_json = ? WHERE id = ?", [
        contributorsJson,
        releaseId,
      ]);

      const [[release]] = await execute(
        "SELECT release_type FROM releases WHERE id = ?",
        [releaseId]
      );

      if (release?.release_type === "Single") {
        await execute(
          "UPDATE release_tracks SET track_contributors_json = ? WHERE release_id = ?",
          [contributorsJson, releaseId]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Error updating contributors_json and syncing:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// =============== ARTISTS search helpers ===============
router.get(
  "/releases/:releaseId/artists/search",
  verifyToken,
  async (req, res) => {
    const { releaseId } = req.params;
    const { name } = req.query;
    try {
      const [results] = await execute(
        `SELECT id, artist_name FROM release_artists WHERE release_id = ? AND artist_name LIKE ? LIMIT 5`,
        [releaseId, `%${name}%`]
      );
      res.json({ success: true, results });
    } catch (err) {
      console.error("Error searching artists:", err);
      res.status(500).json({ success: false });
    }
  }
);

// =============== TRACKS bulk update of artists_json ===============
router.put(
  "/releases/:releaseId/tracks/update-artists",
  verifyToken,
  async (req, res) => {
    const { releaseId } = req.params;
    let { track_artists_json } = req.body;

    try {
      // 1) Load main artist from this release
      const [[rel]] = await execute(
        "SELECT COALESCE(project_name,'') AS project_name, COALESCE(release_type,'') AS release_type FROM releases WHERE id = ?",
        [releaseId]
      );
      if (!rel) {
        return res
          .status(404)
          .json({ success: false, message: "Release not found" });
      }
      const main = String(rel.project_name || "").trim();

      // 2) Normalize inbound payload
      let arr = track_artists_json;
      if (typeof arr === "string") {
        try { arr = JSON.parse(arr); } catch { arr = []; }
      }
      if (!Array.isArray(arr)) {
        return res.status(400).json({
          success: false,
          message: "track_artists_json must be an array (strings or {name})",
        });
      }

      // Accept strings or objects, trim names, drop empties
      const asObjs = arr
        .map(a => (typeof a === "string" ? { name: a } : a))
        .filter(o => o && Object.prototype.hasOwnProperty.call(o, "name"))
        .map(o => ({ ...o, name: String(o.name || "").trim() }))
        .filter(o => o.name);

      // 3) Force main first and de-dupe by name (case-insensitive)
      const normalized = forceFirstObjArr(asObjs, main);

      // 4) Persist to all tracks on this release
      await execute(
        "UPDATE release_tracks SET track_artists_json = ? WHERE release_id = ?",
        [JSON.stringify(normalized), releaseId]
      );

      // 5) If Single, mirror a flat artists_json on the release too
      if (String(rel.release_type) === "Single") {
        const flat = normalized.map(o => o.name);
        const flatDedup = forceFirstStrArr(flat, main);
        await execute(
          "UPDATE releases SET artists_json = ? WHERE id = ?",
          [JSON.stringify(flatDedup), releaseId]
        );
      }

      return res.json({ success: true, count: normalized.length });
    } catch (err) {
      console.error("Failed to update all track artists:", err);
      return res
        .status(500)
        .json({ success: false, message: "Server error" });
    }
  }
);


// =============== artists frequent (global) ===============
router.get("/artists/frequent", verifyToken, async (_req, res) => {
  try {
    const [rows] = await execute(
      `
      SELECT artist_name, COUNT(*) AS uses
      FROM release_artists
      GROUP BY artist_name
      ORDER BY uses DESC
      LIMIT 5
      `
    );
    res.json({ success: true, artists: rows });
  } catch (err) {
    console.error("Failed to load frequent artists:", err);
    res.status(500).json({ success: false });
  }
});

// =============== DELETE RELEASE (guarded) ===============
router.delete("/releases/:id", verifyToken, async (req, res) => {
  const releaseId = Number(req.params.id);
  const userId = req.user.userId;

  try {
    // 1) Permission check
    const can = await canDeleteRelease(userId, releaseId);
    if (!can.ok) {
      const msg =
        can.reason === "not_found" ? "Release not found" :
        can.reason === "not_owner" ? "This release does not belong to you" :
        "You are not allowed to delete releases.";
      const code = can.reason === "not_found" ? 404 : (can.reason === "not_owner" ? 403 : 403);
      return res.status(code).json({ success: false, message: msg });
    }

    // 2) Ensure still Draft
    const [[release]] = await execute(
      "SELECT id, status FROM releases WHERE id = ? AND user_id = ?",
      [releaseId, userId]
    );
    if (!release) {
      return res.status(404).json({ success: false, message: "Release not found" });
    }
    if (toStatus(release.status) !== "Draft") {
      return res.status(400).json({ success: false, message: "Only Draft releases can be deleted." });
    }

    // 3) Delete (tracks first, then release)
    await execute("DELETE FROM release_tracks WHERE release_id = ?", [releaseId]);
    await execute("DELETE FROM releases WHERE id = ? AND user_id = ?", [releaseId, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to delete release:", err);
    res.status(500).json({ success: false });
  }
});




// =============== TRACKS: create ===============
router.post(
  "/releases/:id/tracks",
  verifyToken,
  trackUpload.single("track_file"),
  async (req, res) => {
    const releaseId = req.params.id;
    const file = req.file;

    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "No track file uploaded" });
    }

    const {
      track_isrc,
      track_duration,
      track_title,
      track_display_title,
      track_version,
      track_primary_genre,
      track_sub_genre,
      track_metadata_language,
      track_metadata_country,
      track_audio_language,
      track_p_line_year,
      track_p_line_owner,
      track_recording_country,
      track_apple_digital_master,
      track_sample_length,
      track_tiktok_start,
      track_volume,
      track_type,
      track_publisher_name,
      track_work_title,
      track_split_percentage,
      track_publishing_country,
      track_rights_admin,
      track_affiliation,
      track_wmg_filename,
      track_contributors_json,
      current_exclusivity,
    } = req.body;

    try {
      const originalName = path.parse(file.originalname).name;
      const fileExt = path.extname(file.originalname).toLowerCase();
      const uniqueFileName = `${originalName}${fileExt}`;

      const trackDir = path.join(__dirname, "../uploads/tracks");
      if (!fs.existsSync(trackDir)) {
        fs.mkdirSync(trackDir, { recursive: true });
      }

      const trackPath = path.join(trackDir, uniqueFileName);
      fs.writeFileSync(trackPath, file.buffer);

      const cleanTitle = track_display_title || track_title || originalName;
      const volumeToUse = track_volume?.trim() || "Vol.1";

      const [insertResult] = await execute(
        `INSERT INTO release_tracks (
        release_id, track_file_name, track_isrc, track_duration,
        track_title, track_display_title, track_version,
        track_primary_genre, track_sub_genre, track_metadata_language, track_metadata_country, track_audio_language,
        track_p_line_year, track_p_line_owner, track_recording_country, track_apple_digital_master,
        track_sample_length, track_tiktok_start, track_volume, track_type,
        track_publisher_name, track_work_title, track_split_percentage, track_publishing_country,
        track_rights_admin, track_affiliation, track_wmg_filename, track_contributors_json,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          releaseId,
          uniqueFileName,
          track_isrc ?? null,
          track_duration ?? null,
          track_title ?? null,
          track_display_title ?? null,
          track_version ?? null,
          track_primary_genre ?? null,
          track_sub_genre ?? null,
          track_metadata_language ?? null,
          track_metadata_country ?? null,
          track_audio_language ?? null,
          track_p_line_year ?? null,
          track_p_line_owner ?? null,
          track_recording_country ?? null,
          track_apple_digital_master ?? null,
          track_sample_length ?? null,
          track_tiktok_start ?? null,
          volumeToUse,
          track_type ?? null,
          track_publisher_name ?? null,
          track_work_title ?? null,
          track_split_percentage ?? null,
          track_publishing_country ?? null,
          track_rights_admin ?? null,
          track_affiliation ?? null,
          track_wmg_filename ?? null,
          track_contributors_json ?? null,
          "ready",
        ]
      );

      const newTrackId = insertResult.insertId;

      const [[release]] = await execute(
        "SELECT territory, partner_exclusivity, distribution_json FROM releases WHERE id = ?",
        [releaseId]
      );

      const rawTerritory = release?.territory || "Worldwide";
      const rawExclusivity =
        current_exclusivity || release?.partner_exclusivity || "All Partners";

      const cleanTerritory = rawTerritory.replace(/^'+|'+$/g, "");
      const cleanExclusivity = rawExclusivity.replace(/^'+|'+$/g, "");

      if (current_exclusivity && current_exclusivity !== release?.partner_exclusivity) {
        await execute("UPDATE releases SET partner_exclusivity = ? WHERE id = ?", [
          current_exclusivity,
          releaseId,
        ]);
      }

      let distributionJson = [];
      if (release?.distribution_json) {
        try {
          distributionJson = JSON.parse(release.distribution_json);
        } catch (err) {
          console.error("❌ Failed to parse distribution_json:", err);
        }
      }

      const nextDistNumber = (distributionJson?.length || 0) + 1;

      const newDistribution = {
        name: `Distribution ${nextDistNumber}`,
        territory: cleanTerritory,
        exclusivity: cleanExclusivity,
        volumes: [
          {
            name: "Volume 1",
            tracks: [
              {
                id: newTrackId,
                number: `${cleanTitle}${fileExt}`,
                track_file_name: uniqueFileName,
                price: "1 Mid Track Single",
                pd: "Yes",
                etu: "Yes",
                adss: "Yes",
                ugc: "Monetize",
                igtDate: "",
              },
            ],
          },
        ],
      };

      distributionJson.push(newDistribution);

      await execute(
        "UPDATE releases SET distribution_json = ? WHERE id = ?",
        [JSON.stringify(distributionJson), releaseId]
      );

      res.json({
        success: true,
        message: "Track uploaded and saved",
        track_id: newTrackId,
      });
    } catch (err) {
      console.error("❌ Error saving track:", err);
      res
        .status(500)
        .json({ success: false, message: "Track save failed" });
    }
  }
);

// =============== TRACKS: list, bulk update, play, update, replace, delete ===============
router.get("/releases/:id/tracks", verifyToken, async (req, res) => {
  const releaseId = req.params.id;
  try {
    const [tracks] = await execute(
      "SELECT * FROM release_tracks WHERE release_id = ?",
      [releaseId]
    );
    res.json({ success: true, tracks });
  } catch (err) {
    console.error("❌ Error fetching tracks:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch tracks" });
  }
});

router.put("/releases/:id/tracks", verifyToken, async (req, res) => {
  const releaseId = req.params.id;
  let { track_artists_json } = req.body;

  try {
    // load main
    const [[rel]] = await execute("SELECT COALESCE(project_name,'') AS project_name FROM releases WHERE id = ?", [releaseId]);
    if (!rel) return res.status(404).json({ success: false, message: "Release not found" });
    const main = String(rel.project_name || "").trim();

    // normalize input (accept array of strings or array of objects)
    if (typeof track_artists_json === "string") {
      try { track_artists_json = JSON.parse(track_artists_json); } catch {}
    }
    if (!Array.isArray(track_artists_json)) {
      return res.status(400).json({ success: false, message: "track_artists_json must be an array" });
    }
    const asObjs = track_artists_json.map((a) => (typeof a === "string" ? { name: a } : a));
    const normalized = forceFirstObjArr(asObjs, main);

    await execute(
      "UPDATE release_tracks SET track_artists_json = ? WHERE release_id = ?",
      [JSON.stringify(normalized), releaseId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Bulk update of track_artists_json failed:", err);
    res.status(500).json({ success: false, message: "Failed to update" });
  }
});


router.get("/tracks/:trackId/play", verifyToken, async (req, res) => {
  const { trackId } = req.params;
  try {
    const [[track]] = await execute(
      "SELECT track_file_name FROM release_tracks WHERE id = ?",
      [trackId]
    );
    if (!track) return res.status(404).send("Track not found");
    const trackPath = path.join(
      __dirname,
      "../uploads/tracks",
      track.track_file_name
    );
    if (!fs.existsSync(trackPath)) return res.status(404).send("File not found on server");
    res.sendFile(trackPath);
  } catch (err) {
    console.error("❌ Streaming error:", err);
    res.status(500).send("Streaming failed");
  }
});

router.put("/tracks/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const allowedFields = [
    "track_isrc",
    "track_title",
    "track_display_title",
    "track_version",
    "track_primary_genre",
    "track_sub_genre",
    "track_metadata_language",
    "track_metadata_country",
    "track_audio_language",
    "track_p_line_year",
    "track_p_line_owner",
    "track_recording_country",
    "track_sample_length",
    "track_tiktok_start",
    "track_apple_digital_master",
    "track_volume",
    "track_type",
    "track_work_title",
    "track_publishing_country",
    "track_affiliation",
    "track_rights_admin",
    "track_wmg_filename",
    "track_artists_json",
    "track_contributors_json",
    "track_parental",
  ];

  try {
    // if we're updating artists, grab release main
    let main = "";
    let wantArtists = false;
    if (Object.prototype.hasOwnProperty.call(req.body, "track_artists_json")) {
      const [[t]] = await execute("SELECT release_id FROM release_tracks WHERE id = ?", [id]);
      if (!t) return res.status(404).json({ success: false, message: "Track not found" });
      const [[rel]] = await execute("SELECT COALESCE(project_name,'') AS project_name FROM releases WHERE id = ?", [t.release_id]);
      main = String(rel?.project_name || "").trim();
      wantArtists = true;
    }

    const updates = [];
    const values = [];

    for (let [key, value] of Object.entries(req.body)) {
      if (!allowedFields.includes(key)) continue;

      if (key === "track_artists_json") {
        // normalize payload
        try { value = typeof value === "string" ? JSON.parse(value) : value; } catch {}
        const asObjs = (Array.isArray(value) ? value : []).map((a) => (typeof a === "string" ? { name: a } : a));
        value = JSON.stringify(wantArtists ? forceFirstObjArr(asObjs, main) : asObjs);
      }

      updates.push(`${key} = ?`);
      values.push(value);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No valid fields provided." });
    }

    values.push(id);
    await execute(`UPDATE release_tracks SET ${updates.join(", ")} WHERE id = ?`, values);
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating track field:", err);
    res.status(500).json({ success: false, message: "Update failed." });
  }
});


const { getAudioDurationInSeconds } = require("get-audio-duration");


router.put(
  "/tracks/:id/replace",
  verifyToken,
  // accept any field name; we'll normalize below
  trackUpload.any(),
  async (req, res) => {
    const trackId = Number(req.params.id);

    try {
      if (!Number.isFinite(trackId)) {
        return res.status(400).json({ success: false, message: "Invalid track id" });
      }

      // pick the uploaded file from either "track_file" or "file"
      const file =
        (req.files || []).find((f) => f.fieldname === "track_file") ||
        (req.files || []).find((f) => f.fieldname === "file");

      if (!file) {
        return res.status(400).json({ success: false, message: "No file uploaded (track_file)" });
      }

      // validate WAV (common MIME variants) or extension
      const okTypes = new Set(["audio/wav", "audio/wave", "audio/x-wav"]);
      const isWav = okTypes.has(file.mimetype) || /\.wav$/i.test(file.originalname || "");
      if (!isWav) {
        return res.status(400).json({ success: false, message: "Only WAV files are allowed" });
      }

      // ensure target dir
      const dir = path.join(__dirname, "../uploads/tracks");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // KEEP the original filename (sanitize to basename to prevent path traversal)
      const fileName = path.basename(file.originalname || "track.wav");
      const fullPath = path.join(dir, fileName);

      // memoryStorage -> write buffer to disk (overwrite if exists)
      fs.writeFileSync(fullPath, file.buffer);

      // try to compute duration, but don't fail replace if it errors
      let formattedDuration = null;
      try {
        const seconds = await getAudioDurationInSeconds(fullPath);
        formattedDuration = formatDuration(seconds);
      } catch (e) {
        console.warn("⚠ duration calc failed; continuing without duration:", e.message);
      }

      // update DB (and fetch release_id for distribution_json sync)
      const [[current]] = await execute(
        "SELECT release_id FROM release_tracks WHERE id = ?",
        [trackId]
      );
      if (!current) {
        return res.status(404).json({ success: false, message: "Track not found" });
      }

      await execute(
        "UPDATE release_tracks SET track_file_name = ?, track_duration = ?, status = 'ready' WHERE id = ?",
        [fileName, formattedDuration, trackId]
      );

      // keep releases.distribution_json in sync (track_file_name)
      try {
        const [[rel]] = await execute(
          "SELECT distribution_json FROM releases WHERE id = ?",
          [current.release_id]
        );
        if (rel && rel.distribution_json) {
          let dist = JSON.parse(rel.distribution_json);
          if (Array.isArray(dist)) {
            let changed = false;
            dist = dist.map((d) => {
              if (!d?.volumes) return d;
              const volumes = d.volumes.map((v) => {
                if (!v?.tracks) return v;
                const tracks = v.tracks.map((t) =>
                  Number(t?.id) === trackId ? { ...t, track_file_name: fileName } : t
                );
                if (tracks !== v.tracks) changed = true;
                return { ...v, tracks };
              });
              return { ...d, volumes };
            });
            if (changed) {
              await execute(
                "UPDATE releases SET distribution_json = ? WHERE id = ?",
                [JSON.stringify(dist), current.release_id]
              );
            }
          }
        }
      } catch (syncErr) {
        console.warn("⚠ distribution_json sync failed:", syncErr.message);
      }

      return res.json({
        success: true,
        message: "Track replaced successfully",
        fileName,
        duration: formattedDuration,
      });
    } catch (err) {
      console.error("❌ Error replacing track:", err);
      return res.status(500).json({ success: false, message: "Replace failed" });
    }
  }
);



router.delete("/tracks/:id", verifyToken, async (req, res) => {
  const trackId = req.params.id;
  try {
    const [[track]] = await execute(
      "SELECT release_id FROM release_tracks WHERE id = ?",
      [trackId]
    );
    if (!track) {
      return res
        .status(404)
        .json({ success: false, message: "Track not found" });
    }

    const releaseId = track.release_id;
    await execute("DELETE FROM release_tracks WHERE id = ?", [trackId]);

    const [remainingTracks] = await execute(
      "SELECT id FROM release_tracks WHERE release_id = ?",
      [releaseId]
    );

    if (remainingTracks.length === 0) {
      await execute(
        "UPDATE releases SET distribution_json = NULL, territory = 'Worldwide', partner_exclusivity = 'All Partners' WHERE id = ?",
        [releaseId]
      );
    } else {
      const [[release]] = await execute(
        "SELECT distribution_json, territory, partner_exclusivity FROM releases WHERE id = ?",
        [releaseId]
      );
      if (release && release.distribution_json) {
        try {
          const parsedDistribution = JSON.parse(release.distribution_json);
          const updatedDistributionJson = parsedDistribution
            .map((distribution) => ({
              ...distribution,
              volumes: distribution.volumes
                .map((volume) => ({
                  ...volume,
                  tracks: volume.tracks.filter(
                    (t) => t.id !== Number(trackId)
                  ),
                }))
                .filter((volume) => volume.tracks.length > 0),
              territory: release.territory,
              exclusivity: release.partner_exclusivity,
            }))
            .filter((distribution) => distribution.volumes.length > 0);

          const newDistributionJson =
            updatedDistributionJson.length > 0
              ? updatedDistributionJson
              : null;

          await execute(
            "UPDATE releases SET distribution_json = ? WHERE id = ?",
            [
              newDistributionJson ? JSON.stringify(newDistributionJson) : null,
              releaseId,
            ]
          );
        } catch (err) {
          console.error("❌ Error parsing distribution_json:", err);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting track or updating distribution_json:", err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

// =============== SYNC distribution_json ===============
router.post(
  "/releases/:releaseId/sync-distribution-json",
  verifyToken,
  async (req, res) => {
    const { releaseId } = req.params;

    try {
      const [[releaseInfo]] = await execute(
        "SELECT territory, partner_exclusivity FROM releases WHERE id = ?",
        [releaseId]
      );

      const currentTerritory = releaseInfo?.territory || "Worldwide";
      const currentExclusivity =
        releaseInfo?.partner_exclusivity || "All Partners";

      const [tracks] = await execute(
        "SELECT * FROM release_tracks WHERE release_id = ?",
        [releaseId]
      );

      const distribution = {
        name: "Distribution 1",
        territory: currentTerritory,
        exclusivity: currentExclusivity,
        volumes: [],
      };

      const volumeMap = {};

      tracks.forEach((track) => {
        const volName = track.track_volume?.trim() || "Vol.1";

        if (!volumeMap[volName]) {
          volumeMap[volName] = { name: volName, tracks: [] };
          distribution.volumes.push(volumeMap[volName]);
        }

        volumeMap[volName].tracks.push({
          id: track.id,
          number: `${volumeMap[volName].tracks.length + 1}. ${
            track.track_display_title ||
            track.track_title ||
            track.track_file_name
          }`,
          track_file_name: track.track_file_name,
          price: track.price_code || "1 Mid Track Single",
          pd: track.pd || "Yes",
          etu: track.etu || "Yes",
          adss: track.adss || "Yes",
          ugc: track.ugc || "Monetize",
          igtDate: track.igt_date || "",
        });
      });

      distribution.volumes.sort((a, b) => {
        const aNum = parseInt(a.name.replace("Vol.", ""), 10) || 0;
        const bNum = parseInt(b.name.replace("Vol.", ""), 10) || 0;
        return aNum - bNum;
      });

      await execute("UPDATE releases SET distribution_json = ? WHERE id = ?", [
        JSON.stringify([distribution]),
        releaseId,
      ]);

      res.json({ success: true, distribution_json: [distribution] });
    } catch (err) {
      console.error("🔥 Error syncing distribution_json:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to sync distribution_json" });
    }
  }
);

// =============== small helpers ===============
router.get(
  "/releases/:releaseId/tracks-count",
  verifyToken,
  async (req, res) => {
    const { releaseId } = req.params;
    try {
      const [[{ count }]] = await execute(
        "SELECT COUNT(*) as count FROM release_tracks WHERE release_id = ?",
        [releaseId]
      );
      res.json({ count });
    } catch (err) {
      console.error("Error counting tracks:", err);
      res.status(500).json({ count: 0 });
    }
  }
);

router.get(
  "/releases/:releaseId/track-volumes",
  verifyToken,
  async (req, res) => {
    const { releaseId } = req.params;
    try {
      const [tracks] = await execute(
        "SELECT DISTINCT track_volume FROM release_tracks WHERE release_id = ?",
        [releaseId]
      );
      const volumes = tracks
        .map((row) => row.track_volume || "Vol.1")
        .filter((volume) => volume && volume.trim() !== "");
      res.json({ success: true, volumes });
    } catch (err) {
      console.error("❌ Error fetching track volumes:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch track volumes" });
    }
  }
);

// =============== EXPORT EXCEL ===============
const pricingTiers = {
  "1 Low Track Single": "1 Low Track Single - 0.69 USD | 0.69 EUR | 0.59 GBP",
  "1 Mid Track Single": "1 Mid Track Single - 0.99 USD | 0.99 EUR | 0.79 GBP",
  "1 Premium Track Single":
    "1 Premium Track Single - 1.29 USD | 1.29 EUR | 0.99 GBP",
  "2 Mid Track Bundle": "2 Mid Track Bundle - 1.29 USD | 1.29 EUR | 1.49 GBP",
  "2 Premium Track Bundle":
    "2 Premium Track Bundle - 1.99 USD | 1.99 EUR | 1.89 GBP",
  "3 Mid Track Bundle": "3 Mid Track Bundle - 1.99 USD | 2.49 EUR | 1.99 GBP",
  "3 Premium Track Bundle":
    "3 Premium Track Bundle - 2.99 USD | 2.49 EUR | 2.49 GBP",
  "4 Mid Track Bundle": "4 Mid Track Bundle - 2.99 USD | 2.99 EUR | 2.49 GBP",
  "4 Premium Track Bundle":
    "4 Premium Track Bundle - 3.99 USD | 3.99 EUR | 3.49 GBP",
  "5 Mid Track Bundle": "5 Mid Track Bundle - 3.99 USD | 3.49 EUR | 2.99 GBP",
  "5 Premium Track Bundle":
    "5 Premium Track Bundle - 4.99 USD | 3.99 EUR | 3.99 GBP",
  "6 Mid Track Bundle": "6 Mid Track Bundle - 4.99 USD | 3.99 EUR | 3.99 GBP",
  "6 Premium Track Bundle":
    "6 Premium Track Bundle - 5.99 USD | 4.99 EUR | 4.99 GBP",
  "7 Mid Track Bundle": "7 Mid Track Bundle - 5.99 USD | 5.99 EUR | 4.99 GBP",
  "7 Premium Track Bundle":
    "7 Premium Track Bundle - 8.99 USD | 7.99 EUR | 5.99 GBP",
  "8 Mid Track Bundle": "8 Mid Track Bundle - 6.99 USD | 6.99 EUR | 5.99 GBP",
  "8 Premium Track Bundle":
    "8 Premium Track Bundle - 9.99 USD | 8.99 EUR | 6.99 GBP",
  "Budget Frontline Album":
    "Budget Frontline Album - 7.99 USD | 8.99 EUR | 5.99 GBP",
  "Bundle 10": "Bundle 10 - 9.99 USD | 9.99 EUR | 8.99 GBP",
  "Bundle 100": "Bundle 100 - 99.99 USD | 109.99 EUR | 99.99 GBP",
  "Bundle 105": "Bundle 105 - 109.99 USD | 119.99 EUR | 109.99 GBP",
  "Bundle 11": "Bundle 11 - 10.99 USD | 10.99 EUR | 9.99 GBP",
  "Bundle 110": "Bundle 110 - 109.99 USD | 119.99 EUR | 109.99 GBP",
  "Bundle 115": "Bundle 115 - 119.99 USD | 129.99 EUR | 119.99 GBP",
  "Bundle 12": "Bundle 12 - 11.99 USD | 11.99 EUR | 10.99 GBP",
  "Bundle 120": "Bundle 120 - 119.99 USD | 129.99 EUR | 119.99 GBP",
  "Bundle 125": "Bundle 125 - 119.99 USD | 139.99 EUR | 129.99 GBP",
  "Bundle 13": "Bundle 13 - 12.99 USD | 12.99 EUR | 11.99 GBP",
  "Bundle 130": "Bundle 130 - 119.99 USD | 139.99 EUR | 129.99 GBP",
  "Bundle 135": "Bundle 135 - 119.99 USD | 149.99 EUR | 139.99 GBP",
  "Bundle 14": "Bundle 14 - 13.99 USD | 13.99 EUR | 12.99 GBP",
  "Bundle 140": "Bundle 140 - 119.99 USD | 149.99 EUR | 139.99 GBP",
  "Bundle 145": "Bundle 145 - 119.99 USD | 149.99 EUR | 139.99 GBP",
  "Bundle 15": "Bundle 15 - 14.99 USD | 14.99 EUR | 13.99 GBP",
  "Bundle 150": "Bundle 150 - 119.99 USD | 149.99 EUR | 139.99 GBP",
  "Bundle 16": "Bundle 16 - 15.99 USD | 15.99 EUR | 14.99 GBP",
  "Bundle 17": "Bundle 17 - 16.99 USD | 16.99 EUR | 15.99 GBP",
  "Bundle 18": "Bundle 18 - 17.99 USD | 18.99 EUR | 16.99 GBP",
  "Bundle 19": "Bundle 19 - 18.99 USD | 19.99 EUR | 17.99 GBP",
  "Bundle 20": "Bundle 20 - 19.99 USD | 24.99 EUR | 19.99 GBP",
  "Bundle 25": "Bundle 25 - 24.99 USD | 29.99 EUR | 24.99 GBP",
  "Bundle 30": "Bundle 30 - 29.99 USD | 34.99 EUR | 29.99 GBP",
  "Bundle 35": "Bundle 35 - 34.99 USD | 39.99 EUR | 34.99 GBP",
  "Bundle 40": "Bundle 40 - 39.99 USD | 44.99 EUR | 39.99 GBP",
  "Bundle 45": "Bundle 45 - 44.99 USD | 49.99 EUR | 44.99 GBP",
  "Bundle 50": "Bundle 50 - 49.99 USD | 59.99 EUR | 49.99 GBP",
  "Bundle 55": "Bundle 55 - 54.99 USD | 69.99 EUR | 59.99 GBP",
  "Bundle 60": "Bundle 60 - 59.99 USD | 69.99 EUR | 59.99 GBP",
  "Bundle 65": "Bundle 65 - 69.99 USD | 79.99 EUR | 69.99 GBP",
  "Bundle 70": "Bundle 70 - 69.99 USD | 79.99 EUR | 69.99 GBP",
  "Bundle 75": "Bundle 75 - 79.99 USD | 89.99 EUR | 79.99 GBP",
  "Bundle 8": "Bundle 8 - 7.99 USD | 7.99 EUR | 6.99 GBP",
  "Bundle 80": "Bundle 80 - 79.99 USD | 89.99 EUR | 79.99 GBP",
  "Bundle 85": "Bundle 85 - 89.99 USD | 99.99 EUR | 89.99 GBP",
  "Bundle 9": "Bundle 9 - 8.99 USD | 8.99 EUR | 7.99 GBP",
  "Bundle 90": "Bundle 90 - 89.99 USD | 99.99 EUR | 89.99 GBP",
  "Bundle 95": "Bundle 95 - 99.99 USD | 109.99 EUR | 99.99 GBP",
  "Deluxe 1": "Deluxe 1 - 10.99 USD | 10.99 EUR | 9.99 GBP",
  "Deluxe 2": "Deluxe 2 - 11.99 USD | 11.99 EUR | 10.99 GBP",
  "Deluxe 3": "Deluxe 3 - 12.99 USD | 12.99 EUR | 11.99 GBP",
  "Deluxe 4": "Deluxe 4 - 13.99 USD | 13.99 EUR | 11.99 GBP",
  "Deluxe 5": "Deluxe 5 - 14.99 USD | 13.99 EUR | 12.99 GBP",
  "Deluxe 6": "Deluxe 6 - 29.99 USD | 19.99 EUR | 12.99 GBP",
  "Mid Campaign": "Mid Campaign - 7.99 USD | 5.99 EUR | 4.99 GBP",
  "Rock bottom/budget campaign":
    "Rock bottom/budget campaign - 6.99 USD | 4.99 EUR | 3.99 GBP",
  "Standard 1": "Standard 1 - 7.99 USD | 8.99 EUR | 6.99 GBP",
  "Standard 2": "Standard 2 - 9.99 USD | 8.99 EUR | 6.99 GBP",
  "Standard 3": "Standard 3 - 9.99 USD | 9.99 EUR | 7.99 GBP",
  "Standard 4": "Standard 4 - 9.99 USD | 10.99 EUR | 8.99 GBP",
  "Standard 5": "Standard 5 - 10.99 USD | 10.99 EUR | 9.99 GBP",
  "Upper Campaign": "Upper Campaign - 7.99 USD | 6.99 EUR | 5.99 GBP",
  "Upper Campaign (Remix/Recently Released)":
    "Upper Campaign (Remix/Recently Released) - 7.99 USD | 7.99 EUR | 5.99 GBP",
};

router.post("/releases/:id/export-excel", verifyToken, async (req, res) => {
  const releaseId = req.params.id;
  const userId = req.user.userId;

  function formatDateForExcel(date) {
    if (!date) return "";
    const d = new Date(date);
    return `${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getDate()
      .toString()
      .padStart(2, "0")}/${d.getFullYear()}`;
  }
  function mapUGC(value) {
    if (!value) return "";
    return value.toLowerCase() === "monetize" ? "Monetise" : value;
  }
  function mapExclusivity(value) {
    if (!value) return "";
    const lower = value.toLowerCase();
    if (lower.includes("all")) return "All";
    if (lower.includes("only")) return "Only To";
    if (lower.includes("excl")) return "Excluding";
    return value;
  }

  try {
    const [[release]] = await execute(
      "SELECT * FROM releases WHERE id = ? AND user_id = ?",
      [releaseId, userId]
    );
    if (!release)
      return res
        .status(404)
        .json({ success: false, message: "Release not found" });

    const [tracks] = await execute(
      "SELECT * FROM release_tracks WHERE release_id = ?",
      [releaseId]
    );
    const distribution = JSON.parse(release.distribution_json || "[]");
    const distTracks = (distribution[0]?.volumes || []).flatMap((v) =>
      (v.tracks || []).map((t) => ({ ...t, volume: v.name }))
    );

    const templatePath = path.resolve(__dirname, "../templates/template.xlsx");
    if (!fs.existsSync(templatePath))
      return res
        .status(500)
        .json({ success: false, message: "Template not found" });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const productSheet = workbook.getWorksheet("PRODUCT");
    if (!productSheet)
      return res
        .status(500)
        .json({ success: false, message: "PRODUCT sheet missing" });

    const row = [];
    const dist = distTracks[0] || {};

    row[1] = 1;
    row[2] = release.gpid_type || "EAN";
    row[3] = release.gpid_code || "";
    row[4] = release.release_title || "";
    row[5] = tracks[0]?.track_version || "";
    row[6] = release.label || "";
    row[7] = release.label_catalog_number || "";
    row[8] = release.project_name || "";
    row[9] = "Digital";
    row[10] = release.release_type || "";
    row[11] = "Audio";
    row[12] = release.primary_genre || "";
    row[13] = release.sub_genre || "";
    row[14] = release.metadata_language || "";
    row[15] = release.meta_language_country || "";
    row[16] = release.p_line_year || "";
    row[17] = release.p_line_owner || "";
    row[18] = release.c_line_year || "";
    row[19] = release.c_line_owner || "";
    for (let i = 20; i <= 62; i++) row[i] = "";

    row[63] = "";
    row[64] = distribution[0]?.territory || "Worldwide";
    row[65] = distribution[0]?.countries?.join(", ") || "";
    row[66] = formatDateForExcel(release.product_release_date);
    row[67] = formatDateForExcel(dist.igtDate || release.preorder_date);
    row[68] = formatDateForExcel(release.original_release_date);
    row[69] = pricingTiers[dist.price] || "";
    row[70] = dist.pd || "";
    row[71] = dist.etu || "";
    row[72] = dist.adss || "";
    row[73] = mapUGC(dist.ugc);
    row[74] = mapExclusivity(release.partner_exclusivity);
    row[75] = "";
    row[76] = "";

    const productRow = productSheet.getRow(3);
    productRow.values = row;

    const productArtists = JSON.parse(release.artists_json || "[]").map((a) =>
      typeof a === "string" ? a : a.name
    );
    const primaryArtist = productArtists[0] || "";
    const flatDisplay = productArtists.join(", ");
    const isCompound = productArtists.length > 1;

    productRow.getCell("W").value = primaryArtist;
    productRow.getCell("X").value =
      release.release_type === "EP" || release.release_type === "Album"
        ? primaryArtist
        : flatDisplay;
    productRow.getCell("Y").value =
      release.release_type === "EP" || release.release_type === "Album"
        ? "Single Artist"
        : isCompound
        ? "Compound Artist"
        : "Single Artist";

    const relatedCols = [
      "Z",
      "AA",
      "AB",
      "AC",
      "AD",
      "AE",
      "AF",
      "AG",
      "AH",
      "AI",
    ];
    if (release.release_type !== "EP" && release.release_type !== "Album") {
      for (
        let i = 0;
        i < productArtists.length && i * 2 + 1 < relatedCols.length;
        i++
      ) {
        productRow.getCell(relatedCols[i * 2]).value = productArtists[i];
        productRow.getCell(relatedCols[i * 2 + 1]).value = "Single Artist";
      }
    }

    try {
      const contributors = JSON.parse(release.contributors_json || "[]");
      const contributorStartCol = 39; // AM
      contributors.forEach((contrib, index) => {
        const base = contributorStartCol + index * 4;
        productRow.getCell(base).value = contrib.name || "";
        productRow.getCell(base + 1).value = contrib.category || "";
        productRow.getCell(base + 2).value = contrib.role || "";
        productRow.getCell(base + 3).value = contrib.roleType || "";
      });
    } catch (e) {
      console.warn("Invalid contributors_json in PRODUCT:", e.message);
    }

    productRow.commit();

    const assetSheet = workbook.getWorksheet("ASSET");
    if (!assetSheet)
      return res
        .status(500)
        .json({ success: false, message: "ASSET sheet missing" });

    const totalAssetRows = assetSheet.rowCount;
    if (totalAssetRows > 3 + tracks.length) {
      for (let r = 3 + tracks.length; r <= totalAssetRows; r++) {
        assetSheet.getRow(r).values = [];
        assetSheet.getRow(r).commit();
      }
    }

    let assetRowIndex = 3;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const dist = distTracks.find((d) => d.id === track.id) || {};
      const rowObj = assetSheet.getRow(assetRowIndex);

      let trackArtists = [];
      try {
        trackArtists = JSON.parse(track.track_artists_json || "[]").map((a) =>
          typeof a === "string" ? a : a.name
        );
      } catch (_) {}

      const trackFlat = trackArtists.join(", ");
      const isCompoundTrack = trackArtists.length > 1;

      rowObj.getCell(1).value = 1;
      rowObj.getCell(2).value = track.track_isrc?.startsWith("ISRC")
        ? ""
        : track.track_isrc || "";
      rowObj.getCell(3).value = track.track_title || "";
      rowObj.getCell(4).value = track.track_version || "";
      rowObj.getCell(5).value = track.track_volume || "1";
      rowObj.getCell(6).value = i + 1;
      rowObj.getCell(7).value = "";
      rowObj.getCell(8).value = track.track_parental || "";
      rowObj.getCell(9).value = track.track_recording_country || "";
      rowObj.getCell(10).value = track.track_primary_genre || "";
      rowObj.getCell(11).value = track.track_sub_genre || "";
      rowObj.getCell(12).value = track.track_audio_language || "";
      rowObj.getCell(13).value = release.audio_presentation || "";
      rowObj.getCell(14).value = track.track_type || "";
      rowObj.getCell(15).value = track.track_metadata_language || "";
      rowObj.getCell(16).value = track.track_metadata_country || "";
      rowObj.getCell(17).value = "";
      rowObj.getCell(18).value = "";

      rowObj.getCell(21).value = trackFlat;
      rowObj.getCell(22).value = trackFlat;
      rowObj.getCell(23).value = isCompoundTrack ? "Compound Artist" : "Single Artist";

      let relatedCol = 24;
      for (let j = 0; j < trackArtists.length && relatedCol + 1 <= 35; j++) {
        rowObj.getCell(relatedCol).value = trackArtists[j];
        rowObj.getCell(relatedCol + 1).value = "Single Artist";
        relatedCol += 2;
      }

      const trackContribStartCol = 37; // AJ
      try {
        const contributors = JSON.parse(track.track_contributors_json || "[]");
        contributors.forEach((contrib, idx) => {
          const base = trackContribStartCol + idx * 4;
          rowObj.getCell(base).value = contrib.name || "";
          rowObj.getCell(base + 1).value = contrib.category || "";
          rowObj.getCell(base + 2).value = contrib.role || "";
          rowObj.getCell(base + 3).value = contrib.roleType || "";
        });
      } catch (err) {}

      rowObj.getCell(63).value = pricingTiers[dist.price] || "";
      rowObj.getCell(64).value = dist.pd || "";
      rowObj.getCell(65).value = dist.etu || "";
      rowObj.getCell(66).value = dist.adss || "";
      rowObj.getCell(67).value = mapUGC(dist.ugc);
      rowObj.getCell(68).value = "";

      rowObj.eachCell((cell) => {
        cell.alignment = {
          horizontal: "center",
          vertical: "bottom",
          wrapText: true,
        };
      });

      rowObj.commit();
      assetRowIndex++;
    }

    const tempDir = path.resolve(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const safeTitle = (release.display_title || `release_${releaseId}`)
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const fileName = `${safeTitle}.xlsx`;
    const outputPath = path.join(tempDir, fileName);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    await workbook.xlsx.writeFile(outputPath);

    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, fileName });
  } catch (err) {
    console.error("❌ Excel export error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate Excel",
      error: err.message,
    });
  }
});


// =============== ABILITIES (client can read) ===============
router.get("/abilities", verifyToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const canDel = await canDeleteRelease(userId);
    res.json({
      success: true,
      abilities: { "releases.delete": canDel },
    });
  } catch (err) {
    console.error("abilities error:", err);
    res.status(500).json({ success: false, abilities: {} });
  }
});


module.exports = router;
