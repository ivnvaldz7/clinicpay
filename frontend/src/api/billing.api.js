import { api } from "./client";

export const billingApi = {
  status: () => api.get("/billing/status"),
  checkout: (priceId) => api.post("/billing/checkout", { priceId }),
  portal: () => api.post("/billing/portal"),
};
