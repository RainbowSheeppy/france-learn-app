import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { StudyGroup, StudyFlashcard, StudySessionStats } from '@/types/study';
import { StudyGroupSelector } from '@/components/StudyGroupSelector';
import { StudyCard } from '@/components/StudyCard';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { Button } from '@/components/ui/button';
import { Pencil, ArrowLeft } from 'lucide-react';
import SuccessCelebration from '@/components/SuccessCelebration';
import { gamificationApi, wordleApi } from '@/lib/api';
import { useGamificationStore } from '@/store/useGamificationStore';
import { WordleModal } from '@/components/WordleModal';
import { SessionSummary } from '@/components/SessionSummary';

const StudyPage: React.FC = () => {
    const user = useAuthStore((state) => state.user);
    const theme = useThemeStore((state) => state.theme);
    const isAdmin = user?.is_superuser;
    const isHK = theme === 'hellokitty';
    const isDark = theme === 'dark';

    const [mode, setMode] = useState<'selection' | 'loading' | 'learning' | 'summary'>('selection');
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [fiszki, setFiszki] = useState<StudyFlashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [stats, setStats] = useState<StudySessionStats>({ correct: 0, wrong: 0, skipped: 0, startTime: Date.now() });
    const [mistakes, setMistakes] = useState<StudyFlashcard[]>([]);
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationType, setCelebrationType] = useState<'correct' | 'session-complete'>('correct');

    // Gamification state
    const { updateStats } = useGamificationStore();
    const [sessionPoints, setSessionPoints] = useState(0); // Net points
    const [pointsDetails, setPointsDetails] = useState({ gained: 0, lost: 0, wordle: 0 });
    const [maxSessionCombo, setMaxSessionCombo] = useState(0);

    const [showWordle, setShowWordle] = useState(false);
    const [wordleTarget, setWordleTarget] = useState("");

    // Theme-aware colors
    const colors = {
        bg: isHK ? 'hk-bg theme-hellokitty' : isDark ? 'bg-[hsl(220,40%,8%)]' : '',
        text: isHK ? 'hk-title' : isDark ? 'text-white' : 'text-[hsl(220,40%,13%)]',
        textMuted: isHK ? 'hk-text-muted' : isDark ? 'text-[hsl(220,20%,65%)]' : 'text-[hsl(220,20%,45%)]',
        progress: isHK ? 'hk-progress' : isDark ? 'bg-[hsl(220,30%,20%)]' : 'bg-[hsl(45,20%,90%)]',
        progressBar: isHK ? 'hk-progress-bar' : 'bg-gradient-to-r from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)]',
    };

    const fetchGroups = async () => {
        try {
            const response = await api.get<StudyGroup[]>('/study/groups');
            setGroups(response.data);
        } catch (err) {
            console.error("Failed to fetch groups", err);
        }
    };

    useEffect(() => {
        if (mode === 'selection') fetchGroups();
    }, [mode]);

    const handleStart = async (groupIds: string[], includeLearned: boolean) => {
        setMode('loading');
        setStats({ correct: 0, wrong: 0, skipped: 0, startTime: Date.now() });
        setMistakes([]);
        setSessionPoints(0);
        setPointsDetails({ gained: 0, lost: 0, wordle: 0 });
        setMaxSessionCombo(0);

        try {
            const response = await api.post<StudyFlashcard[]>('/study/fiszki', {
                group_ids: groupIds,
                include_learned: includeLearned,
                limit: 50
            });
            setFiszki(response.data);
            setCurrentIndex(0);
            setMode('learning');
        } catch (err) {
            console.error("Failed to start session", err);
            setMode('selection');
        }
    };

    const handleCardResult = async (correct: boolean) => {
        const currentCard = fiszki[currentIndex];
        setStats(prev => ({
            ...prev,
            correct: prev.correct + (correct ? 1 : 0),
            wrong: prev.wrong + (correct ? 0 : 1)
        }));

        if (!correct) {
            setMistakes(prev => [...prev, currentCard]);
            try {
                await api.post('/study/progress', { fiszka_id: currentCard.id, learned: false });
            } catch (e) { console.error(e); }
        } else {
            setCelebrationType('correct');
            setShowCelebration(true);
            setTimeout(() => setShowCelebration(false), 1000);
            try {
                await api.post('/study/progress', { fiszka_id: currentCard.id, learned: true });
            } catch (e) { console.error(e); }
        }

        // Gamification Score Call
        try {
            const scoreRes = await gamificationApi.submitScore({
                is_correct: correct,
                is_known: false,
                item_id: currentCard.id,
                level: 'A1'
            });

            updateStats(scoreRes.new_total_points, scoreRes.new_combo);
            setSessionPoints(prev => prev + scoreRes.points_delta);

            // Track details
            if (scoreRes.points_delta > 0) {
                setPointsDetails(prev => ({ ...prev, gained: prev.gained + scoreRes.points_delta }));
            } else {
                setPointsDetails(prev => ({ ...prev, lost: prev.lost + Math.abs(scoreRes.points_delta) }));
            }

            // Check combo on response or local tracking? 
            // The API returns the *new* combo after this action.
            if (scoreRes.new_combo > maxSessionCombo) {
                setMaxSessionCombo(scoreRes.new_combo);
            }
            // Ensure we capture if it was 0 and now >0
            setMaxSessionCombo(prev => Math.max(prev, scoreRes.new_combo));

            if (scoreRes.trigger_mini_game) {
                const wordleData = await wordleApi.start();
                setWordleTarget(wordleData.target_word);
                setShowWordle(true);
                return; // Pausing flow to show modal
            }
        } catch (e) { console.error("Score error", e); }

        handleNext();
    };

    const handleWordleComplete = (success: boolean) => {
        if (success) {
            const bonus = 100;
            updateStats(useGamificationStore.getState().points + bonus, useGamificationStore.getState().currentStreak);
            setSessionPoints(prev => prev + bonus);
            setPointsDetails(prev => ({ ...prev, wordle: prev.wordle + bonus }));
        }
        setShowWordle(false);
        handleNext();
    };

    const handleSkip = () => {
        setStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
        handleNext();
    };

    const handleNext = () => {
        if (currentIndex < fiszki.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            finishSession();
        }
    };

    const finishSession = () => {
        setStats(prev => ({ ...prev, endTime: Date.now() }));
        setCelebrationType('session-complete');
        setShowCelebration(true);
        setMode('summary');
    };

    const handleRepeatMistakes = () => {
        if (mistakes.length === 0) return;
        setFiszki(mistakes);
        setMistakes([]);
        setStats({ correct: 0, wrong: 0, skipped: 0, startTime: Date.now() });
        setCurrentIndex(0);
        setMode('learning');
    };

    if (mode === 'loading') {
        return (
            <div className={`min-h-[60vh] flex items-center justify-center ${colors.bg}`}>
                <div className="text-center space-y-4">
                    <div className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto ${isHK ? 'border-[hsl(350,90%,70%)]' : 'border-[hsl(16,90%,60%)]'}`} />
                    <p className={`font-medium ${colors.textMuted}`}>Ładowanie fiszek...</p>
                </div>
            </div>
        );
    }

    if (mode === 'selection') {
        return (
            <div className={`max-w-4xl mx-auto animate-fade-in ${colors.bg}`}>
                <Button variant="ghost" className={`mb-6 ${colors.textMuted}`} onClick={() => window.location.href = '/student/dashboard'}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Wróć do Dashboard
                </Button>
                <div className="text-center mb-8">
                    <h1 className={`text-4xl font-bold mb-2 ${colors.text}`}>Fiszki</h1>
                    <p className={colors.textMuted}>Wybierz grupy do nauki</p>
                </div>
                <StudyGroupSelector groups={groups} onStart={handleStart} isLoading={false} />
            </div>
        );
    }

    if (mode === 'summary') {
        return (
            <SessionSummary
                stats={stats}
                sessionPoints={sessionPoints}
                pointsDetails={pointsDetails}
                maxSessionCombo={maxSessionCombo}
                mistakesCount={mistakes.length}
                onRepeatMistakes={handleRepeatMistakes}
                onContinue={() => setMode('selection')}
            />
        );
    }

    const progress = ((currentIndex + 1) / fiszki.length) * 100;

    return (
        <div className={`min-h-[80vh] pt-4 pb-12 px-4 animate-fade-in ${colors.bg}`}>
            <SuccessCelebration show={showCelebration} type={celebrationType} theme={isHK ? 'hellokitty' : 'default'} />

            {/* Header */}
            <div className="max-w-lg mx-auto mb-6">
                <div className="flex items-center justify-between mb-4">
                    <span className={`text-sm font-medium ${colors.textMuted}`}>
                        Fiszka {currentIndex + 1} / {fiszki.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isHK ? 'text-[hsl(350,70%,60%)]' : 'text-[hsl(160,50%,45%)]'}`}>
                            {isHK ? '💖' : '✓'} {stats.correct}
                        </span>
                        {isAdmin && (
                            <Button variant="ghost" size="sm" onClick={() => window.location.href = '/admin/fiszki'}>
                                <Pencil className="w-4 h-4 mr-1" /> Edytuj
                            </Button>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className={`w-full h-2 rounded-full overflow-hidden ${colors.progress}`}>
                    <div className={`h-full transition-all duration-500 ${colors.progressBar}`} style={{ width: `${progress}%` }} />
                </div>
            </div>

            <StudyCard fiszka={fiszki[currentIndex]} onResult={handleCardResult} onSkip={handleSkip} />

            <WordleModal
                isOpen={showWordle}
                onClose={() => setShowWordle(false)}
                onComplete={handleWordleComplete}
                checkWord={async (guess) => {
                    const res = await wordleApi.check(wordleTarget, guess);
                    return res.result;
                }}
            />
        </div>
    );
};

export default StudyPage;
