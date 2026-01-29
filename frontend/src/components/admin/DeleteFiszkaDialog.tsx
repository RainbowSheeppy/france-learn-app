import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface DeleteFiszkaDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => Promise<void>
    fiszkaText: string
    loading: boolean
}

export default function DeleteFiszkaDialog({
    open,
    onOpenChange,
    onConfirm,
    fiszkaText,
    loading
}: DeleteFiszkaDialogProps) {
    const handleConfirm = async () => {
        await onConfirm()
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-6 h-6 text-destructive" />
                    </div>
                    <DialogTitle className="text-center">Usuń fiszkę</DialogTitle>
                    <DialogDescription className="text-center">
                        Czy na pewno chcesz usunąć fiszkę "{fiszkaText}"?
                        <br />
                        <strong className="text-destructive">Tej operacji nie można cofnąć.</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-3 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                        className="flex-1"
                    >
                        Anuluj
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={loading}
                        className="flex-1"
                    >
                        {loading ? 'Usuwanie...' : 'Usuń'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
