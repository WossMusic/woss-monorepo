// example: web/src/services/auth.js
import http from "../lib/http";

export const login = (email, password) =>
  http.post("/api/auth/login", { email, password });

export const me = () => http.get("/api/user/me");
