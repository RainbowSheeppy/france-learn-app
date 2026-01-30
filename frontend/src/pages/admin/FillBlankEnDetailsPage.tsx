import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fillBlankEnApi, aiEnApi, type Group, type FillBlankEnItem, type FillBlankEnItemCreate, type FillBlankEnItemUpdate, type GeneratedFillBlankEnItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, TextCursorInput, Wand2, Save } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function FillBlankEnDetailsPage() {
    const { groupId } = useParams()
    const navigate = useNavigate()
    const [group, setGroup] = useState<Group | null>(null)
    const [items, setItems] = useState<FillBlankEnItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
    const [editingItem, setEditingItem] = useState<FillBlankEnItem | null>(null)

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingItem, setDeletingItem] = useState<FillBlankEnItem | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    // AI Generation State
    const [genModalOpen, setGenModalOpen] = useState(false)
    const [genLevel, setGenLevel] = useState('B1')
    const [genCount, setGenCount] = useState(5)
    const [genCategory, setGenCategory] = useState<string>('mixed')
    const [generating, setGenerating] = useState(false)
    const [generatedItems, setGeneratedItems] = useState<GeneratedFillBlankEnItem[]>([])
    const [savingGen, setSavingGen] = useState(false)

    // Form state
    const [formData, setFormData] = useState({
        sentence_with_blank: '',
        correct_answer: '',
        hint: ''
    })

    useEffect(() => {
        if (groupId) {
            loadData()
        }
    }, [groupId])

    const loadData = async () => {
        if (!groupId) return
        try {
            setLoading(true)
            const groups = await fillBlankEnApi.getGroups()
            const foundGroup = groups.find(g => g.id === groupId)
            if (!foundGroup) throw new Error("Group not found")
            setGroup(foundGroup)

            const itemsData = await fillBlankEnApi.getAllItems(groupId)
            setItems(itemsData)
        } catch (err: any) {
            console.error('Error loading data:', err)
            setError('Nie udało się załadować danych grupy')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateItem = async () => {
        const data: FillBlankEnItemCreate = {
            sentence_with_blank: formData.sentence_with_blank,
            answer: formData.correct_answer,
            hint: formData.hint || undefined,
            group_id: groupId
        }
        await fillBlankEnApi.createItem(data)
        const itemsData = await fillBlankEnApi.getAllItems(groupId!)
        setItems(itemsData)
        setDialogOpen(false)
        resetForm()
    }

    const handleEditItem = async () => {
        if (!editingItem) return
        const data: FillBlankEnItemUpdate = {
            sentence_with_blank: formData.sentence_with_blank,
            answer: formData.correct_answer,
            hint: formData.hint || undefined
        }
        await fillBlankEnApi.updateItem(editingItem.id, data)
        const itemsData = await fillBlankEnApi.getAllItems(groupId!)
        setItems(itemsData)
        setDialogOpen(false)
        resetForm()
    }

    const handleDeleteItem = async () => {
        if (!deletingItem) return
        setDeleteLoading(true)
        try {
            await fillBlankEnApi.deleteItem(deletingItem.id)
            const itemsData = await fillBlankEnApi.getAllItems(groupId!)
            setItems(itemsData)
        } finally {
            setDeleteLoading(false)
            setDeletingItem(null)
            setDeleteDialogOpen(false)
        }
    }

    const handleGenerate = async () => {
        setGenerating(true)
        setGeneratedItems([])
        try {
            const category = genCategory === 'mixed' ? undefined : genCategory
            const items = await aiEnApi.generateFillBlank(genLevel, genCount, category)
            setGeneratedItems(items)
        } catch (e) {
            console.error(e)
            alert("Błąd generowania AI")
        } finally {
            setGenerating(false)
        }
    }

    const handleSaveGenerated = async () => {
        if (!groupId || generatedItems.length === 0) return
        setSavingGen(true)
        try {
            for (const item of generatedItems) {
                await fillBlankEnApi.createItem({
                    sentence_with_blank: item.sentence_with_blank,
                    sentence_pl: item.sentence_pl,
                    answer: item.answer,
                    full_sentence: item.full_sentence,
                    hint: item.hint || undefined,
                    grammar_focus: item.grammar_focus || undefined,
                    group_id: groupId
                })
            }
            setGenModalOpen(false)
            setGeneratedItems([])
            const itemsData = await fillBlankEnApi.getAllItems(groupId)
            setItems(itemsData)
            alert("Zapisano wygenerowane ćwiczenia!")
        } catch (e) {
            console.error(e)
            alert("Błąd zapisu")
        } finally {
            setSavingGen(false)
        }
    }

    const removeGeneratedItem = (idx: number) => {
        setGeneratedItems(prev => prev.filter((_, i) => i !== idx))
    }

    const resetForm = () => {
        setFormData({
            sentence_with_blank: '',
            correct_answer: '',
            hint: ''
        })
        setEditingItem(null)
    }

    const openCreateDialog = () => {
        setDialogMode('create')
        resetForm()
        setDialogOpen(true)
    }

    const openEditDialog = (item: FillBlankEnItem) => {
        setDialogMode('edit')
        setEditingItem(item)
        setFormData({
            sentence_with_blank: item.sentence_with_blank,
            correct_answer: item.answer,
            hint: item.hint || ''
        })
        setDialogOpen(true)
    }

    const openDeleteDialog = (item: FillBlankEnItem) => {
        setDeletingItem(item)
        setDeleteDialogOpen(true)
    }

    if (loading) return <div className="text-center p-10"><Loader2 className="animate-spin mx-auto" /></div>
    if (error || !group) return <div className="text-center p-10 text-destructive">{error || "Group not found"}</div>

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in px-6 py-6">
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => navigate('/admin/fill-blank-en')} className="pl-0 hover:pl-2 transition-all">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Powrót do grup
                </Button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{group.name}</h1>
                        {group.description && <p className="text-muted-foreground mt-1">{group.description}</p>}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-teal-200 hover:bg-teal-50 text-teal-700" onClick={() => setGenModalOpen(true)}>
                            <Wand2 className="w-4 h-4 mr-2" /> Generuj AI
                        </Button>
                        <Button onClick={openCreateDialog}>
                            <Plus className="w-4 h-4 mr-2" /> Dodaj ćwiczenie
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {items.map(item => (
                    <Card key={item.id} className="group hover:border-teal-200 transition-all">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TextCursorInput className="w-4 h-4 text-teal-600" />
                                        <p className="text-sm text-muted-foreground">Zdanie</p>
                                    </div>
                                    <p className="font-medium text-lg">{item.sentence_with_blank}</p>
                                    {item.hint && (
                                        <p className="text-xs text-muted-foreground mt-1">Podpowiedź: {item.hint}</p>
                                    )}
                                </div>
                                <div className="flex-1 text-right">
                                    <p className="text-sm text-muted-foreground mb-1">Odpowiedź</p>
                                    <p className="font-semibold text-lg text-teal-600">{item.answer}</p>
                                </div>
                                <div className="flex gap-2 ml-4 border-l pl-4">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(item)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {items.length === 0 && (
                    <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-xl">
                        Ta grupa jest pusta. Dodaj ćwiczenia ręcznie lub wygeneruj przez AI.
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{dialogMode === 'create' ? 'Dodaj ćwiczenie' : 'Edytuj ćwiczenie'}</DialogTitle>
                        <DialogDescription>
                            {dialogMode === 'create' ? 'Wypełnij pola, aby utworzyć nowe ćwiczenie' : 'Zmień dane ćwiczenia'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Zdanie z luką (___) *</Label>
                            <Input
                                value={formData.sentence_with_blank}
                                onChange={(e) => setFormData({ ...formData, sentence_with_blank: e.target.value })}
                                placeholder="e.g., She ___ to the store yesterday."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Poprawna odpowiedź *</Label>
                            <Input
                                value={formData.correct_answer}
                                onChange={(e) => setFormData({ ...formData, correct_answer: e.target.value })}
                                placeholder="e.g., went"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Podpowiedź</Label>
                            <Input
                                value={formData.hint}
                                onChange={(e) => setFormData({ ...formData, hint: e.target.value })}
                                placeholder="np. past tense of 'go'"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Anuluj</Button>
                        <Button onClick={dialogMode === 'create' ? handleCreateItem : handleEditItem}>
                            {dialogMode === 'create' ? 'Dodaj' : 'Zapisz'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Usuń ćwiczenie</DialogTitle>
                        <DialogDescription>
                            Czy na pewno chcesz usunąć to ćwiczenie?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Anuluj</Button>
                        <Button variant="destructive" onClick={handleDeleteItem} disabled={deleteLoading}>
                            {deleteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Usuń
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AI Generation Dialog */}
            <Dialog open={genModalOpen} onOpenChange={setGenModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-teal-600" /> Generuj Ćwiczenia AI (Angielski)</DialogTitle>
                        <DialogDescription>
                            Wybierz poziom i ilość ćwiczeń do wygenerowania, a następnie zweryfikuj je przed zapisaniem.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Konfiguracja */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-teal-50 rounded-lg border border-teal-100">
                            <div className="space-y-2">
                                <Label>Poziom</Label>
                                <Select value={genLevel} onValueChange={setGenLevel}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => (
                                            <SelectItem key={l} value={l}>{l}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Kategoria</Label>
                                <Select value={genCategory} onValueChange={setGenCategory}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mixed">Mieszanka</SelectItem>
                                        <SelectItem value="vocabulary">Słownictwo</SelectItem>
                                        <SelectItem value="grammar">Gramatyka</SelectItem>
                                        <SelectItem value="phrasal_verbs">Czasowniki frazowe</SelectItem>
                                        <SelectItem value="collocations">Kolokacje</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ilość ćwiczeń</Label>
                                <Select value={genCount.toString()} onValueChange={v => setGenCount(parseInt(v))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[5, 10, 15, 20].map(c => (
                                            <SelectItem key={c} value={c.toString()}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <Button onClick={handleGenerate} disabled={generating} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                    {generating ? 'Generowanie...' : 'Generuj'}
                                </Button>
                            </div>
                        </div>

                        {/* Wyniki */}
                        {generatedItems.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Wygenerowane ćwiczenia ({generatedItems.length})</h3>
                                </div>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {generatedItems.map((item, idx) => (
                                        <div key={idx} className="p-3 border rounded-md bg-white">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1 space-y-1">
                                                    <p className="font-medium">{item.sentence_with_blank}</p>
                                                    <p className="text-teal-600 font-semibold">Odpowiedź: {item.answer}</p>
                                                    <p className="text-sm text-gray-500">{item.sentence_pl}</p>
                                                    {item.hint && <p className="text-xs text-gray-500">Podpowiedź: {item.hint}</p>}
                                                </div>
                                                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => removeGeneratedItem(idx)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg border">
                                    <Button onClick={handleSaveGenerated} disabled={savingGen} className="w-1/3 ml-auto">
                                        {savingGen ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Zapisz Wszystkie
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
