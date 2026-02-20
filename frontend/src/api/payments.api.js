import { api } from "./client";

export const paymentsApi = {
  list: (params) => api.get("/payments", { params }),
  get: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post("/payments", data),
  delete: (id) => api.delete(`/payments/${id}`),
};
