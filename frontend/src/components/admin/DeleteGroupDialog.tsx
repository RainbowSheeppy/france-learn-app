
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'

interface DeleteGroupDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => Promise<void>
    groupName: string
    loading: boolean
}

export default function DeleteGroupDialog({
    open,
    onOpenChange,
    onConfirm,
    groupName,
    loading,
}: DeleteGroupDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Czy na pewno chcesz usunąć tę grupę?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Zamierzasz usunąć grupę <strong>"{groupName}"</strong>.
                        <br />
                        Ta operacja jest nieodwracalna. Wszystkie fiszki przypisane do tej grupy mogą zostać usunięte lub odpięte (zależnie od implementacji backendu).
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Anuluj</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            onConfirm()
                        }}
                        disabled={loading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {loading && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
                        Usuń grupę
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
