import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import type { TranslateItem, TranslateItemCreate, TranslateItemUpdate, Group } from '@/lib/api'

interface TranslateItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: TranslateItemCreate | TranslateItemUpdate) => Promise<void>
    item?: TranslateItem | null
    mode: 'create' | 'edit'
    groups?: Group[]
    labels?: {
        pl: string
        target: string
    }
}

export default function TranslateItemDialog({
    open,
    onOpenChange,
    onSubmit,
    item,
    mode,
    groups = [],
    labels = { pl: 'Tekst polski', target: 'Tekst francuski' }
}: TranslateItemDialogProps) {
    const [textPl, setTextPl] = useState(item?.text_pl || '')
    const [textTarget, setTextTarget] = useState(item?.text_target || '')
    const [groupId, setGroupId] = useState<string>(item?.group_id || 'none')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            if (item && mode === 'edit') {
                setTextPl(item.text_pl)
                setTextTarget(item.text_target)
                setGroupId(item.group_id || 'none')
            } else {
                setTextPl('')
                setTextTarget('')
                setGroupId('none')
            }
        }
    }, [item, mode, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await onSubmit({
                text_pl: textPl,
                text_target: textTarget,
                group_id: groupId === 'none' ? null : groupId
            })
            onOpenChange(false)
        } catch (err) {
            console.error('Error submitting item:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Dodaj tłumaczenie' : 'Edytuj tłumaczenie'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="text_pl">{labels.pl} <span className="text-destructive">*</span></Label>
                        <Input
                            id="text_pl"
                            value={textPl}
                            onChange={(e) => setTextPl(e.target.value)}
                            placeholder="Wpisz tekst..."
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="text_target">{labels.target} <span className="text-destructive">*</span></Label>
                        <Input
                            id="text_target"
                            value={textTarget}
                            onChange={(e) => setTextTarget(e.target.value)}
                            placeholder="Wpisz tekst..."
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Grupa (opcjonalne)</Label>
                        <Select value={groupId} onValueChange={setGroupId} disabled={loading}>
                            <SelectTrigger>
                                <SelectValue placeholder="Wybierz grupę" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Brak grupy</SelectItem>
                                {groups.map((group) => (
                                    <SelectItem key={group.id} value={group.id}>
                                        {group.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

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
                        <Button type="submit" disabled={loading} className="flex-1">
                            {loading ? 'Zapisywanie...' : mode === 'create' ? 'Dodaj' : 'Zapisz'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
