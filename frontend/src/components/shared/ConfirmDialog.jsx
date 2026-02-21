import { AlertTriangle } from "lucide-react";
import { useConfirmStore } from "@/store/confirm.store";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const ConfirmDialog = () => {
  const pending = useConfirmStore((s) => s.pending);
  const settle  = useConfirmStore((s) => s.settle);

  return (
    <Dialog open={!!pending} onOpenChange={(open) => { if (!open) settle(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          {pending?.variant === "destructive" && (
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          )}
          <DialogTitle>{pending?.title}</DialogTitle>
          {pending?.description && (
            <DialogDescription className="pt-1">{pending.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {pending?.cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            variant={pending?.variant === "destructive" ? "destructive" : "default"}
            onClick={() => settle(true)}
          >
            {pending?.confirmLabel ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
