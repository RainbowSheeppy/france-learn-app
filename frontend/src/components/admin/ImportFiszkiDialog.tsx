import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from '@/components/ui/label'
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react'
import { type Group, fiszkiApi } from '@/lib/api'

interface ImportFiszkiDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    groups: Group[]
    onSuccess: () => void
    defaultGroupId?: string
}

export default function ImportFiszkiDialog({
    open,
    onOpenChange,
    groups,
    onSuccess,
    defaultGroupId
}: ImportFiszkiDialogProps) {
    const [selectedGroup, setSelectedGroup] = useState<string>(defaultGroupId || '')
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [dragActive, setDragActive] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Reset or set default group when dialog opens
    if (open && defaultGroupId && selectedGroup !== defaultGroupId) {
        setSelectedGroup(defaultGroupId)
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true)
        } else if (e.type === "dragleave") {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0])
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0])
        }
    }

    const validateAndSetFile = (file: File) => {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            setError('Proszę wybrać plik CSV')
            return
        }
        setFile(file)
        setError('')
    }

    const handleSubmit = async () => {
        if (!selectedGroup) {
            setError('Proszę wybrać grupę')
            return
        }
        if (!file) {
            setError('Proszę wybrać plik')
            return
        }

        try {
            setLoading(true)
            setError('')
            await fiszkiApi.importFromCsv(selectedGroup, file)
            onSuccess()
            handleClose()
        } catch (err: any) {
            console.error('Import error:', err)
            setError(err.response?.data?.detail || 'Wystąpił błąd podczas importu')
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        setFile(null)
        setSelectedGroup('')
        setError('')
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Importuj Fiszki</DialogTitle>
                    <DialogDescription>
                        Wybierz grupę docelową i prześlij plik CSV z fiszkami.
                        Wymagane kolumny: text_pl, text_target. Opcjonalnie: image_url.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="group">Grupa</Label>
                        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                            <SelectTrigger id="group">
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

                    <div
                        className={`
                            border-2 border-dashed rounded-lg p-8 text-center transition-colors
                            ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                            ${file ? 'bg-primary/5 border-primary' : ''}
                        `}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={inputRef}
                            type="file"
                            className="hidden"
                            accept=".csv"
                            onChange={handleChange}
                        />

                        {file ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-3 bg-background rounded-full shadow-sm">
                                    <FileText className="w-8 h-8 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-sm">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setFile(null)}
                                    className="text-destructive hover:text-destructive mt-2"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Usuń plik
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-3 bg-muted rounded-full">
                                    <Upload className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium">Przeciągnij i upuść plik tutaj</p>
                                    <p className="text-sm text-muted-foreground">lub</p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => inputRef.current?.click()}
                                >
                                    Wybierz plik
                                </Button>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={loading}>
                        Anuluj
                    </Button>
                    <Button onClick={handleSubmit} disabled={!file || !selectedGroup || loading}>
                        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Importuj
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
