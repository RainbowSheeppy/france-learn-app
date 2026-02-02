import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

interface WordleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (success: boolean) => void;
    checkWord: (guess: string) => Promise<string[]>; // Returns array of statuses: 'correct', 'present', 'absent'
    targetWordLength?: number;
}

export const WordleModal: React.FC<WordleModalProps> = ({
    isOpen,
    onClose,
    onComplete,
    checkWord,
    targetWordLength = 5
}) => {
    const [attempts, setAttempts] = useState<string[]>([]);
    const [currentGuess, setCurrentGuess] = useState("");
    const [results, setResults] = useState<string[][]>([]); // History of color results
    const [gameOver, setGameOver] = useState(false);
    const [won, setWon] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset state
            setAttempts([]);
            setCurrentGuess("");
            setResults([]);
            setGameOver(false);
            setWon(false);
            setLoading(false);
        }
    }, [isOpen]);

    const handleType = (char: string) => {
        if (gameOver || loading) return;
        if (char === 'BACKSPACE') {
            setCurrentGuess(prev => prev.slice(0, -1));
        } else if (char === 'ENTER') {
            if (currentGuess.length === targetWordLength) {
                submitGuess();
            }
        } else if (currentGuess.length < targetWordLength && /^[a-zA-Z]$/.test(char)) {
            setCurrentGuess(prev => prev + char.toUpperCase());
        }
    };

    // Keyboard listener
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Backspace') handleType('BACKSPACE');
            else if (e.key === 'Enter') handleType('ENTER');
            else if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) handleType(e.key);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentGuess, gameOver, loading]);

    const submitGuess = async () => {
        setLoading(true);
        try {
            const res = await checkWord(currentGuess);
            setResults(prev => [...prev, res]);
            setAttempts(prev => [...prev, currentGuess]);

            const isCorrect = res.every(r => r === 'correct');

            if (isCorrect) {
                setWon(true);
                setGameOver(true);
                setTimeout(() => onComplete(true), 2000);
            } else if (attempts.length + 1 >= 6) {
                setGameOver(true);
                setTimeout(() => onComplete(false), 2000);
            } else {
                setCurrentGuess("");
            }
        } catch (e) {
            console.error("Wordle check failed", e);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-200 dark:border-gray-700 flex flex-col gap-6"
            >
                {/* Header */}
                <div className="flex justify-between items-center border-b pb-4 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">🎁</span>
                        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">
                            Bonus Round!
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Grid */}
                <div className="flex flex-col gap-2 items-center justify-center py-4">
                    {[...Array(6)].map((_, rowIndex) => {
                        const isCurrent = rowIndex === attempts.length;
                        const guess = isCurrent ? currentGuess : (attempts[rowIndex] || "");
                        const resultRow = results[rowIndex];

                        return (
                            <div key={rowIndex} className="flex gap-2">
                                {[...Array(targetWordLength)].map((_, colIndex) => {
                                    const char = guess[colIndex] || "";
                                    const status = resultRow ? resultRow[colIndex] : null; // correct, present, absent

                                    return (
                                        <div
                                            key={colIndex}
                                            className={cn(
                                                "w-12 h-12 flex items-center justify-center text-2xl font-bold rounded-lg border-2 transition-all duration-300",
                                                // Status Styles
                                                status === 'correct' ? "bg-green-500 border-green-500 text-white" :
                                                    status === 'present' ? "bg-yellow-400 border-yellow-400 text-white" :
                                                        status === 'absent' ? "bg-gray-500 border-gray-500 text-white" :
                                                            // Default / Active input
                                                            isCurrent && char ? "border-gray-800 dark:border-gray-200 animate-pulse bg-gray-50 dark:bg-gray-800" :
                                                                "border-gray-300 dark:border-gray-600 bg-transparent text-gray-700 dark:text-gray-200"
                                            )}
                                        >
                                            {char}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {/* Status Message */}
                <div className="h-8 text-center">
                    {won && <span className="text-green-600 font-bold flex items-center justify-center gap-2"><Trophy className="w-4 h-4" /> Wygrana! +100 pkt</span>}
                    {gameOver && !won && <span className="text-red-500 font-bold">Koniec gry! Spróbuj następnym razem.</span>}
                </div>

                {/* Keyboard (Visual helper - optional, simplified here) */}
                <div className="flex flex-col gap-1 text-xs text-center text-gray-500">
                    <p>Wpisz słowo na klawiaturze i naciśnij ENTER</p>
                </div>
            </motion.div>
        </div>
    );
};
