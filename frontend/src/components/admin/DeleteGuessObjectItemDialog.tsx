import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface DeleteGuessObjectItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => Promise<void>
    itemText: string
    loading: boolean
}

export default function DeleteGuessObjectItemDialog({
    open,
    onOpenChange,
    onConfirm,
    itemText,
    loading
}: DeleteGuessObjectItemDialogProps) {
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
                    <DialogTitle className="text-center">Usun zagadke</DialogTitle>
                    <DialogDescription className="text-center">
                        Czy na pewno chcesz usunac "<strong>{itemText}</strong>"?
                        <br />
                        <span className="text-destructive mt-2 block">Tej operacji nie mozna cofnac.</span>
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
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Usun'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
