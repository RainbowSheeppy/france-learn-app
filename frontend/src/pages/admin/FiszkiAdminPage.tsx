
import { useEffect, useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { fiszkiApi, groupsApi, type Fiszka, type FiszkaCreate, type FiszkaUpdate, type Group } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Loader2, AlertCircle, Image, Filter, Upload, GraduationCap } from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import FiszkaDialog from '@/components/admin/FiszkaDialog'
import DeleteFiszkaDialog from '@/components/admin/DeleteFiszkaDialog'
import ImportFiszkiDialog from '@/components/admin/ImportFiszkiDialog'

export default function FiszkiAdminPage() {
    const [fiszki, setFiszki] = useState<Fiszka[]>([])
    const [groups, setGroups] = useState<Group[]>([])
    const { activeLanguage } = useLanguageStore()
    const [selectedGroup, setSelectedGroup] = useState<string>('all')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Dialog states
    const [dialogOpen, setDialogOpen] = useState(false)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
    const [editingFiszka, setEditingFiszka] = useState<Fiszka | null>(null)

    // Delete dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingFiszka, setDeletingFiszka] = useState<Fiszka | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    useEffect(() => {
        if (!loading) {
            loadFiszki()
        }
    }, [selectedGroup])


    const loadData = async () => {
        try {
            setLoading(true)
            setError('')
            const [fiszkiData, groupsData] = await Promise.all([
                fiszkiApi.getAll(selectedGroup === 'all' ? undefined : selectedGroup),
                groupsApi.getAll()
            ])
            setFiszki(fiszkiData)
            setGroups(groupsData)
        } catch (err: any) {
            console.error('Error loading data:', err)
            setError('Nie udało się załadować danych')
        } finally {
            setLoading(false)
        }
    }

    const loadFiszki = async () => {
        try {
            setError('')
            const groupId = selectedGroup === 'all' ? undefined : selectedGroup
            const data = await fiszkiApi.getAll(groupId)
            setFiszki(data)
        } catch (err: any) {
            console.error('Error loading fiszki:', err)
            setError('Nie udało się załadować fiszek')
        }
    }

    const handleCreate = async (data: FiszkaCreate) => {
        await fiszkiApi.create(data)
        await loadFiszki()
    }

    const handleEdit = async (data: FiszkaUpdate) => {
        if (!editingFiszka) return
        await fiszkiApi.update(editingFiszka.id, data)
        await loadFiszki()
    }

    const handleDelete = async () => {
        if (!deletingFiszka) return
        setDeleteLoading(true)
        try {
            await fiszkiApi.delete(deletingFiszka.id)
            await loadFiszki()
        } finally {
            setDeleteLoading(false)
            setDeletingFiszka(null)
        }
    }

    const openCreateDialog = () => {
        setDialogMode('create')
        setEditingFiszka(null)
        setDialogOpen(true)
    }

    const openEditDialog = (fiszka: Fiszka) => {
        setDialogMode('edit')
        setEditingFiszka(fiszka)
        setDialogOpen(true)
    }

    const openDeleteDialog = (fiszka: Fiszka) => {
        setDeletingFiszka(fiszka)
        setDeleteDialogOpen(true)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Ładowanie fiszek...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
                            <p className="text-lg font-semibold">Wystąpił błąd</p>
                            <p className="text-muted-foreground">{error}</p>
                            <Button onClick={loadData}>Spróbuj ponownie</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in px-6 py-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        Zarządzanie Fiszkami
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Łącznie {fiszki.length} {fiszki.length === 1 ? 'fiszka' : 'fiszek'}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                        <SelectTrigger className="w-[200px]">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Filtruj po grupie" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Wszystkie grupy</SelectItem>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                    {group.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
                        <Upload className="w-4 h-4" />
                        Import CSV
                    </Button>

                    <Button
                        variant="secondary"
                        onClick={() => window.location.href = '/learn/fiszki'}
                        className="gap-2"
                    >
                        <GraduationCap className="w-4 h-4" />
                        Tryb Nauki
                    </Button>

                    <Button onClick={openCreateDialog} size="lg" className="gap-2">
                        <Plus className="w-5 h-5" />
                        Dodaj fiszkę
                    </Button>
                </div>
            </div>

            {/* Fiszki Grid */}
            {fiszki.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center space-y-4">
                            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground" />
                            <p className="text-lg font-semibold">Brak fiszek</p>
                            <p className="text-muted-foreground">
                                {selectedGroup !== 'all'
                                    ? 'W tej grupie nie ma jeszcze fiszek.'
                                    : 'Rozpocznij od dodania pierwszej fiszki'}
                            </p>
                            <div className="flex justify-center gap-2">
                                <Button onClick={openCreateDialog}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Dodaj fiszkę
                                </Button>
                                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Import CSV
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fiszki.map((fiszka) => (
                        <Card key={fiszka.id} className="group hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-start justify-between">
                                    <span className="line-clamp-2">{fiszka.text_pl}</span>
                                    {fiszka.image_url && (
                                        <Image className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
                                    )}
                                </CardTitle>
                                {fiszka.group_id && (
                                    <p className="text-xs text-muted-foreground">
                                        Grupa: {groups.find(g => g.id === fiszka.group_id)?.name || 'Nieznana'}
                                    </p>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {fiszka.text_target}
                                </p>

                                {fiszka.image_url && (
                                    <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                                        <img
                                            src={fiszka.image_url}
                                            alt={fiszka.text_target}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditDialog(fiszka)}
                                        className="flex-1 gap-2"
                                    >
                                        <Pencil className="w-4 h-4" />
                                        Edytuj
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => openDeleteDialog(fiszka)}
                                        className="gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Dialogs */}
            <FiszkaDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={dialogMode === 'create' ? (handleCreate as any) : (handleEdit as any)}
                fiszka={editingFiszka}
                mode={dialogMode}
                groups={groups} // Pass groups for selection
                labels={activeLanguage === 'fr' ? {
                    textTarget: 'Tekst w jęz. obcym (FR)',
                    placeholderTarget: 'np. Bonjour'
                } : {
                    textTarget: 'Tekst w jęz. obcym (EN)',
                    placeholderTarget: 'np. Hello'
                }}
            />

            <ImportFiszkiDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                groups={groups}
                onSuccess={() => {
                    loadFiszki()
                    setImportDialogOpen(false)
                }}
            />

            <DeleteFiszkaDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleDelete}
                fiszkaText={deletingFiszka?.text_pl || ''}
                loading={deleteLoading}
            />
        </div>
    )
}

