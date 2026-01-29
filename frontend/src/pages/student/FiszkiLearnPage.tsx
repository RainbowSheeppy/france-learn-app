import { useEffect, useState } from 'react'
import { fiszkiApi, type Fiszka } from '@/lib/api'
import FlipCard from '@/components/FlipCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, RotateCcw, AlertCircle, Loader2 } from 'lucide-react'

export default function FiszkiLearnPage() {
    const [fiszki, setFiszki] = useState<Fiszka[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadFiszki()
    }, [])

    const loadFiszki = async () => {
        try {
            setLoading(true)
            setError('')
            const data = await fiszkiApi.getAll()
            setFiszki(data)
        } catch (err: any) {
            console.error('Error loading fiszki:', err)
            setError('Nie udało się załadować fiszek')
        } finally {
            setLoading(false)
        }
    }

    const handleNext = () => {
        if (currentIndex < fiszki.length - 1) {
            setCurrentIndex(currentIndex + 1)
            setIsFlipped(false)
        }
    }

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1)
            setIsFlipped(false)
        }
    }

    const handleFlip = () => {
        setIsFlipped(!isFlipped)
    }

    const handleReset = () => {
        setCurrentIndex(0)
        setIsFlipped(false)
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
                            <Button onClick={loadFiszki}>
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Spróbuj ponownie
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (fiszki.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md">
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground" />
                            <p className="text-lg font-semibold">Brak fiszek</p>
                            <p className="text-muted-foreground">
                                Nie ma jeszcze żadnych fiszek do nauki. Poproś administratora o dodanie materiałów.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const currentFiszka = fiszki[currentIndex]

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    Fiszki
                </h1>
                <p className="text-muted-foreground">
                    Karta {currentIndex + 1} z {fiszki.length}
                </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                <div
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / fiszki.length) * 100}%` }}
                />
            </div>

            {/* Flip Card */}
            <FlipCard
                fiszka={currentFiszka}
                isFlipped={isFlipped}
                onFlip={handleFlip}
            />

            {/* Navigation Controls */}
            <div className="flex items-center justify-center gap-4">
                <Button
                    variant="outline"
                    size="lg"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="gap-2"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Poprzednia
                </Button>

                <Button
                    variant="ghost"
                    size="lg"
                    onClick={handleReset}
                    className="gap-2"
                >
                    <RotateCcw className="w-4 h-4" />
                    Od nowa
                </Button>

                <Button
                    variant="outline"
                    size="lg"
                    onClick={handleNext}
                    disabled={currentIndex === fiszki.length - 1}
                    className="gap-2"
                >
                    Następna
                    <ChevronRight className="w-5 h-5" />
                </Button>
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="text-center text-sm text-muted-foreground">
                <p>💡 Wskazówka: Kliknij kartę, aby ją obrócić</p>
            </div>
        </div>
    )
}
