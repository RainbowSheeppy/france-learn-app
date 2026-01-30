import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { translateEnPlApi, type Group, type GroupCreate, type GroupUpdate } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Pencil, Trash2, Loader2, AlertCircle, ArrowRight, BookA, GraduationCap } from 'lucide-react'
import GroupDialog from '@/components/admin/GroupDialog'
import DeleteGroupDialog from '@/components/admin/DeleteGroupDialog'

export default function TranslateEnPlGroupsPage() {
    const navigate = useNavigate()
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
    }, [])

    const loadGroups = async () => {
        try {
            setLoading(true)
            setError('')
            const data = await translateEnPlApi.getGroups()
            setGroups(data)
        } catch (err: any) {
            console.error('Error loading groups:', err)
            setError('Nie udało się załadować grup')
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (data: GroupCreate) => {
        await translateEnPlApi.createGroup(data)
        await loadGroups()
    }

    const handleEdit = async (data: GroupUpdate) => {
        if (!editingGroup) return
        await translateEnPlApi.updateGroup(editingGroup.id, data)
        await loadGroups()
    }

    const handleDelete = async () => {
        if (!deletingGroup) return
        setDeleteLoading(true)
        try {
            await translateEnPlApi.deleteGroup(deletingGroup.id)
            await loadGroups()
        } catch (err) {
            console.error(err)
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
        e.stopPropagation()
        setDialogMode('edit')
        setEditingGroup(group)
        setDialogOpen(true)
    }

    const openDeleteDialog = (e: React.MouseEvent, group: Group) => {
        e.stopPropagation()
        setDeletingGroup(group)
        setDeleteDialogOpen(true)
    }

    const handleGroupClick = (groupId: string) => {
        navigate(`/admin/translate-en-pl/${groupId}`)
    }

    if (loading) return <div className="text-center p-10"><Loader2 className="animate-spin mx-auto" /></div>

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center space-y-4">
                    <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
                    <p className="text-muted-foreground">{error}</p>
                    <Button onClick={loadGroups}>Spróbuj ponownie</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in px-6 py-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                        Tłumaczenie EN → PL
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Wybierz grupę zdań do edycji
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={() => window.location.href = '/learn/translate-en-pl'}
                        className="gap-2"
                    >
                        <GraduationCap className="w-5 h-5" /> Tryb Nauki
                    </Button>
                    <Button onClick={openCreateDialog} size="lg" className="gap-2">
                        <Plus className="w-5 h-5" /> Dodaj Grupę
                    </Button>
                </div>
            </div>

            {groups.length === 0 ? (
                <div className="text-center p-12 bg-gray-50 rounded-xl border-2 border-dashed">
                    <p className="text-muted-foreground">Brak grup. Dodaj pierwszą grupę.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <Card
                            key={group.id}
                            className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-teal-200"
                            onClick={() => handleGroupClick(group.id)}
                        >
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="bg-teal-100 p-2 rounded-lg">
                                        <BookA className="w-6 h-6 text-teal-600" />
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-teal-600 group-hover:translate-x-1 transition-all" />
                                </div>
                                <CardTitle className="text-xl mt-4">{group.name}</CardTitle>
                                {group.description && (
                                    <CardDescription className="line-clamp-2 mt-2">
                                        {group.description}
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => openEditDialog(e, group)}
                                        className="flex-1 gap-2"
                                    >
                                        <Pencil className="w-4 h-4" /> Edytuj
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
