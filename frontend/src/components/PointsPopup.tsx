import { useEffect, useState } from 'react';

interface PointsPopupProps {
    points: number;
    show: boolean;
    position?: { x: number; y: number };
    onComplete?: () => void;
}

export default function PointsPopup({ points, show, position, onComplete }: PointsPopupProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (show && points !== 0) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                onComplete?.();
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [show, points, onComplete]);

    if (!visible) return null;

    const isPositive = points > 0;
    const displayPoints = isPositive ? `+${points}` : `${points}`;

    return (
        <div
            className="fixed pointer-events-none z-50 animate-points-popup"
            style={{
                left: position?.x ?? '50%',
                top: position?.y ?? '40%',
                transform: 'translate(-50%, -50%)',
            }}
        >
            <div
                className={`
                    text-4xl font-black tracking-tight
                    ${isPositive ? 'text-emerald-500' : 'text-red-500'}
                    drop-shadow-lg
                `}
                style={{
                    textShadow: isPositive
                        ? '0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.3)'
                        : '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.3)',
                }}
            >
                {displayPoints}
                {isPositive && <span className="ml-1 text-2xl">XP</span>}
            </div>
        </div>
    );
}
