const BASE = "/api/crm";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && (data.detail || data.message)) || `Request failed (${res.status})`);
  }
  return data;
}

export function listModule(module, { q = "", filters = {} } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const active = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v && v !== "All" && v !== "all") active[k] = v;
  }
  if (Object.keys(active).length) params.set("filters", JSON.stringify(active));
  const qs = params.toString();
  return request(`/${module}${qs ? `?${qs}` : ""}`);
}

export function createRecord(module, payload) {
  return request(`/${module}`, { method: "POST", body: JSON.stringify(payload || {}) });
}

export function updateRecord(module, id, payload) {
  return request(`/${module}/${id}`, { method: "PUT", body: JSON.stringify(payload || {}) });
}

export function deleteRecord(module, id) {
  return request(`/${module}/${id}`, { method: "DELETE" });
}

export const getSummary = () => request("/summary");
export const getRefs = () => request("/refs");
export const getCeo = () => request("/ceo");
export const getAttention = (limit) => request(`/attention${limit ? `?limit=${limit}` : ""}`);
export const getAnalytics = () => request("/analytics");
export const getPortfolio = () => request("/portfolio");
export const getMyWork = (owner) => request(`/mywork${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`);
export const getUniversity = () => request("/university");
export const syncData = (force = true) => request(`/sync${force === false ? "?force=false" : ""}`, { method: "POST" });
export const seedDemo = () => request("/seed-demo", { method: "POST" });