import { api } from "./client";

export const invoicesApi = {
  list: (params) => api.get("/invoices", { params }),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post("/invoices", data),
  update: (id, data) => api.patch(`/invoices/${id}`, data),
  updateStatus: (id, status) => api.patch(`/invoices/${id}/status`, { status }),
  delete: (id) => api.delete(`/invoices/${id}`),
};
