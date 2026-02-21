import { useConfirmStore } from "@/store/confirm.store";

export const useConfirm = () => useConfirmStore((s) => s.confirm);
