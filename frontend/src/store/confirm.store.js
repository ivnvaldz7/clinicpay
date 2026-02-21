import { create } from "zustand";

export const useConfirmStore = create((set) => ({
  pending: null,

  confirm: ({ title, description, confirmLabel = "Eliminar", cancelLabel = "Cancelar", variant = "destructive" }) =>
    new Promise((resolve) => {
      set({ pending: { title, description, confirmLabel, cancelLabel, variant, resolve } });
    }),

  settle: (result) =>
    set((s) => {
      s.pending?.resolve(result);
      return { pending: null };
    }),
}));
