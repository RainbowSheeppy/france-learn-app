import { useEffect, useState } from 'react';
import Confetti, { helloKittyColors, defaultColors } from './Confetti';

interface Particle {
    id: number;
    x: number;
    y: number;
    emoji: string;
    size: number;
    delay: number;
    duration: number;
}

interface SuccessCelebrationProps {
    show: boolean;
    type?: 'correct' | 'session-complete';
    theme?: 'default' | 'hellokitty';
    onComplete?: () => void;
}

const defaultEmojis = ['✨', '🎉', '⭐', '💫', '🌟'];
const helloKittyEmojis = ['💖', '💕', '🎀', '🌸', '✨', '💗', '⭐', '🩷'];

export default function SuccessCelebration({
    show,
    type = 'correct',
    theme = 'default',
    onComplete
}: SuccessCelebrationProps) {
    const [particles, setParticles] = useState<Particle[]>([]);
    const [visible, setVisible] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    const emojis = theme === 'hellokitty' ? helloKittyEmojis : defaultEmojis;

    useEffect(() => {
        if (show) {
            setVisible(true);
            setShowConfetti(true);

            // Generate particles
            const count = type === 'session-complete' ? 40 : 15;
            const newParticles: Particle[] = [];

            for (let i = 0; i < count; i++) {
                newParticles.push({
                    id: i,
                    x: 50 + (Math.random() - 0.5) * 80,
                    y: 50 + (Math.random() - 0.5) * 60,
                    emoji: emojis[Math.floor(Math.random() * emojis.length)],
                    size: type === 'session-complete' ? 20 + Math.random() * 20 : 16 + Math.random() * 14,
                    delay: Math.random() * 0.4,
                    duration: 0.6 + Math.random() * 0.5,
                });
            }

            setParticles(newParticles);

            const timer = setTimeout(() => {
                setVisible(false);
                setShowConfetti(false);
                setParticles([]);
                onComplete?.();
            }, type === 'session-complete' ? 3000 : 1500);

            return () => clearTimeout(timer);
        }
    }, [show, type, theme, onComplete]);

    if (!visible) return null;

    return (
        <>
            {/* Confetti layer */}
            {type === 'session-complete' && (
                <Confetti
                    show={showConfetti}
                    count={80}
                    colors={theme === 'hellokitty' ? helloKittyColors : defaultColors}
                    duration={3000}
                />
            )}

            <div className="fixed inset-0 pointer-events-none z-50">
                {/* Particles */}
                {particles.map((particle) => (
                    <div
                        key={particle.id}
                        className="absolute animate-scale-pop"
                        style={{
                            left: `${particle.x}%`,
                            top: `${particle.y}%`,
                            fontSize: `${particle.size}px`,
                            animationDelay: `${particle.delay}s`,
                            animationDuration: `${particle.duration}s`,
                        }}
                    >
                        {particle.emoji}
                    </div>
                ))}

                {/* Central celebration for session complete */}
                {type === 'session-complete' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div
                            className="text-8xl animate-bounce-in"
                            style={{
                                filter: theme === 'hellokitty'
                                    ? 'drop-shadow(0 0 30px rgba(255, 105, 180, 0.6))'
                                    : 'drop-shadow(0 0 30px rgba(255, 200, 100, 0.6))'
                            }}
                        >
                            {theme === 'hellokitty' ? '🎀✨🎀' : '🎉'}
                        </div>
                    </div>
                )}

                {/* Correct answer sparkle effect */}
                {type === 'correct' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                            {/* Central checkmark */}
                            <div
                                className="text-6xl animate-scale-pop"
                                style={{
                                    filter: theme === 'hellokitty'
                                        ? 'drop-shadow(0 0 15px rgba(255, 105, 180, 0.5))'
                                        : 'drop-shadow(0 0 15px rgba(16, 185, 129, 0.5))'
                                }}
                            >
                                {theme === 'hellokitty' ? '💖' : '✨'}
                            </div>
                            {/* Surrounding sparkles */}
                            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                                <div
                                    key={i}
                                    className="absolute text-2xl animate-sparkle"
                                    style={{
                                        left: `${Math.cos((angle * Math.PI) / 180) * 60}px`,
                                        top: `${Math.sin((angle * Math.PI) / 180) * 60}px`,
                                        animationDelay: `${i * 0.1}s`,
                                    }}
                                >
                                    ✨
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Glow effect */}
                <div
                    className="absolute inset-0 opacity-40 animate-pulse"
                    style={{
                        background: theme === 'hellokitty'
                            ? 'radial-gradient(circle at center, rgba(255, 105, 180, 0.4) 0%, transparent 60%)'
                            : 'radial-gradient(circle at center, rgba(255, 200, 100, 0.4) 0%, transparent 60%)',
                    }}
                />

                {/* Extra falling hearts for hello kitty theme */}
                {theme === 'hellokitty' && type === 'session-complete' && (
                    <div className="absolute inset-0 overflow-hidden">
                        {Array.from({ length: 20 }).map((_, i) => (
                            <div
                                key={`heart-${i}`}
                                className="absolute text-3xl"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: '-30px',
                                    animation: `hearts-fall ${2.5 + Math.random()}s ease-in forwards`,
                                    animationDelay: `${Math.random() * 1.5}s`,
                                }}
                            >
                                {['💖', '💕', '🩷', '💗', '🎀'][Math.floor(Math.random() * 5)]}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
