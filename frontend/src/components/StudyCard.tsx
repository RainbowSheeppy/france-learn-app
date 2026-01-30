
import React, { useState, useEffect, useRef } from 'react';
import { StudyFlashcard } from '../types/study';
import { normalizeForComparison } from '@/lib/utils';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore } from '@/store/languageStore';

interface StudyCardProps {
    fiszka: StudyFlashcard;
    onResult: (correct: boolean) => void;
    onSkip: () => void;
}

export const StudyCard: React.FC<StudyCardProps> = ({ fiszka, onResult, onSkip }) => {
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<'typing' | 'correct' | 'wrong'>('typing');
    const [isShaking, setIsShaking] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const theme = useThemeStore((state) => state.theme);
    const { activeLanguage } = useLanguageStore();
    const isHK = theme === 'hellokitty';
    const isDark = theme === 'dark';
    const langName = activeLanguage === 'fr' ? 'francuski' : 'angielski';

    useEffect(() => {
        setInput('');
        setStatus('typing');
        setIsShaking(false);
        inputRef.current?.focus();
    }, [fiszka.id]);

    const checkAnswer = () => {
        if (!input.trim()) return;

        const isCorrect = normalizeForComparison(input) === normalizeForComparison(fiszka.text_fr);
        setStatus(isCorrect ? 'correct' : 'wrong');

        if (isCorrect) {
            // Auto-advance after delay
            setTimeout(() => {
                onResult(true);
            }, 1200);
        } else {
            // Shake animation for wrong answer
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 600);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (status === 'typing') {
                checkAnswer();
            } else if (status === 'wrong') {
                // If already wrong, Enter can allow retry or just move on? 
                // Currently request implies if wrong -> nothing changes (in DB)
                // Assuming we want to proceed to next card after user acknowledges mistake? 
                // Or let them retry? User request: "Jeżeli użytkownik źle odpowie... nic się nie zmienia".
                // Let's assume we proceed to next item after a delay or manual click? 
                // Or maybe Enter just resets to try again? 
                // Or Enter proceeds? 
                // Let's implement: Enter -> Check. If Wrong -> Shake/Show error. 
                // Maybe wait for user to fix it or skip?
                // The requirements say: "Jeżeli użytkownik źle odpowie na daną fiszkę lub ją pominie to nic się nie zmienia."
                // "Po przejściu wszystkich fiszek..."
                // So if wrong, we should eventually mark it as wrong result and move on.
                // Let's allow one attempt? Or multiple?
                // Usually flashcards allow retrying until correct or revealed.
                // But for "Test/Study" mode, usually it's one shot.
                // I'll assume one shot for statistics. 
                // So if wrong -> user sees correct answer -> clicks Next.
                // But I'll wait for user input to move on if wrong.
                onResult(false);
            }
        }
    };

    // Theme-based colors
    const cardBg = isHK ? 'bg-white border-[hsl(350,80%,88%)]' : isDark ? 'bg-[hsl(220,30%,18%)] border-[hsl(220,30%,25%)]' : 'bg-white border-gray-100';
    const imageBg = isHK ? 'bg-[hsl(350,100%,97%)]' : isDark ? 'bg-[hsl(220,30%,15%)]' : 'bg-gray-50';
    const textPrimary = isHK ? 'text-[hsl(350,50%,35%)]' : isDark ? 'text-white' : 'text-gray-800';
    const textMuted = isHK ? 'text-[hsl(350,30%,55%)]' : isDark ? 'text-gray-400' : 'text-gray-400';

    const inputBaseClass = isHK
        ? 'border-[hsl(350,70%,85%)] focus:border-[hsl(350,80%,65%)] focus:ring-[hsl(350,80%,65%)]/20'
        : isDark
            ? 'border-[hsl(220,30%,30%)] focus:border-[hsl(16,90%,60%)] focus:ring-[hsl(16,90%,60%)]/20 bg-[hsl(220,30%,15%)] text-white'
            : 'border-gray-200 focus:border-[hsl(16,90%,60%)] focus:ring-[hsl(16,90%,60%)]/10';

    const correctOverlay = isHK ? 'bg-[hsl(350,80%,70%)]/20' : 'bg-green-500/20';
    const wrongOverlay = isHK ? 'bg-[hsl(0,70%,70%)]/20' : 'bg-red-500/20';

    const btnPrimary = isHK
        ? 'bg-gradient-to-r from-[hsl(350,90%,75%)] to-[hsl(330,85%,70%)] hover:from-[hsl(350,90%,70%)] hover:to-[hsl(330,85%,65%)] shadow-[hsl(350,80%,70%)]/30'
        : 'bg-gradient-to-r from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)] hover:from-[hsl(16,90%,55%)] hover:to-[hsl(350,80%,60%)] shadow-[hsl(16,90%,60%)]/30';

    return (
        <div className={`max-w-md mx-auto rounded-2xl shadow-xl overflow-hidden border-2 transition-all duration-300 ${cardBg} ${isShaking ? 'animate-shake' : ''}`}>
            {/* Image Area */}
            <div className={`h-64 flex items-center justify-center relative overflow-hidden ${imageBg}`}>
                {fiszka.image_url ? (
                    <img
                        src={fiszka.image_url}
                        alt="Flashcard"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className={`text-6xl ${isHK ? 'opacity-50' : 'text-gray-300'}`}>
                        {isHK ? '🌸' : '🖼️'}
                    </span>
                )}

                {/* Status Overlay */}
                {status === 'correct' && (
                    <div className={`absolute inset-0 ${correctOverlay} flex items-center justify-center backdrop-blur-sm animate-fade-in`}>
                        <div className="bg-white p-4 rounded-full shadow-lg animate-scale-pop">
                            <span className="text-4xl">{isHK ? '💖' : '✅'}</span>
                        </div>
                    </div>
                )}
                {status === 'wrong' && (
                    <div className={`absolute inset-0 ${wrongOverlay} flex items-center justify-center backdrop-blur-sm animate-fade-in`}>
                        <div className="bg-white p-4 rounded-full shadow-lg animate-scale-pop">
                            <span className="text-4xl">{isHK ? '💔' : '❌'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="p-6 space-y-6">
                <div className="text-center">
                    <h3 className={`text-2xl font-bold ${textPrimary}`}>{fiszka.text_pl}</h3>
                    <p className={`text-sm mt-1 ${textMuted}`}>
                        {isHK ? `✨ Przetłumacz na ${langName} ✨` : `Przetłumacz na ${langName}`}
                    </p>
                </div>

                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={status === 'correct'}
                        className={`
                            w-full text-center text-xl p-4 rounded-xl border-2 transition-all duration-300 outline-none
                            ${status === 'typing' ? `${inputBaseClass} focus:ring-4` : ''}
                            ${status === 'correct' ? `border-emerald-400 ${isHK ? 'bg-[hsl(350,100%,97%)]' : isDark ? 'bg-emerald-900/20' : 'bg-emerald-50'} text-emerald-600 animate-pulse-grow` : ''}
                            ${status === 'wrong' ? `border-red-300 ${isHK ? 'bg-red-50' : isDark ? 'bg-red-900/20' : 'bg-red-50'} text-red-600` : ''}
                        `}
                        placeholder={isHK ? '✏️ Wpisz odpowiedź...' : 'Wpisz odpowiedź...'}
                        autoComplete="off"
                    />

                    {status === 'correct' && (
                        <div className="mt-4 text-center animate-slide-up">
                            <p className={`text-sm mb-1 ${textMuted}`}>Poprawna pisownia:</p>
                            <p className="text-lg font-bold text-emerald-600">{fiszka.text_fr}</p>
                        </div>
                    )}

                    {status === 'wrong' && (
                        <div className="mt-4 text-center animate-slide-up">
                            <p className={`text-sm mb-1 ${textMuted}`}>Poprawna odpowiedź:</p>
                            <p className="text-lg font-bold text-red-600">{fiszka.text_fr}</p>
                            <button
                                onClick={() => onResult(false)}
                                className={`mt-4 py-2 px-6 rounded-full text-sm font-medium transition-all duration-300 ${isHK
                                    ? 'bg-[hsl(350,80%,90%)] text-[hsl(350,60%,45%)] hover:bg-[hsl(350,80%,85%)]'
                                    : isDark
                                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                Dalej →
                            </button>
                        </div>
                    )}
                </div>

                {status === 'typing' && (
                    <div className="flex gap-3">
                        <button
                            onClick={onSkip}
                            className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium transition-all duration-300 hover:-translate-y-0.5 ${isHK
                                ? 'border-[hsl(350,70%,85%)] text-[hsl(350,50%,50%)] hover:bg-[hsl(350,100%,97%)]'
                                : isDark
                                    ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            Pomiń
                        </button>
                        <button
                            onClick={checkAnswer}
                            disabled={!input.trim()}
                            className={`flex-1 py-3 px-4 rounded-xl text-white font-semibold shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 ${btnPrimary}`}
                        >
                            {isHK ? '✨ Sprawdź' : 'Sprawdź'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
