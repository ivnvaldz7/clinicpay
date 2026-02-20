import { api } from "./client";

export const dashboardApi = {
  summary: (params) => api.get("/dashboard/summary", { params }),
  revenue: (params) => api.get("/dashboard/revenue", { params }),
  overdue: (params) => api.get("/dashboard/overdue", { params }),
};
