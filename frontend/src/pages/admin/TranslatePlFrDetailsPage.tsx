import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { translatePlFrApi, aiApi, type Group, type TranslateItem, type TranslateItemCreate, type TranslateItemUpdate, type GeneratedItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Loader2, ArrowLeft, Upload, ArrowRight, Wand2, Save } from 'lucide-react'
import TranslateItemDialog from '@/components/admin/TranslateItemDialog'
import DeleteTranslateItemDialog from '@/components/admin/DeleteTranslateItemDialog'
// We reuse ImportFiszkiDialog or create specific one. 
// ImportFiszkiDialog logic is tied to fiszkiApi unfortunately in the current file but let's check.
// TranslatePlFrAdminPage had inline dialog. I will start by inline import dialog or create new component if needed.
// Actually, duplicating the inline dialog is safer for now to avoid breaking existing Fiszki logic.
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

export default function TranslatePlFrDetailsPage() {
    const { groupId } = useParams()
    const navigate = useNavigate()
    const [group, setGroup] = useState<Group | null>(null)
    const [items, setItems] = useState<TranslateItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Item Dialog states
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
    const [editingItem, setEditingItem] = useState<TranslateItem | null>(null)

    // Delete dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingItem, setDeletingItem] = useState<TranslateItem | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    // Import states
    const [importOpen, setImportOpen] = useState(false)
    const [importFile, setImportFile] = useState<File | null>(null)
    const [importing, setImporting] = useState(false)

    // AI Generation State
    const [genModalOpen, setGenModalOpen] = useState(false)
    const [genLevel, setGenLevel] = useState('B1')
    const [genCount, setGenCount] = useState(5)
    const [genCategory, setGenCategory] = useState<string>('mixed')
    const [generating, setGenerating] = useState(false)
    const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([])
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
            const groups = await translatePlFrApi.getGroups()
            const foundGroup = groups.find(g => g.id === groupId)
            if (!foundGroup) throw new Error("Group not found")
            setGroup(foundGroup)

            const itemsData = await translatePlFrApi.getAllItems(groupId)
            setItems(itemsData)
        } catch (err: any) {
            console.error('Error loading data:', err)
            setError('Nie udało się załadować danych grupy')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateItem = async (data: TranslateItemCreate) => {
        await translatePlFrApi.createItem({ ...data, group_id: groupId })
        const itemsData = await translatePlFrApi.getAllItems(groupId!)
        setItems(itemsData)
    }

    const handleEditItem = async (data: TranslateItemUpdate) => {
        if (!editingItem) return
        await translatePlFrApi.updateItem(editingItem.id, data)
        const itemsData = await translatePlFrApi.getAllItems(groupId!)
        setItems(itemsData)
    }

    const handleDeleteItem = async () => {
        if (!deletingItem) return
        setDeleteLoading(true)
        try {
            await translatePlFrApi.deleteItem(deletingItem.id)
            const itemsData = await translatePlFrApi.getAllItems(groupId!)
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
            await translatePlFrApi.importFromCsv(groupId, importFile)
            setImportOpen(false)
            setImportFile(null)
            const itemsData = await translatePlFrApi.getAllItems(groupId)
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
            const category = genCategory === 'mixed' ? undefined : genCategory
            const items = await aiApi.generate(genLevel, genCount, category)
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
            await translatePlFrApi.batchCreate({
                group_id: groupId,
                items: generatedItems.map(item => ({
                    text_pl: item.text_pl,
                    text_fr: item.text_fr,
                    category: item.category
                }))
            })
            setGenModalOpen(false)
            setGeneratedItems([])
            const itemsData = await translatePlFrApi.getAllItems(groupId)
            setItems(itemsData)
            alert("Zapisano wygenerowane zdania!")
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

    const updateGeneratedItem = (idx: number, field: 'text_pl' | 'text_fr', val: string) => {
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

    const openEditDialog = (item: TranslateItem) => {
        setDialogMode('edit')
        setEditingItem(item)
        setDialogOpen(true)
    }

    const openDeleteDialog = (item: TranslateItem) => {
        setDeletingItem(item)
        setDeleteDialogOpen(true)
    }

    if (loading) return <div className="text-center p-10"><Loader2 className="animate-spin mx-auto" /></div>
    if (error || !group) return <div className="text-center p-10 text-destructive">{error || "Group not found"}</div>

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in px-6 py-6">
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => navigate('/admin/translate-pl-fr')} className="pl-0 hover:pl-2 transition-all">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Powrót do grup
                </Button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{group.name}</h1>
                        {group.description && <p className="text-muted-foreground mt-1">{group.description}</p>}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="border-purple-200 hover:bg-purple-50 text-purple-700" onClick={() => setGenModalOpen(true)}>
                            <Wand2 className="w-4 h-4 mr-2" /> Generate Ai
                        </Button>
                        <Button variant="outline" onClick={() => setImportOpen(true)}>
                            <Upload className="w-4 h-4 mr-2" /> Import CSV
                        </Button>
                        <Button onClick={openCreateDialog}>
                            <Plus className="w-4 h-4 mr-2" /> Dodaj zdanie
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {items.map(item => (
                    <Card key={item.id} className="group hover:border-blue-200 transition-all">
                        <CardContent className="flex justify-between items-center p-4">
                            <div className="flex-1">
                                <p className="font-semibold text-lg">{item.text_pl}</p>
                                <p className="text-sm text-muted-foreground">PL (Pytanie)</p>
                            </div>
                            <ArrowRight className="text-muted-foreground mx-4" />
                            <div className="flex-1 text-right">
                                <p className="font-semibold text-lg text-blue-600">{item.text_fr}</p>
                                <p className="text-sm text-muted-foreground">FR (Odpowiedz)</p>
                            </div>
                            {item.category && (
                                <div className="mx-4 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                    {item.category}
                                </div>
                            )}
                            <div className="flex gap-2 ml-4 border-l pl-4">
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                                    <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => openDeleteDialog(item)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {items.length === 0 && (
                    <div className="text-center p-12 text-muted-foreground border-2 border-dashed rounded-xl">
                        Ta grupa jest pusta. Dodaj zdania ręcznie lub zaimportuj CSV.
                    </div>
                )}
            </div>

            <TranslateItemDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={dialogMode === 'create' ? (handleCreateItem as any) : (handleEditItem as any)}
                item={editingItem}
                mode={dialogMode}
                labels={{ pl: 'Tekst polski (Pytanie)', fr: 'Tekst francuski (Odpowiedź)' }}
            />

            <DeleteTranslateItemDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleDeleteItem}
                itemText={deletingItem?.text_pl || ''}
                loading={deleteLoading}
            />

            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import z CSV (AI Translation)</DialogTitle>
                        <DialogDescription>
                            Wybierz plik CSV. System przetłumaczy zdania z PL na FR.
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
                            Importuj i Tłumacz
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AI Generation Dialog */}
            <Dialog open={genModalOpen} onOpenChange={setGenModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5 text-purple-600" /> Generuj Zdania AI</DialogTitle>
                        <DialogDescription>
                            Wybierz poziom i ilość zdań do wygenerowania, a następnie zweryfikuj je przed zapisaniem.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Konfiguracja */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
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
                                        <SelectItem value="vocabulary">Slownictwo</SelectItem>
                                        <SelectItem value="grammar">Gramatyka</SelectItem>
                                        <SelectItem value="phrases">Zwroty</SelectItem>
                                        <SelectItem value="idioms">Idiomy</SelectItem>
                                        <SelectItem value="verbs">Czasowniki</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ilosc zdan</Label>
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

                        {/* Wyniki */}
                        {generatedItems.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">Wygenerowane zdania ({generatedItems.length})</h3>
                                </div>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {generatedItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-start p-3 border rounded-md bg-white">
                                            <div className="grid grid-cols-2 gap-2 flex-1">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Polski</Label>
                                                    <Input
                                                        value={item.text_pl}
                                                        onChange={(e) => updateGeneratedItem(idx, 'text_pl', e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Francuski</Label>
                                                    <Input
                                                        value={item.text_fr}
                                                        onChange={(e) => updateGeneratedItem(idx, 'text_fr', e.target.value)}
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

