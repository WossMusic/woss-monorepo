import axios from "axios";
import { API_BASE } from "./apiBase";

// pull token from localStorage when a request is sent
const http = axios.create({
  baseURL: API_BASE,          // e.g. https://woss-backend.vercel.app
  withCredentials: true,      // send cookies if your API needs them
  timeout: 20000
});

http.interceptors.request.use((config) => {
  const t = localStorage.getItem("woss_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export default http;
