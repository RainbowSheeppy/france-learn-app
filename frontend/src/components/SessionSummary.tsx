import React from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, RotateCcw, TrendingUp, TrendingDown, Star, Sparkles } from 'lucide-react';
import { StudySessionStats } from '@/types/study';
import { useThemeStore } from '@/store/themeStore';
import SuccessCelebration from '@/components/SuccessCelebration';

interface PointsDetails {
    gained: number;
    lost: number;
    wordle: number;
    aiCorrected?: number; // New: points from AI corrections
}

interface SessionSummaryProps {
    stats: StudySessionStats;
    sessionPoints: number;
    pointsDetails: PointsDetails;
    maxSessionCombo: number;
    mistakesCount: number;
    onRepeatMistakes?: () => void;
    onContinue: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({
    stats,
    sessionPoints,
    pointsDetails,
    maxSessionCombo,
    mistakesCount,
    onRepeatMistakes,
    onContinue
}) => {
    const theme = useThemeStore((state) => state.theme);
    const isHK = theme === 'hellokitty';
    const isDark = theme === 'dark';

    const duration = (stats.endTime || Date.now()) - stats.startTime;
    const total = stats.correct + stats.wrong + stats.skipped;
    const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 0;

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Colors
    const colors = {
        bg: isHK ? 'bg-pink-50' : isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100',
        cardBorder: isHK ? 'border-pink-200' : isDark ? 'border-gray-800' : 'border-gray-200',
        text: isHK ? 'text-pink-900' : isDark ? 'text-white' : 'text-gray-900',
        textMuted: isHK ? 'text-pink-600' : isDark ? 'text-gray-400' : 'text-gray-500',
    };

    return (
        <div className={`min-h-[85vh] flex items-center justify-center p-4 animate-fade-in`}>
            <SuccessCelebration show={true} type="session-complete" theme={isHK ? 'hellokitty' : 'default'} />

            <div className={`w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border ${colors.cardBorder} ${colors.bg}`}>

                {/* Header Part with Gradient */}
                <div className={`relative p-8 text-center ${isHK ? 'bg-pink-100/50' : isDark ? 'bg-gray-800' : 'bg-orange-50/50'}`}>
                    <h2 className={`text-3xl font-black mb-1 ${colors.text}`}>Podsumowanie Sesji</h2>
                    <p className={`text-sm font-medium ${colors.textMuted}`}>Wyniki Twojej nauki</p>
                </div>

                <div className="p-8">
                    {/* Main Stats Row */}
                    <div className="flex justify-center gap-6 sm:gap-10 mb-10 flex-wrap">
                        {/* Total Points */}
                        <div className="text-center relative">
                            <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center border-8 shadow-xl mb-3 mx-auto
                                ${isHK ? 'bg-pink-100 border-pink-300' : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400'}
                            `}>
                                <div>
                                    <div className="text-[10px] sm:text-xs text-yellow-600 dark:text-yellow-400 font-bold uppercase tracking-wider mb-0.5">Wynik</div>
                                    <div className="text-3xl sm:text-4xl font-black text-yellow-600 dark:text-yellow-400">{sessionPoints > 0 ? '+' : ''}{sessionPoints}</div>
                                </div>
                            </div>
                            <div className={`text-xs font-bold uppercase tracking-widest ${colors.textMuted}`}>Punkty XP</div>
                        </div>

                        {/* Accuracy */}
                        <div className="text-center relative">
                            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border-4 shadow-lg mb-3 mx-auto mt-4
                                 ${isHK ? 'bg-pink-50 border-pink-200' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300'}
                            `}>
                                <div>
                                    <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{accuracy}%</div>
                                </div>
                            </div>
                            <div className={`text-xs font-bold uppercase tracking-widest ${colors.textMuted}`}>Trafność</div>
                        </div>

                        {/* Time */}
                        <div className="text-center relative">
                            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center border-4 shadow-lg mb-3 mx-auto mt-4
                                 ${isHK ? 'bg-pink-50 border-pink-200' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-300'}
                            `}>
                                <div>
                                    <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{formatTime(duration)}</div>
                                </div>
                            </div>
                            <div className={`text-xs font-bold uppercase tracking-widest ${colors.textMuted}`}>Czas</div>
                        </div>
                    </div>

                    {/* Detailed Score Breakdown */}
                    <div className={`rounded-xl p-5 mb-8 border ${isHK ? 'bg-pink-50/50 border-pink-100' : 'bg-gray-50/50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'}`}>
                        <h3 className={`text-sm font-bold uppercase tracking-wide mb-4 ${colors.textMuted}`}>Szczegóły Punktacji</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                    <span className={isDark ? "text-gray-300" : "text-gray-600"}>Zdobyte (fiszki + combo)</span>
                                </div>
                                <span className="font-bold text-green-500">+{pointsDetails.gained}</span>
                            </div>
                            {pointsDetails.wordle > 0 && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Star className="w-4 h-4 text-yellow-500" />
                                        <span className={isDark ? "text-gray-300" : "text-gray-600"}>Bonus Wordle</span>
                                    </div>
                                    <span className="font-bold text-yellow-500">+{pointsDetails.wordle}</span>
                                </div>
                            )}
                            {pointsDetails.aiCorrected && pointsDetails.aiCorrected > 0 ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-indigo-500" />
                                        <span className={isDark ? "text-gray-300" : "text-gray-600"}>Uratowane przez AI</span>
                                    </div>
                                    <span className="font-bold text-indigo-500">+{pointsDetails.aiCorrected}</span>
                                </div>
                            ) : null}
                            {pointsDetails.lost > 0 && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <TrendingDown className="w-4 h-4 text-red-500" />
                                        <span className={isDark ? "text-gray-300" : "text-gray-600"}>Pomyłki</span>
                                    </div>
                                    <span className="font-bold text-red-500">-{pointsDetails.lost}</span>
                                </div>
                            )}
                            <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-orange-500" />
                                    <span className={isDark ? "text-gray-300" : "text-gray-600"}>Najwyższe Combo</span>
                                </div>
                                <span className="font-bold text-orange-500">{maxSessionCombo}x</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        {mistakesCount > 0 && onRepeatMistakes && (
                            <Button onClick={onRepeatMistakes} variant="outline" className="w-full py-6 text-lg border-2 hover:bg-gray-50 dark:hover:bg-gray-800" size="lg">
                                <RotateCcw className="w-5 h-5 mr-2" /> Powtórz błędne ({mistakesCount})
                            </Button>
                        )}
                        <Button onClick={onContinue} className={`w-full py-6 text-lg font-bold shadow-lg transition-transform hover:-translate-y-1 active:translate-y-0 bg-gradient-to-r from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)] text-white`} size="lg">
                            Powrót do menu
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
