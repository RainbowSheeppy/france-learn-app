import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { groupsEnApi, fiszkiEnApi, type Group, type FiszkaEn, type FiszkaEnCreate, type FiszkaEnUpdate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Loader2, AlertCircle, ArrowLeft, Image } from 'lucide-react'
import FiszkaDialog from '@/components/admin/FiszkaDialog'
import DeleteFiszkaDialog from '@/components/admin/DeleteFiszkaDialog'

export default function GroupEnDetailsPage() {
    const { groupId } = useParams()
    const navigate = useNavigate()
    const [group, setGroup] = useState<Group | null>(null)
    const [fiszki, setFiszki] = useState<FiszkaEn[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Fiszka Dialog states
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
    const [editingFiszka, setEditingFiszka] = useState<FiszkaEn | null>(null)

    // Delete dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingFiszka, setDeletingFiszka] = useState<FiszkaEn | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

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
                groupsEnApi.getOne(groupId),
                fiszkiEnApi.getAll(groupId)
            ])
            setGroup(groupData)
            setFiszki(fiszkiData)
        } catch (err: any) {
            console.error('Error loading data:', err)
            setError('Failed to load group data')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateFiszka = async (data: FiszkaEnCreate) => {
        await fiszkiEnApi.create({ ...data, group_id: groupId })
        const fiszkiData = await fiszkiEnApi.getAll(groupId)
        setFiszki(fiszkiData)
    }

    const handleEditFiszka = async (data: FiszkaEnUpdate) => {
        if (!editingFiszka) return
        await fiszkiEnApi.update(editingFiszka.id, data)
        const fiszkiData = await fiszkiEnApi.getAll(groupId)
        setFiszki(fiszkiData)
    }

    const handleDeleteFiszka = async () => {
        if (!deletingFiszka) return
        setDeleteLoading(true)
        try {
            await fiszkiEnApi.delete(deletingFiszka.id)
            const fiszkiData = await fiszkiEnApi.getAll(groupId)
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

    const openEditDialog = (fiszka: FiszkaEn) => {
        setDialogMode('edit')
        setEditingFiszka(fiszka)
        setDialogOpen(true)
    }

    const openDeleteDialog = (fiszka: FiszkaEn) => {
        setDeletingFiszka(fiszka)
        setDeleteDialogOpen(true)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Loading...</p>
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
                            <p className="text-lg font-semibold">Error</p>
                            <p className="text-muted-foreground">{error || 'Group not found'}</p>
                            <Button onClick={() => navigate('/admin/groups-en')}>Back to groups</Button>
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
                    onClick={() => navigate('/admin/groups-en')}
                    className="p-0 hover:bg-transparent hover:text-orange-600 -ml-2"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to groups
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
                            Flashcard count: {fiszki.length}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={openCreateDialog} size="lg" className="gap-2">
                            <Plus className="w-5 h-5" />
                            Add Flashcard
                        </Button>
                    </div>
                </div>
            </div>

            {/* Fiszki Grid */}
            {fiszki.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center space-y-4">
                            <p className="text-lg font-semibold">This group is empty</p>
                            <p className="text-muted-foreground">
                                Add your first flashcards to this group
                            </p>
                            <Button onClick={openCreateDialog}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Flashcard
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
                                    {fiszka.text_en}
                                </p>

                                {fiszka.image_url && (
                                    <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                                        <img
                                            src={fiszka.image_url}
                                            alt={fiszka.text_en}
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
                                        Edit
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

            {/* Dialogs - reusing FiszkaDialog with mapping for English fields */}
            <FiszkaDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={dialogMode === 'create' ?
                    ((data: any) => handleCreateFiszka({ text_pl: data.text_pl, text_en: data.text_fr, image_url: data.image_url })) :
                    ((data: any) => handleEditFiszka({ text_pl: data.text_pl, text_en: data.text_fr, image_url: data.image_url }))}
                fiszka={editingFiszka ? { ...editingFiszka, text_fr: editingFiszka.text_en } as any : null}
                mode={dialogMode}
            />

            <DeleteFiszkaDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleDeleteFiszka}
                fiszkaText={deletingFiszka?.text_pl || ''}
                loading={deleteLoading}
            />
        </div>
    )
}
