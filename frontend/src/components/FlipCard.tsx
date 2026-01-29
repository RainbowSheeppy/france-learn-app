import { motion } from 'framer-motion'
import type { Fiszka } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'

interface FlipCardProps {
    fiszka: Fiszka
    isFlipped: boolean
    onFlip: () => void
}

export default function FlipCard({ fiszka, isFlipped, onFlip }: FlipCardProps) {
    const theme = useThemeStore((state) => state.theme)
    const isHK = theme === 'hellokitty'

    // Theme-based gradients
    const frontGradient = isHK
        ? 'bg-gradient-to-br from-[hsl(350,90%,80%)] to-[hsl(330,85%,70%)]'
        : 'bg-gradient-to-br from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)]'

    const backGradient = isHK
        ? 'bg-gradient-to-br from-[hsl(330,85%,70%)] to-[hsl(350,90%,75%)]'
        : 'bg-gradient-to-br from-[hsl(350,80%,65%)] to-[hsl(260,60%,65%)]'

    return (
        <div className="perspective-1000 w-full max-w-2xl mx-auto">
            <motion.div
                className="relative w-full h-[400px] md:h-[500px] cursor-pointer"
                onClick={onFlip}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.7, type: 'spring', stiffness: 80, damping: 15 }}
                style={{ transformStyle: 'preserve-3d' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {/* Przód karty - Polski tekst */}
                <div
                    className={cn(
                        'absolute inset-0 backface-hidden rounded-3xl shadow-2xl',
                        frontGradient,
                        'flex flex-col items-center justify-center p-8 text-white',
                        'border-4 border-white/20'
                    )}
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden'
                    }}
                >
                    {/* Decorative elements for HK theme */}
                    {isHK && (
                        <>
                            <div className="absolute top-4 left-4 text-3xl animate-ribbon-wave">🎀</div>
                            <div className="absolute top-4 right-4 text-2xl animate-float">✨</div>
                            <div className="absolute bottom-4 left-4 text-2xl animate-float" style={{ animationDelay: '0.5s' }}>🌸</div>
                            <div className="absolute bottom-4 right-4 text-3xl animate-ribbon-wave" style={{ animationDelay: '0.3s' }}>🎀</div>
                        </>
                    )}

                    <div className="text-center space-y-6 relative z-10">
                        <div className="text-sm uppercase tracking-wider opacity-90 font-semibold">
                            {isHK ? '🇵🇱 Polski 🇵🇱' : 'Polski'}
                        </div>
                        <p className="text-3xl md:text-4xl font-bold leading-relaxed drop-shadow-lg">
                            {fiszka.text_pl}
                        </p>
                        <div className="pt-8 text-sm opacity-80">
                            {isHK ? '💫 Kliknij, aby zobaczyć tłumaczenie 💫' : 'Kliknij, aby zobaczyć tłumaczenie'}
                        </div>
                    </div>
                </div>

                {/* Tył karty - Francuski tekst */}
                <div
                    className={cn(
                        'absolute inset-0 backface-hidden rounded-3xl shadow-2xl',
                        backGradient,
                        'flex flex-col items-center justify-center p-8 text-white',
                        'border-4 border-white/20'
                    )}
                    style={{
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)'
                    }}
                >
                    {/* Decorative elements for HK theme */}
                    {isHK && (
                        <>
                            <div className="absolute top-4 left-4 text-2xl animate-float">💖</div>
                            <div className="absolute top-4 right-4 text-3xl animate-ribbon-wave">🎀</div>
                            <div className="absolute bottom-4 left-4 text-3xl animate-ribbon-wave" style={{ animationDelay: '0.2s' }}>🎀</div>
                            <div className="absolute bottom-4 right-4 text-2xl animate-float" style={{ animationDelay: '0.4s' }}>💕</div>
                        </>
                    )}

                    <div className="text-center space-y-6 relative z-10">
                        <div className="text-sm uppercase tracking-wider opacity-90 font-semibold">
                            {isHK ? '🇫🇷 Français 🇫🇷' : 'Français'}
                        </div>
                        <p className="text-3xl md:text-4xl font-bold leading-relaxed drop-shadow-lg">
                            {fiszka.text_fr}
                        </p>

                        {fiszka.image_url && (
                            <div className="pt-6">
                                <img
                                    src={fiszka.image_url}
                                    alt={fiszka.text_fr}
                                    className="max-w-full max-h-48 mx-auto rounded-xl shadow-xl object-contain border-4 border-white/30"
                                />
                            </div>
                        )}

                        <div className="pt-8 text-sm opacity-80">
                            {isHK ? '✨ Kliknij, aby wrócić ✨' : 'Kliknij, aby wrócić'}
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
