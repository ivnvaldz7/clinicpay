import { create } from "zustand";

/**
 * Auth store — access token lives in memory only (never localStorage).
 * The refresh token is in an httpOnly cookie managed by the browser.
 */
export const useAuthStore = create((set) => ({
  accessToken: null,
  user: null,

  setAuth: (accessToken, user) => set({ accessToken, user }),

  setAccessToken: (accessToken) => set({ accessToken }),

  logout: () => set({ accessToken: null, user: null }),
}));
