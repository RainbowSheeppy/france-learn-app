
import { useEffect, useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { translatePlFrApi, aiApi, type Group, type TranslateItem, type GeneratedItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Plus, Loader2, Filter, Upload, GraduationCap, ArrowRight, ArrowLeft, Wand2, Save, Trash2 } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"


export default function TranslatePlFrAdminPage() {
    const [items, setItems] = useState<TranslateItem[]>([])
    const [groups, setGroups] = useState<Group[]>([])
    const [selectedGroup, setSelectedGroup] = useState<string>('all')
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'groups' | 'items'>('groups')

    const { activeLanguage } = useLanguageStore()
    const langCode = activeLanguage === 'fr' ? 'FR' : 'EN'
    const langNameCap = activeLanguage === 'fr' ? 'Francuski' : 'Angielski'

    // Dialog states
    const [groupDialogOpen, setGroupDialogOpen] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')
    const [newGroupDesc, setNewGroupDesc] = useState('')

    // Import Dialog
    const [importOpen, setImportOpen] = useState(false)
    const [importFile, setImportFile] = useState<File | null>(null)
    const [importing, setImporting] = useState(false)
    const [importGroup, setImportGroup] = useState<string>('')

    // AI Generation State
    const [genModalOpen, setGenModalOpen] = useState(false)
    const [genLevel, setGenLevel] = useState('B1')
    const [genCount, setGenCount] = useState(5)
    const [generating, setGenerating] = useState(false)
    const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([])
    const [savingGen, setSavingGen] = useState(false)
    const [genGroup, setGenGroup] = useState<string>('')

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (!loading && selectedGroup !== 'all') {
            loadItems(selectedGroup)
        } else {
            setItems([])
        }
    }, [selectedGroup])


    const loadData = async () => {
        try {
            setLoading(true)
            const groupsData = await translatePlFrApi.getGroups()
            setGroups(groupsData)
            if (groupsData.length > 0) {
                // optionally select first group?
            }
        } catch (err: any) {
            console.error('Error loading data:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadItems = async (groupId: string) => {
        try {
            const data = await translatePlFrApi.getAllItems(groupId)
            setItems(data)
        } catch (err) {
            console.error(err)
        }
    }

    const handleCreateGroup = async () => {
        try {
            await translatePlFrApi.createGroup({ name: newGroupName, description: newGroupDesc })
            await loadData()
            setGroupDialogOpen(false)
            setNewGroupName('')
            setNewGroupDesc('')
        } catch (e) {
            console.error(e)
        }
    }

    const handleImport = async () => {
        if (!importFile || !importGroup) return
        setImporting(true)
        try {
            await translatePlFrApi.importFromCsv(importGroup, importFile)
            setImportOpen(false)
            setImportFile(null)
            if (selectedGroup === importGroup) {
                loadItems(importGroup)
            }
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
            const items = await aiApi.generate(genLevel, genCount)
            setGeneratedItems(items)
        } catch (e) {
            console.error(e)
            alert("Błąd generowania AI")
        } finally {
            setGenerating(false)
        }
    }

    const handleSaveGenerated = async () => {
        if (!genGroup || generatedItems.length === 0) return
        setSavingGen(true)
        try {
            await translatePlFrApi.batchCreate({
                group_id: genGroup,
                items: generatedItems.map(item => ({
                    text_pl: item.text_pl,
                    text_fr: item.text_fr
                }))
            })
            setGenModalOpen(false)
            setGeneratedItems([])
            if (selectedGroup === genGroup) {
                loadItems(genGroup)
            }
            alert("Zapisano wygenerowane zdania!")
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

    const updateGeneratedItem = (idx: number, field: 'text_pl' | 'text_fr', val: string) => {
        setGeneratedItems(prev => {
            const newItems = [...prev]
            newItems[idx] = { ...newItems[idx], [field]: val }
            return newItems
        })
    }

    if (loading) return <div className="text-center p-10"><Loader2 className="animate-spin mx-auto" /></div>

    // View state


    // ... (rest of imports and logic remains, but we need to adjust loadData and render)

    useEffect(() => {
        if (view === 'groups') {
            setSelectedGroup('all');
            setItems([]);
            loadData();
        }
    }, [view]);

    useEffect(() => {
        if (selectedGroup !== 'all') {
            setView('items');
            loadItems(selectedGroup);
        }
    }, [selectedGroup]);


    // ... (inside render)

    if (view === 'groups') {
        return (
            <div className="max-w-6xl mx-auto space-y-6 animate-fade-in px-6 py-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                            Tłumaczenie PL → FR (Grupy)
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Wybierz grupę, aby zarządzać
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setGroupDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> Dodaj Grupę
                        </Button>
                        <Button variant="secondary" onClick={() => setImportOpen(true)} disabled={groups.length === 0}>
                            <Upload className="w-4 h-4 mr-2" /> Import CSV
                        </Button>
                        <Button variant="outline" className="border-purple-200 hover:bg-purple-50 text-purple-700" onClick={() => { setGenGroup(selectedGroup === 'all' ? '' : selectedGroup); setGenModalOpen(true); }}>
                            <Wand2 className="w-4 h-4 mr-2" /> Generate Ai
                        </Button>
                        <Button onClick={() => window.location.href = '/learn/translate-pl-fr'}>
                            <GraduationCap className="w-4 h-4 mr-2" /> Tryb Nauki
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <Card
                            key={group.id}
                            className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-blue-200"
                            onClick={() => setSelectedGroup(group.id)}
                        >
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="bg-blue-100 p-2 rounded-lg">
                                        <Filter className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                </div>
                                <CardTitle className="text-xl mt-4">{group.name}</CardTitle>
                                {group.description && (
                                    <CardDescription className="line-clamp-2 mt-2">
                                        {group.description}
                                    </CardDescription>
                                )}
                            </CardHeader>
                        </Card>
                    ))}
                    {groups.length === 0 && (
                        <div className="col-span-full text-center p-12 bg-gray-50 rounded-xl border-2 border-dashed">
                            <p className="text-muted-foreground">Brak grup. Dodaj pierwszą grupę.</p>
                        </div>
                    )}
                </div>

                {/* Dialogs reused... */}
                <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Dodaj nową grupę</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nazwa grupy</Label>
                                <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Opis (opcjonalnie)</Label>
                                <Input value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="Np. Podstawowe zwroty na wakacje" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreateGroup}>Utwórz</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={importOpen} onOpenChange={setImportOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Import z CSV (AI Translation)</DialogTitle>
                            <DialogDescription>
                                Wybierz plik CSV z kolumną 'text_pl'. System automatycznie przetłumaczy zdania na francuski.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Grupa docelowa</Label>
                                <Select value={importGroup} onValueChange={setImportGroup}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wybierz grupę" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {groups.map((group) => (
                                            <SelectItem key={group.id} value={group.id}>
                                                {group.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
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
                            <Button onClick={handleImport} disabled={!importFile || !importGroup || importing}>
                                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Importuj i Tłumacz
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )
    }

    // ITEM VIEW
    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in px-6 py-6">
            <div className="flex items-center justify-between">
                <div>
                    <Button variant="ghost" onClick={() => setView('groups')} className="mb-2 pl-0 hover:pl-2 transition-all">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do grup
                    </Button>
                    <h1 className="text-3xl font-bold">
                        {groups.find(g => g.id === selectedGroup)?.name || 'Szczegóły grupy'}
                    </h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="border-purple-200 hover:bg-purple-50 text-purple-700" onClick={() => { setGenGroup(selectedGroup); setGenModalOpen(true); }}>
                        <Wand2 className="w-4 h-4 mr-2" /> Generate Ai
                    </Button>
                    <Button variant="secondary" onClick={() => { setImportGroup(selectedGroup); setImportOpen(true); }}>
                        <Upload className="w-4 h-4 mr-2" /> Import do tej grupy
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {items.map(item => (
                    <Card key={item.id}>
                        <CardContent className="flex justify-between items-center p-4">
                            <div className="flex-1">
                                <p className="font-semibold text-lg">{item.text_pl}</p>
                                <p className="text-sm text-muted-foreground">PL</p>
                            </div>
                            <ArrowRight className="text-muted-foreground mx-4" />
                            <div className="flex-1 text-right">
                                <p className="font-semibold text-lg text-blue-600">{item.text_fr}</p>
                                <p className="text-sm text-muted-foreground">{langCode}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {items.length === 0 && (
                    <div className="text-center p-8 text-muted-foreground">Grupa jest pusta. Zaimportuj CSV.</div>
                )}
            </div>

            {/* Re-include Import Dialog for this view too if needed, or hoist it */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import z CSV (AI Translation)</DialogTitle>
                        <DialogDescription>
                            Import do grupy: {groups.find(g => g.id === importGroup)?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Group select hidden or readonly if context knows group, but reuse logic for simplicity */}
                        <div className="space-y-2">
                            <Label>Grupa</Label>
                            <Select value={importGroup} onValueChange={setImportGroup} disabled>
                                <SelectTrigger>
                                    <SelectValue placeholder="Wybierz grupę" />
                                </SelectTrigger>
                                <SelectContent>
                                    {groups.map((group) => (
                                        <SelectItem key={group.id} value={group.id}>
                                            {group.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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
                        <Button onClick={handleImport} disabled={!importFile || !importGroup || importing}>
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
                                <Label>Ilość zdań</Label>
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
                                                    <Label className="text-xs text-muted-foreground">{langNameCap}</Label>
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
                                    <div className="flex-1 space-y-2">
                                        <Label>Wybierz grupę docelową</Label>
                                        <Select value={genGroup} onValueChange={setGenGroup}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Wybierz grupę" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {groups.map((group) => (
                                                    <SelectItem key={group.id} value={group.id}>
                                                        {group.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleSaveGenerated} disabled={!genGroup || savingGen} className="w-1/3">
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