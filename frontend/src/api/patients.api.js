import { api } from "./client";

export const patientsApi = {
  list: (params) => api.get("/patients", { params }),
  get: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post("/patients", data),
  update: (id, data) => api.patch(`/patients/${id}`, data),
  toggleActive: (id) => api.patch(`/patients/${id}/toggle-active`),
  delete: (id) => api.delete(`/patients/${id}`),
};
