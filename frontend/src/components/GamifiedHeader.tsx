import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Flame, Zap, Trophy } from 'lucide-react';
import { cn } from '../lib/utils'; // Assuming generic utility exists, or I will use tailwind-merge directly if not found.

// Simple props interface
interface GamifiedHeaderProps {
    points: number;
    combo: number;
    multiplier: number;
}

export const GamifiedHeader: React.FC<GamifiedHeaderProps> = ({
    points,
    combo,
    multiplier,
}) => {
    const [prevPoints, setPrevPoints] = useState(points);
    const delta = points - prevPoints;

    useEffect(() => {
        setPrevPoints(points);
    }, [points]);

    const isFire = combo >= 5;
    const isLightning = combo >= 10;

    return (
        <div className="w-full flex items-center justify-between px-4 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-colors duration-300">
            {/* Points Section */}
            <div className="flex items-center gap-3">
                <div className="relative flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1.5 rounded-full border border-yellow-200 dark:border-yellow-700 shadow-inner">
                    <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <span className="font-bold text-lg text-yellow-800 dark:text-yellow-200 font-mono min-w-[60px] text-right">
                        {points}
                    </span>

                    {/* Floating Delta Animation */}
                    <AnimatePresence>
                        {delta !== 0 && (
                            <motion.span
                                key={Date.now()} // Force re-render for rapid changes
                                initial={{ opacity: 0, y: 10, scale: 0.5 }}
                                animate={{ opacity: 1, y: -20, scale: 1.2 }}
                                exit={{ opacity: 0, y: -30 }}
                                className={cn(
                                    "absolute -right-8 top-0 font-bold text-lg pointer-events-none",
                                    delta > 0 ? "text-green-500" : "text-red-500"
                                )}
                            >
                                {delta > 0 ? "+" : ""}{delta}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Streak / Combo Section */}
            <div className="flex items-center gap-4">
                <AnimatePresence mode='wait'>
                    {combo > 1 && (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className={cn(
                                "flex items-center gap-2 px-4 py-1.5 rounded-full border shadow-lg font-bold text-lg transition-colors",
                                isLightning ? "bg-purple-100 border-purple-300 text-purple-700" :
                                    isFire ? "bg-orange-100 border-orange-300 text-orange-700" :
                                        "bg-blue-50 border-blue-200 text-blue-600"
                            )}
                        >
                            {isLightning ? <Zap className="w-5 h-5 fill-current animate-pulse" /> :
                                isFire ? <Flame className="w-5 h-5 fill-current animate-bounce" /> :
                                    <Star className="w-5 h-5 fill-current" />}

                            <span>x{multiplier.toFixed(1)}</span>
                            <span className="text-sm font-normal opacity-80 ml-1">COMBO {combo}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Optional: Simple Level indicator or similar could go here */}
        </div>
    );
};
