
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-700 dark:text-red-400">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base text-gray-800 dark:text-gray-300">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-400 text-gray-800 dark:text-gray-200 dark:border-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant || "destructive"}
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white shadow"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
