import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from "@/components/ui/label"
import type { GuessObjectItem, GuessObjectItemCreate, GuessObjectItemUpdate } from '@/lib/api'

interface GuessObjectItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: GuessObjectItemCreate | GuessObjectItemUpdate) => Promise<void>
    item?: GuessObjectItem | null
    mode: 'create' | 'edit'
}

export default function GuessObjectItemDialog({
    open,
    onOpenChange,
    onSubmit,
    item,
    mode,
}: GuessObjectItemDialogProps) {
    const [descriptionFr, setDescriptionFr] = useState(item?.description_fr || '')
    const [descriptionPl, setDescriptionPl] = useState(item?.description_pl || '')
    const [answerFr, setAnswerFr] = useState(item?.answer_fr || '')
    const [answerPl, setAnswerPl] = useState(item?.answer_pl || '')
    const [category, setCategory] = useState(item?.category || '')
    const [hint, setHint] = useState(item?.hint || '')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            if (item && mode === 'edit') {
                setDescriptionFr(item.description_fr)
                setDescriptionPl(item.description_pl || '')
                setAnswerFr(item.answer_fr)
                setAnswerPl(item.answer_pl || '')
                setCategory(item.category || '')
                setHint(item.hint || '')
            } else {
                setDescriptionFr('')
                setDescriptionPl('')
                setAnswerFr('')
                setAnswerPl('')
                setCategory('')
                setHint('')
            }
        }
    }, [item, mode, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await onSubmit({
                description_fr: descriptionFr,
                description_pl: descriptionPl || null,
                answer_fr: answerFr,
                answer_pl: answerPl || null,
                category: category || null,
                hint: hint || null
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
                        {mode === 'create' ? 'Dodaj zagadke' : 'Edytuj zagadke'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="description_fr">Opis po francusku (Pytanie) <span className="text-destructive">*</span></Label>
                        <Textarea
                            id="description_fr"
                            value={descriptionFr}
                            onChange={(e) => setDescriptionFr(e.target.value)}
                            placeholder="C'est un fruit rouge qu'on mange souvent en été..."
                            required
                            disabled={loading}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description_pl">Opis po polsku 🇵🇱 (dla admina)</Label>
                        <Textarea
                            id="description_pl"
                            value={descriptionPl}
                            onChange={(e) => setDescriptionPl(e.target.value)}
                            placeholder="To czerwony owoc, który często jemy latem..."
                            disabled={loading}
                            rows={2}
                            className="bg-blue-50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="answer_fr">Odpowiedź (FR) <span className="text-destructive">*</span></Label>
                            <Input
                                id="answer_fr"
                                value={answerFr}
                                onChange={(e) => setAnswerFr(e.target.value)}
                                placeholder="la pomme"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="answer_pl">Odpowiedź (PL) 🇵🇱</Label>
                            <Input
                                id="answer_pl"
                                value={answerPl}
                                onChange={(e) => setAnswerPl(e.target.value)}
                                placeholder="jabłko"
                                disabled={loading}
                                className="bg-blue-50"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="category">Kategoria (opcjonalnie)</Label>
                            <Input
                                id="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="fruits, animals..."
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="hint">Podpowiedź (opcjonalnie)</Label>
                            <Input
                                id="hint"
                                value={hint}
                                onChange={(e) => setHint(e.target.value)}
                                placeholder="fruit"
                                disabled={loading}
                            />
                        </div>
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
