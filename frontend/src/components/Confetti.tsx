import { useEffect, useState } from 'react';

interface ConfettiPiece {
    id: number;
    x: number;
    color: string;
    delay: number;
    duration: number;
    size: number;
    rotation: number;
}

interface ConfettiProps {
    show: boolean;
    count?: number;
    colors?: string[];
    duration?: number;
    onComplete?: () => void;
}

const defaultColors = [
    '#FF6B6B', // coral
    '#4ECDC4', // mint
    '#FFE66D', // yellow
    '#A78BFA', // lavender
    '#F472B6', // pink
    '#34D399', // emerald
];

const helloKittyColors = [
    '#FF69B4', // hot pink
    '#FFB6C1', // light pink
    '#FF1493', // deep pink
    '#FFC0CB', // pink
    '#FF85B3', // medium pink
    '#FFD1DC', // pale pink
];

export default function Confetti({
    show,
    count = 50,
    colors,
    duration = 2000,
    onComplete,
}: ConfettiProps) {
    const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (show) {
            setVisible(true);
            const usedColors = colors || defaultColors;

            const newPieces: ConfettiPiece[] = Array.from({ length: count }, (_, i) => ({
                id: i,
                x: Math.random() * 100,
                color: usedColors[Math.floor(Math.random() * usedColors.length)],
                delay: Math.random() * 0.5,
                duration: 1 + Math.random() * 1.5,
                size: 6 + Math.random() * 8,
                rotation: Math.random() * 360,
            }));

            setPieces(newPieces);

            const timer = setTimeout(() => {
                setVisible(false);
                setPieces([]);
                onComplete?.();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [show, count, colors, duration, onComplete]);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
            {pieces.map((piece) => (
                <div
                    key={piece.id}
                    className="absolute"
                    style={{
                        left: `${piece.x}%`,
                        top: '-20px',
                        width: `${piece.size}px`,
                        height: `${piece.size}px`,
                        backgroundColor: piece.color,
                        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                        transform: `rotate(${piece.rotation}deg)`,
                        animation: `confetti-fall ${piece.duration}s ease-out forwards`,
                        animationDelay: `${piece.delay}s`,
                    }}
                />
            ))}
        </div>
    );
}

export { helloKittyColors, defaultColors };
