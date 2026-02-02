import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Flame, Zap, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

interface GamifiedStatusWidgetProps {
    points: number;
    currentStreak: number;
}

export const GamifiedStatusWidget: React.FC<GamifiedStatusWidgetProps> = ({ points, currentStreak }) => {
    const [prevPoints, setPrevPoints] = useState(points);

    useEffect(() => {
        if (points !== prevPoints) {
            // Wait a moment before updating prevPoints to let animation play if we want specific logic, 
            // but for simple key-based animation, just updating state is enough trigger.
            // Actually, to show delta we need to keep prevPoints for a partial render?
            // No, the delta is calculated from props vs state.
            // We update state *after* a small delay or just let the render cycle handle it?
            // If we update prevPoints immediately, delta becomes 0.

            const timer = setTimeout(() => {
                setPrevPoints(points);
            }, 2000); // Keep the delta visible for 2 seconds
            return () => clearTimeout(timer);
        }
    }, [points]);

    // Calculate delta based on the prop vs the "acknowledged" state
    const displayDelta = points - prevPoints;

    // Multiplier logic
    let multiplier = 1.0;
    if (currentStreak >= 10) multiplier = 2.0;
    else if (currentStreak >= 5) multiplier = 1.5;
    else if (currentStreak >= 2) multiplier = 1.2;

    const isFire = currentStreak >= 5;
    const isLightning = currentStreak >= 10;

    return (
        <div className="flex items-center gap-3">
            {/* Points Badge */}
            <div className="relative flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1.5 rounded-full border border-yellow-200 dark:border-yellow-700 shadow-sm overflow-visible">
                <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="font-bold text-sm text-yellow-800 dark:text-yellow-200 font-mono min-w-[30px] text-right tabular-nums">
                    {points}
                </span>

                {/* Floating Delta Animation */}
                <AnimatePresence>
                    {displayDelta !== 0 && (
                        <motion.span
                            key={`delta-${prevPoints}-${points}`}
                            initial={{ opacity: 0, y: 10, scale: 0.5, x: 0 }}
                            animate={{ opacity: 1, y: -25, scale: 1.2, x: 10 }}
                            exit={{ opacity: 0, y: -35 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className={cn(
                                "absolute -right-2 top-0 font-black text-sm pointer-events-none z-50 shadow-sm",
                                displayDelta > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                            )}
                        >
                            {displayDelta > 0 ? "+" : ""}{displayDelta}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* Streak / Multiplier Badge */}
            <AnimatePresence mode='wait'>
                {currentStreak > 1 && (
                    <motion.div
                        key="streak-badge"
                        initial={{ scale: 0.8, opacity: 0, width: 0 }}
                        animate={{ scale: 1, opacity: 1, width: 'auto' }}
                        exit={{ scale: 0.0, opacity: 0, width: 0 }}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm font-bold text-xs transition-colors overflow-hidden whitespace-nowrap",
                            isLightning ? "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
                                isFire ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                                    "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
                        )}
                    >
                        {isLightning ? <Zap className="w-3 h-3 fill-current animate-pulse" /> :
                            isFire ? <Flame className="w-3 h-3 fill-current animate-bounce" /> :
                                <Star className="w-3 h-3 fill-current" />}

                        <span>x{multiplier.toFixed(1)}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
