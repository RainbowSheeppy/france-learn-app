
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
import type { Fiszka, FiszkaCreate, FiszkaUpdate, Group } from '@/lib/api'

interface FiszkaDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: FiszkaCreate | FiszkaUpdate) => Promise<void>
    fiszka?: Fiszka | null
    mode: 'create' | 'edit'
    groups?: Group[]
}

export default function FiszkaDialog({ open, onOpenChange, onSubmit, fiszka, mode, groups = [] }: FiszkaDialogProps) {
    const [textPl, setTextPl] = useState(fiszka?.text_pl || '')
    const [textFr, setTextFr] = useState(fiszka?.text_fr || '')
    const [imageUrl, setImageUrl] = useState(fiszka?.image_url || '')
    const [groupId, setGroupId] = useState<string>(fiszka?.group_id || 'none')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await onSubmit({
                text_pl: textPl,
                text_fr: textFr,
                image_url: imageUrl || null,
                group_id: groupId === 'none' ? null : groupId
            })
            onOpenChange(false)
            // Reset form
            setTextPl('')
            setTextFr('')
            setImageUrl('')
            setGroupId('none')
        } catch (err) {
            console.error('Error submitting fiszka:', err)
        } finally {
            setLoading(false)
        }
    }

    // Update form when fiszka prop changes
    useEffect(() => {
        if (fiszka) {
            setTextPl(fiszka.text_pl)
            setTextFr(fiszka.text_fr)
            setImageUrl(fiszka.image_url || '')
            setGroupId(fiszka.group_id || 'none')
        } else {
            setTextPl('')
            setTextFr('')
            setImageUrl('')
            setGroupId('none')
        }
    }, [fiszka])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Dodaj nową fiszkę' : 'Edytuj fiszkę'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="text_pl" className="text-sm font-medium">
                            Tekst polski <span className="text-destructive">*</span>
                        </label>
                        <Input
                            id="text_pl"
                            value={textPl}
                            onChange={(e) => setTextPl(e.target.value)}
                            placeholder="np. Dzień dobry"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="text_fr" className="text-sm font-medium">
                            Tekst francuski <span className="text-destructive">*</span>
                        </label>
                        <Input
                            id="text_fr"
                            value={textFr}
                            onChange={(e) => setTextFr(e.target.value)}
                            placeholder="np. Bonjour"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Grupa (opcjonalne)
                        </label>
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

                    <div className="space-y-2">
                        <label htmlFor="image_url" className="text-sm font-medium">
                            URL obrazka (opcjonalne)
                        </label>
                        <Input
                            id="image_url"
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                            disabled={loading}
                        />
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
