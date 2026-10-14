// Central API client for NICE Guidance Assistant.
// In Docker / Nginx, relative '/api' is routed to the backend container.
// In local dev, Vite proxies '/api' to 'http://localhost:8000/api'.
export const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem("token");
  const headers = { ...extraHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${cleanEndpoint}`;
  
  const headers = getAuthHeaders(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  return res;
}
