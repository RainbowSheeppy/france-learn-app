import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { FillBlankItem, FillBlankItemCreate, FillBlankItemUpdate } from '@/lib/api'

interface FillBlankItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: FillBlankItemCreate | FillBlankItemUpdate) => Promise<void>
    item?: FillBlankItem | null
    mode: 'create' | 'edit'
}

export default function FillBlankItemDialog({
    open,
    onOpenChange,
    onSubmit,
    item,
    mode,
}: FillBlankItemDialogProps) {
    const [sentenceWithBlank, setSentenceWithBlank] = useState(item?.sentence_with_blank || '')
    const [sentencePl, setSentencePl] = useState(item?.sentence_pl || '')
    const [answer, setAnswer] = useState(item?.answer || '')
    const [fullSentence, setFullSentence] = useState(item?.full_sentence || '')
    const [hint, setHint] = useState(item?.hint || '')
    const [grammarFocus, setGrammarFocus] = useState(item?.grammar_focus || 'none')
    const [loading, setLoading] = useState(false)

    const grammarFocusOptions = [
        { value: 'none', label: 'Brak' },
        { value: 'verb', label: 'Czasowniki' },
        { value: 'article', label: 'Rodzajniki' },
        { value: 'preposition', label: 'Przyimki' },
        { value: 'pronoun', label: 'Zaimki' },
        { value: 'agreement', label: 'Zgodnosc' },
    ]

    useEffect(() => {
        if (open) {
            if (item && mode === 'edit') {
                setSentenceWithBlank(item.sentence_with_blank)
                setSentencePl(item.sentence_pl || '')
                setAnswer(item.answer)
                setFullSentence(item.full_sentence || '')
                setHint(item.hint || '')
                setGrammarFocus(item.grammar_focus || 'none')
            } else {
                setSentenceWithBlank('')
                setSentencePl('')
                setAnswer('')
                setFullSentence('')
                setHint('')
                setGrammarFocus('none')
            }
        }
    }, [item, mode, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await onSubmit({
                sentence_with_blank: sentenceWithBlank,
                sentence_pl: sentencePl || null,
                answer: answer,
                full_sentence: fullSentence || null,
                hint: hint || null,
                grammar_focus: grammarFocus === 'none' ? null : grammarFocus
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
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Dodaj cwiczenie' : 'Edytuj cwiczenie'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="sentence_with_blank">Zdanie z luką (użyj ___) <span className="text-destructive">*</span></Label>
                        <Input
                            id="sentence_with_blank"
                            value={sentenceWithBlank}
                            onChange={(e) => setSentenceWithBlank(e.target.value)}
                            placeholder="Je ___ à Paris depuis 5 ans."
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sentence_pl">Tłumaczenie (PL) 🇵🇱 (dla admina)</Label>
                        <Input
                            id="sentence_pl"
                            value={sentencePl}
                            onChange={(e) => setSentencePl(e.target.value)}
                            placeholder="Mieszkam w Paryżu od 5 lat."
                            disabled={loading}
                            className="bg-blue-50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="answer">Odpowiedź <span className="text-destructive">*</span></Label>
                        <Input
                            id="answer"
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="habite"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="full_sentence">Pełne zdanie (opcjonalnie)</Label>
                        <Input
                            id="full_sentence"
                            value={fullSentence}
                            onChange={(e) => setFullSentence(e.target.value)}
                            placeholder="Je habite à Paris depuis 5 ans."
                            disabled={loading}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="hint">Podpowiedz (opcjonalnie)</Label>
                            <Input
                                id="hint"
                                value={hint}
                                onChange={(e) => setHint(e.target.value)}
                                placeholder="czasownik habiter"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Kategoria gramatyczna</Label>
                            <Select value={grammarFocus} onValueChange={setGrammarFocus} disabled={loading}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz kategorie" />
                                </SelectTrigger>
                                <SelectContent>
                                    {grammarFocusOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
