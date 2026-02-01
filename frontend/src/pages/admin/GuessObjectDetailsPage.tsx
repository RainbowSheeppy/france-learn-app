import { useEffect, useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { useParams, useNavigate } from 'react-router-dom'
import { guessObjectApi, type Group, type GuessObjectItem, type GuessObjectItemCreate, type GuessObjectItemUpdate, type GeneratedGuessObjectItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, Upload, ArrowRight, Wand2, Save, HelpCircle } from 'lucide-react'
import GuessObjectItemDialog from '@/components/admin/GuessObjectItemDialog'
import DeleteGuessObjectItemDialog from '@/components/admin/DeleteGuessObjectItemDialog'
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

export default function GuessObjectDetailsPage() {
    const { groupId } = useParams()
    const navigate = useNavigate()
    const [group, setGroup] = useState<Group | null>(null)
    const [items, setItems] = useState<GuessObjectItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const { activeLanguage } = useLanguageStore()
    const langLabelUpper = activeLanguage === 'fr' ? 'FR' : 'EN'


    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
    const [editingItem, setEditingItem] = useState<GuessObjectItem | null>(null)

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingItem, setDeletingItem] = useState<GuessObjectItem | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    const [importOpen, setImportOpen] = useState(false)
    const [importFile, setImportFile] = useState<File | null>(null)
    const [importing, setImporting] = useState(false)

    const [genModalOpen, setGenModalOpen] = useState(false)
    const [genLevel, setGenLevel] = useState('B1')
    const [genCount, setGenCount] = useState(5)
    const [generating, setGenerating] = useState(false)
    const [generatedItems, setGeneratedItems] = useState<GeneratedGuessObjectItem[]>([])
    const [savingGen, setSavingGen] = useState(false)

    useEffect(() => {
        if (groupId) {
            loadData()
        }
    }, [groupId])

    const loadData = async () => {
        if (!groupId) return
        try {
            setLoading(true)
            const groups = await guessObjectApi.getGroups()
            const foundGroup = groups.find(g => g.id === groupId)
            if (!foundGroup) throw new Error("Group not found")
            setGroup(foundGroup)

            const itemsData = await guessObjectApi.getAllItems(groupId)
            setItems(itemsData)
        } catch (err: any) {
            console.error('Error loading data:', err)
            setError('Nie udalo sie zaladowac danych grupy')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateItem = async (data: GuessObjectItemCreate) => {
        await guessObjectApi.createItem({ ...data, group_id: groupId })
        const itemsData = await guessObjectApi.getAllItems(groupId!)
        setItems(itemsData)
    }

    const handleEditItem = async (data: GuessObjectItemUpdate) => {
        if (!editingItem) return
        await guessObjectApi.updateItem(editingItem.id, data)
        const itemsData = await guessObjectApi.getAllItems(groupId!)
        setItems(itemsData)
    }

    const handleDeleteItem = async () => {
        if (!deletingItem) return
        setDeleteLoading(true)
        try {
            await guessObjectApi.deleteItem(deletingItem.id)
            const itemsData = await guessObjectApi.getAllItems(groupId!)
            setItems(itemsData)
        } finally {
            setDeleteLoading(false)
            setDeletingItem(null)
        }
    }

    const handleImport = async () => {
        if (!importFile || !groupId) return
        setImporting(true)
        try {
            await guessObjectApi.importFromCsv(groupId, importFile)
            setImportOpen(false)
            setImportFile(null)
            const itemsData = await guessObjectApi.getAllItems(groupId)
            setItems(itemsData)
        } catch (e) {
            console.error(e)
            alert("Import failed")
        } finally {
            setImporting(false)
        }
    }

    const handleGenerate = async () => {
        setGenerating(true)
        setGeneratedItems([])
        try {
            const items = await guessObjectApi.generateAI(genLevel, genCount)
            setGeneratedItems(items)
        } catch (e) {
            console.error(e)
            alert("Blad generowania AI")
        } finally {
            setGenerating(false)
        }
    }

    const handleSaveGenerated = async () => {
        if (!groupId || generatedItems.length === 0) return
        setSavingGen(true)
        try {
            await guessObjectApi.batchCreate({
                group_id: groupId,
                items: generatedItems.map(item => ({
                    description_target: item.description_target,
                    description_pl: item.description_pl,
                    answer_target: item.answer_target,
                    answer_pl: item.answer_pl,
                    category: item.category,
                    hint: item.hint
                }))
            })
            setGenModalOpen(false)
            setGeneratedItems([])
            const itemsData = await guessObjectApi.getAllItems(groupId)
            setItems(itemsData)
            alert("Zapisano wygenerowane zagadki!")
        } catch (e) {
            console.error(e)
            alert("Blad zapisu")
        } finally {
            setSavingGen(false)
        }
    }

    const removeGeneratedItem = (idx: number) => {
        setGeneratedItems(prev => prev.filter((_, i) => i !== idx))
    }

    const updateGeneratedItem = (idx: number, field: keyof GeneratedGuessObjectItem, val: string) => {
        setGeneratedItems(prev => {
            const newItems = [...prev]
            newItems[idx] = { ...newItems[idx], [field]: val }
            return newItems
        })
    }

    const openCreateDialog = () => {
        setDialogMode('create')
        setEditingItem(null)
        setDialogOpen(true)
    }

    const openEditDialog = (item: GuessObjectItem) => {
        setDialogMode('edit')
        setEditingItem(item)
        setDialogOpen(true)
    }

    const openDeleteDialog = (item: GuessObjectItem) => {
        setDeletingItem(item)
        setDeleteDialogOpen(true)
    }

    if (loading) return <div className="text-center p-10"><Loader2 className="animate-spin mx-auto" /></div>
    if (error || !group) return <div className="text-center p-10 text-destructive">{error || "Group not found"}</div>

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in px-6 py-6">
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => navigate('/admin/guess-object')} className="pl-0 hover:pl-2 transition-all">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Powrot do grup
                </Button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{group.name}</h1>
                        {group.description && <p className="text-muted-foreground mt-1">{group.description}</p>}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-purple-200 hover:bg-purple-50 text-purple-700" onClick={() => setGenModalOpen(true)}>
                            <Wand2 className="w-4 h-4 mr-2" /> Generate AI
                        </Button>
                        <Button variant="outline" onClick={() => setImportOpen(true)}>
                            <Upload className="w-4 h-4 mr-2" /> Import CSV
                        </Button>
                        <Button onClick={openCreateDialog}>
                            <Plus className="w-4 h-4 mr-2" /> Dodaj zagadke
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {items.map(item => (
                    <Card key={item.id} className="group hover:border-amber-200 transition-all">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <HelpCircle className="w-4 h-4 text-amber-600" />
                                        <p className="text-sm text-muted-foreground">Opis ({langLabelUpper})</p>
                                        {item.category && (
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                                                {item.category}
                                            </span>
                                        )}
                                    </div>
                                    <p className="font-medium text-lg">{item.description_target}</p>
                                    {item.description_pl && (
                                        <p className="text-sm text-gray-500 mt-1">🇵🇱 {item.description_pl}</p>
                                    )}
                                    {item.hint && (
                                        <p className="text-xs text-muted-foreground mt-1">Hint: {item.hint}</p>
                                    )}
                                </div>
                                <ArrowRight className="text-muted-foreground mx-4 mt-2" />
                                <div className="flex-1 text-right">
                                    <p className="text-sm text-muted-foreground mb-1">Odpowiedź ({langLabelUpper})</p>
                                    <p className="font-semibold text-lg text-amber-600">{item.answer_target}</p>
                                    {item.answer_pl && (
                                        <p className="text-sm text-gray-500 mt-1">🇵🇱 {item.answer_pl}</p>
                                    )}
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
                        Ta grupa jest pusta. Dodaj zagadki recznie lub zaimportuj CSV.
                    </div>
                )}
            </div>

            <GuessObjectItemDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={dialogMode === 'create' ? (handleCreateItem as any) : (handleEditItem as any)}
                item={editingItem}
                mode={dialogMode}
                labels={activeLanguage === 'fr' ? {
                    descriptionTarget: 'Opis w języku obcym (Pytanie)',
                    answerTarget: 'Odpowiedź (jęz. obcy)',
                    placeholderDesc: 'C\'est un fruit rouge...',
                    placeholderAnswer: 'une pomme'
                } : {
                    descriptionTarget: 'Description in English (Question)',
                    answerTarget: 'Answer (EN)',
                    placeholderDesc: 'This is a red fruit...',
                    placeholderAnswer: 'an apple'
                }}
            />

            <DeleteGuessObjectItemDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleDeleteItem}
                itemText={deletingItem?.answer_target || ''}
                loading={deleteLoading}
            />

            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import z CSV</DialogTitle>
                        <DialogDescription>
                            Wybierz plik CSV z kolumnami: description_target, answer_target, hint (opcjonalnie)
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Plik CSV</Label>
                            <Input
                                type="file"
                                accept=".csv"
                                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleImport} disabled={!importFile || importing}>
                            {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Importuj
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={genModalOpen} onOpenChange={setGenModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-purple-600" /> Generuj Zagadki AI</DialogTitle>
                        <DialogDescription>
                            Wybierz poziom i ilosc zagadek do wygenerowania, a nastepnie zweryfikuj je przed zapisaniem.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
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
                                <Label>Ilosc zagadek</Label>
                                <Select value={genCount.toString()} onValueChange={v => setGenCount(parseInt(v))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[5, 10, 15, 20, 30].map(c => (
                                            <SelectItem key={c} value={c.toString()}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end">
                                <Button onClick={handleGenerate} disabled={generating} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                    {generating ? 'Generowanie...' : 'Generuj'}
                                </Button>
                            </div>
                        </div>

                        {generatedItems.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Wygenerowane zagadki ({generatedItems.length})</h3>
                                </div>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {generatedItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-start p-3 border rounded-md bg-white">
                                            <div className="grid grid-cols-2 gap-2 flex-1">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Opis ({langLabelUpper})</Label>
                                                    <Input
                                                        value={item.description_target}
                                                        onChange={(e) => updateGeneratedItem(idx, 'description_target', e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Opis (PL) 🇵🇱</Label>
                                                    <Input
                                                        value={item.description_pl || ''}
                                                        onChange={(e) => updateGeneratedItem(idx, 'description_pl', e.target.value)}
                                                        className="bg-blue-50"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Odpowiedź ({langLabelUpper})</Label>
                                                    <Input
                                                        value={item.answer_target}
                                                        onChange={(e) => updateGeneratedItem(idx, 'answer_target', e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Odpowiedź (PL) 🇵🇱</Label>
                                                    <Input
                                                        value={item.answer_pl || ''}
                                                        onChange={(e) => updateGeneratedItem(idx, 'answer_pl', e.target.value)}
                                                        className="bg-blue-50"
                                                    />
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-red-500 mt-5" onClick={() => removeGeneratedItem(idx)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
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
