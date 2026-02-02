
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { groupsApi, fiszkiApi, type Group, type Fiszka, type FiszkaCreate, type FiszkaUpdate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Loader2, AlertCircle, ArrowLeft, Image, Upload } from 'lucide-react'
import FiszkaDialog from '@/components/admin/FiszkaDialog'
import DeleteFiszkaDialog from '@/components/admin/DeleteFiszkaDialog'
import ImportFiszkiDialog from '@/components/admin/ImportFiszkiDialog'

export default function GroupDetailsPage() {
    const { groupId } = useParams()
    const navigate = useNavigate()
    const [group, setGroup] = useState<Group | null>(null)
    const [fiszki, setFiszki] = useState<Fiszka[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Fiszka Dialog states
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
    const [editingFiszka, setEditingFiszka] = useState<Fiszka | null>(null)

    // Delete dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingFiszka, setDeletingFiszka] = useState<Fiszka | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    // Import dialog state
    const [importDialogOpen, setImportDialogOpen] = useState(false)

    useEffect(() => {
        if (groupId) {
            loadData()
        }
    }, [groupId])

    const loadData = async () => {
        if (!groupId) return
        try {
            setLoading(true)
            setError('')
            const [groupData, fiszkiData] = await Promise.all([
                groupsApi.getOne(groupId),
                fiszkiApi.getAll(groupId)
            ])
            setGroup(groupData)
            setFiszki(fiszkiData)
        } catch (err: any) {
            console.error('Error loading data:', err)
            setError('Nie udało się załadować danych grupy')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateFiszka = async (data: FiszkaCreate) => {
        // Ensure the fiszka is assigned to this group
        await fiszkiApi.create({ ...data, group_id: groupId })
        // Reload only fiszki to save bandwidth? Or reload all?
        // Since we need to update the list, reloading fiszki is enough.
        // But for simplicity reuse loadData or just refetch fiszki.
        const fiszkiData = await fiszkiApi.getAll(groupId)
        setFiszki(fiszkiData)
    }

    const handleEditFiszka = async (data: FiszkaUpdate) => {
        if (!editingFiszka) return
        await fiszkiApi.update(editingFiszka.id, data)
        const fiszkiData = await fiszkiApi.getAll(groupId)
        setFiszki(fiszkiData)
    }

    const handleDeleteFiszka = async () => {
        if (!deletingFiszka) return
        setDeleteLoading(true)
        try {
            await fiszkiApi.delete(deletingFiszka.id)
            const fiszkiData = await fiszkiApi.getAll(groupId)
            setFiszki(fiszkiData)
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
                    <p className="text-muted-foreground">Ładowanie...</p>
                </div>
            </div>
        )
    }

    if (error || !group) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
                            <p className="text-lg font-semibold">Wystąpił błąd</p>
                            <p className="text-muted-foreground">{error || 'Grupa nie znaleziona'}</p>
                            <Button onClick={() => navigate('/admin/groups')}>Wróć do listy grup</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pl-6 pr-6 py-6">
            {/* Header */}
            <div className="space-y-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/admin/groups')}
                    className="p-0 hover:bg-transparent hover:text-purple-600 -ml-2"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Powrót do grup
                </Button>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-foreground">
                            {group.name}
                        </h1>
                        {group.description && (
                            <p className="text-muted-foreground mt-2 text-lg">
                                {group.description}
                            </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">
                            Liczba fiszek: {fiszki.length}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
                            <Upload className="w-4 h-4" />
                            Import CSV
                        </Button>
                        <Button onClick={openCreateDialog} size="lg" className="gap-2">
                            <Plus className="w-5 h-5" />
                            Dodaj fiszkę
                        </Button>
                    </div>
                </div>
            </div>

            {/* Fiszki Grid */}
            {fiszki.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center space-y-4">
                            <p className="text-lg font-semibold">Ta grupa jest pusta</p>
                            <p className="text-muted-foreground">
                                Dodaj pierwsze fiszki do tej grupy
                            </p>
                            <Button onClick={openCreateDialog}>
                                <Plus className="w-4 h-4 mr-2" />
                                Dodaj fiszkę
                            </Button>
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
                onSubmit={dialogMode === 'create' ? (handleCreateFiszka as any) : (handleEditFiszka as any)}
                fiszka={editingFiszka}
                mode={dialogMode}
            // TODO: Pass groupId if FiszkaDialog supports locking to a group or just handle creating with group_id effectively.
            // Since FiszkaDialog is generic, implementing group selection inside it might be better, or we force it here.
            // For now, FiszkaDialog doesn't know about groups, I need to update it.
            />

            <DeleteFiszkaDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleDeleteFiszka}
                fiszkaText={deletingFiszka?.text_pl || ''}
                loading={deleteLoading}
            />

            {group && (
                <ImportFiszkiDialog
                    open={importDialogOpen}
                    onOpenChange={setImportDialogOpen}
                    groups={[group]} // Pass only current group to restrict selection or pass all groups if needed, but here we want to import to THIS group. 
                    // However, backend needs Group object. ImportFiszkiDialog expects groups array. 
                    // Also we added defaultGroupId.
                    // Ideally we should pass all groups if we want to allow switching, but user context is "Import here". 
                    // Let's pass [group] so it's the only option.
                    defaultGroupId={group.id}
                    onSuccess={() => {
                        loadData() // Reload both group and fiszki to be processing-safe
                        setImportDialogOpen(false)
                    }}
                />
            )}
        </div>
    )
}
