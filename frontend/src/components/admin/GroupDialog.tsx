
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { Group, GroupCreate, GroupUpdate } from '@/lib/api'

const formSchema = z.object({
    name: z.string().min(1, 'Nazwa jest wymagana').max(100, 'Nazwa jest zbyt długa'),
    description: z.string().max(500, 'Opis jest zbyt długi').optional(),
})

interface GroupDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (data: GroupCreate | GroupUpdate) => Promise<void>
    group: Group | null
    mode: 'create' | 'edit'
}

export default function GroupDialog({
    open,
    onOpenChange,
    onSubmit,
    group,
    mode,
}: GroupDialogProps) {
    const [loading, setLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            description: '',
        },
    })

    useEffect(() => {
        if (group && mode === 'edit') {
            form.reset({
                name: group.name,
                description: group.description || '',
            })
        } else {
            form.reset({
                name: '',
                description: '',
            })
        }
    }, [group, mode, form, open])

    const handleSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            setLoading(true)
            await onSubmit(values)
            onOpenChange(false)
            form.reset()
        } catch (error) {
            console.error('Error submitting group:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Dodaj nową grupę' : 'Edytuj grupę'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Wypełnij poniższy formularz, aby utworzyć nową grupę fiszek.'
                            : 'Wprowadź zmiany w istniejącej grupie.'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nazwa grupy</FormLabel>
                                    <FormControl>
                                        <Input placeholder="np. Owoce i Warzywa" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Opis (opcjonalnie)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Krótki opis zawartości grupy..."
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={loading}
                            >
                                Anuluj
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
                                {mode === 'create' ? 'Utwórz' : 'Zapisz zmiany'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
