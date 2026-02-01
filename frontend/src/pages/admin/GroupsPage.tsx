
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { groupsApi, type Group, type GroupCreate, type GroupUpdate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Loader2, AlertCircle, ArrowRight, Folder } from 'lucide-react'
import GroupDialog from '@/components/admin/GroupDialog'
import DeleteGroupDialog from '@/components/admin/DeleteGroupDialog'
import { useLanguageStore } from '@/store/languageStore'

export default function GroupsPage() {
    const navigate = useNavigate()
    const { activeLanguage } = useLanguageStore()
    const [groups, setGroups] = useState<Group[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Dialog states
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
    const [editingGroup, setEditingGroup] = useState<Group | null>(null)

    // Delete dialog states
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deletingGroup, setDeletingGroup] = useState<Group | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    useEffect(() => {
        loadGroups()
    }, [activeLanguage])

    const loadGroups = async () => {
        try {
            setLoading(true)
            setError('')
            const data = await groupsApi.getAll(activeLanguage)
            setGroups(data)
        } catch (err: any) {
            console.error('Error loading groups:', err)
            setError('Nie udało się załadować grup')
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (data: GroupCreate) => {
        await groupsApi.create(data)
        await loadGroups()
    }

    const handleEdit = async (data: GroupUpdate) => {
        if (!editingGroup) return
        await groupsApi.update(editingGroup.id, data)
        await loadGroups()
    }

    const handleDelete = async () => {
        if (!deletingGroup) return
        setDeleteLoading(true)
        try {
            await groupsApi.delete(deletingGroup.id)
            await loadGroups()
        } finally {
            setDeleteLoading(false)
            setDeletingGroup(null)
        }
    }

    const openCreateDialog = () => {
        setDialogMode('create')
        setEditingGroup(null)
        setDialogOpen(true)
    }

    const openEditDialog = (e: React.MouseEvent, group: Group) => {
        e.stopPropagation() // Prevent card click
        setDialogMode('edit')
        setEditingGroup(group)
        setDialogOpen(true)
    }

    const openDeleteDialog = (e: React.MouseEvent, group: Group) => {
        e.stopPropagation() // Prevent card click
        setDeletingGroup(group)
        setDeleteDialogOpen(true)
    }

    const handleGroupClick = (groupId: string) => {
        navigate(`/admin/groups/${groupId}`)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                    <p className="text-muted-foreground">Ładowanie grup...</p>
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
                            <Button onClick={loadGroups}>Spróbuj ponownie</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pl-6 pr-6 py-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        Zarządzanie Grupa-fiszki
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Wybierz grupę, aby zarządzać jej fiszkami
                    </p>
                </div>
                <Button onClick={openCreateDialog} size="lg" className="gap-2">
                    <Plus className="w-5 h-5" />
                    Dodaj grupę
                </Button>
            </div>

            {/* Groups Grid */}
            {groups.length === 0 ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center space-y-4">
                            <Folder className="w-12 h-12 mx-auto text-muted-foreground" />
                            <p className="text-lg font-semibold">Brak grup</p>
                            <p className="text-muted-foreground">
                                Utwórz pierwszą grupę, aby uporządkować fiszki
                            </p>
                            <Button onClick={openCreateDialog}>
                                <Plus className="w-4 h-4 mr-2" />
                                Dodaj grupę
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <Card
                            key={group.id}
                            className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-purple-200"
                            onClick={() => handleGroupClick(group.id)}
                        >
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="bg-purple-100 p-2 rounded-lg">
                                        <Folder className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                                </div>
                                <CardTitle className="text-xl mt-4">{group.name}</CardTitle>
                                {group.description && (
                                    <CardDescription className="line-clamp-2 mt-2">
                                        {group.description}
                                    </CardDescription>
                                )}
                                <div className="mt-2 text-sm text-muted-foreground font-medium">
                                    {(group.total_items || 0)} elementów
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => openEditDialog(e, group)}
                                        className="flex-1 gap-2"
                                    >
                                        <Pencil className="w-4 h-4" />
                                        Edytuj
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={(e) => openDeleteDialog(e, group)}
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
            <GroupDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSubmit={dialogMode === 'create' ? (handleCreate as any) : (handleEdit as any)}
                group={editingGroup}
                mode={dialogMode}
            />

            <DeleteGroupDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleDelete}
                groupName={deletingGroup?.name || ''}
                loading={deleteLoading}
            />
        </div>
    )
}
