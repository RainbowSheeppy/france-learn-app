import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, Loader2 } from 'lucide-react'

interface GenerateContentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onGenerate: (groupCount: number, itemsPerGroup: number) => Promise<void>
    loading: boolean
}

export default function GenerateContentDialog({ open, onOpenChange, onGenerate, loading }: GenerateContentDialogProps) {
    const [groupCount, setGroupCount] = useState('2')
    const [itemsPerGroup, setItemsPerGroup] = useState('10')

    const handleGenerate = async () => {
        await onGenerate(parseInt(groupCount), parseInt(itemsPerGroup))
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-green-600" />
                        Generuj treści AI
                    </DialogTitle>
                    <DialogDescription>
                        Wybierz liczbę grup i zadań do wygenerowania. Grupy będą nazwane "Ai Generated X" z kolejnymi numerami.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Liczba grup</Label>
                            <Select value={groupCount} onValueChange={setGroupCount}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz liczbę grup" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 grupa</SelectItem>
                                    <SelectItem value="2">2 grupy</SelectItem>
                                    <SelectItem value="3">3 grupy</SelectItem>
                                    <SelectItem value="4">4 grupy</SelectItem>
                                    <SelectItem value="5">5 grup</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Zadań na grupę</Label>
                            <Select value={itemsPerGroup} onValueChange={setItemsPerGroup}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz ilość" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5 zadań</SelectItem>
                                    <SelectItem value="10">10 zadań</SelectItem>
                                    <SelectItem value="15">15 zadań</SelectItem>
                                    <SelectItem value="20">20 zadań</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        Generowanie może potrwać 1-2 minuty w zależności od ilości treści.
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Anuluj
                    </Button>
                    <Button onClick={handleGenerate} disabled={loading} className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600">
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generowanie...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4 mr-2" /> Generuj
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
