import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  description?: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  itemName,
  description,
  onConfirm,
  isDeleting = false,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-none shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 shrink-0">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-800">Hapus Data?</DialogTitle>
              <DialogDescription className="font-medium">
                {description ?? `Data "${itemName}" akan dihapus permanen dan tidak dapat dikembalikan.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            className="h-11 px-6 rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            className="h-11 px-6 rounded-xl font-bold"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Menghapus…' : 'Ya, Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
