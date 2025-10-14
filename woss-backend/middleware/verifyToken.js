// middleware/verifyToken.js
const jwt = require("jsonwebtoken");
const SESSION_COOKIE = process.env.SESSION_COOKIE || "woss_session";

module.exports = (req, res, next) => {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  const headerToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const cookieToken = req.cookies?.[SESSION_COOKIE];

  const token = headerToken || cookieToken;
  if (!token) return res.status(401).json({ error: "Token required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    // 🔧 Normalize for the rest of the app:
    // - Always expose req.user.userId (falls back to decoded.id)
    // - Keep role a clean string
    const userId = decoded.userId ?? decoded.id ?? decoded.userid ?? decoded.sub;
    req.user = {
      ...decoded,
      userId, // <- all routes depend on this
      role: typeof decoded.role === "string" ? decoded.role : String(decoded.role || ""),
    };

    if (!req.user.userId) {
      // token didn’t include any usable id
      return res.status(401).json({ error: "Invalid token payload" });
    }

    return next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
};
