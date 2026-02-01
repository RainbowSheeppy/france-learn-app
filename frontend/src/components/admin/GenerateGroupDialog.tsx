import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Wand2, Loader2 } from 'lucide-react'

interface GenerateGroupDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onGenerate: (level: string, count: number, topic: string) => Promise<void>
    loading: boolean
}

export default function GenerateGroupDialog({ open, onOpenChange, onGenerate, loading }: GenerateGroupDialogProps) {
    const [level, setLevel] = useState('A1')
    const [count, setCount] = useState('10')
    const [topic, setTopic] = useState('')

    const handleGenerate = async () => {
        await onGenerate(level, parseInt(count), topic)
        onOpenChange(false)
        setTopic('') // Reset topic after generation
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="w-5 h-5 text-purple-600" />
                        Generuj grupę AI
                    </DialogTitle>
                    <DialogDescription>
                        Stwórz nową grupę wypełnioną przykładami wygenerowanymi przez sztuczną inteligencję.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Poziom</Label>
                            <Select value={level} onValueChange={setLevel}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz poziom" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="A1">A1 (Początkujący)</SelectItem>
                                    <SelectItem value="A2">A2 (Podstawowy)</SelectItem>
                                    <SelectItem value="B1">B1 (Średniozaawansowany)</SelectItem>
                                    <SelectItem value="B2">B2 (Ponadśredni)</SelectItem>
                                    <SelectItem value="C1">C1 (Zaawansowany)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Liczba elementów</Label>
                            <Select value={count} onValueChange={setCount}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz ilość" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="5">5 elementów</SelectItem>
                                    <SelectItem value="10">10 elementów</SelectItem>
                                    <SelectItem value="15">15 elementów</SelectItem>
                                    <SelectItem value="20">20 elementów</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Temat / Kategoria (opcjonalnie)</Label>
                        <Input
                            placeholder="np. zakupy, podróże, czasowniki nieregularne..."
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Jeśli pozostawisz puste, AI dobierze temat losowo.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Anuluj
                    </Button>
                    <Button onClick={handleGenerate} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generowanie...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4 mr-2" /> Generuj
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
