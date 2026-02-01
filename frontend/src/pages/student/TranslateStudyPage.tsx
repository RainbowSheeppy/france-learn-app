import { useState, useEffect, useRef } from 'react';
import { api, aiApi, gamificationApi, wordleApi, type AIVerifyResponse } from '@/lib/api';
import { StudyGroup, StudySessionStats } from '@/types/study';
import { StudyGroupSelector } from '@/components/StudyGroupSelector';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Bot, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { normalizeForComparison } from '@/lib/utils';
import SuccessCelebration from '@/components/SuccessCelebration';
import { useGamificationStore } from '@/store/useGamificationStore';
import { WordleModal } from '@/components/WordleModal';
import { SessionSummary } from '@/components/SessionSummary';

interface TranslateStudyItem {
    id: string;
    question: string;
    answer: string;
    category?: string | null;
}

interface Props {
    mode: 'pl-fr' | 'fr-pl';
    endpoints: {
        groups: string;
        session: string;
        progress: string;
    };
    titles: {
        page: string;
        instruction: string;
        langSource: string;
        langTarget: string;
    };
    adminEditRoute?: string;
}

export default function TranslateStudyPage({ mode, endpoints, titles, adminEditRoute }: Props) {
    const user = useAuthStore((state) => state.user);
    const theme = useThemeStore((state) => state.theme);
    const isAdmin = user?.is_superuser;
    const isHK = theme === 'hellokitty';
    const isDark = theme === 'dark';

    const [stateMode, setStateMode] = useState<'selection' | 'loading' | 'learning' | 'summary'>('selection');
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [items, setItems] = useState<TranslateStudyItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    // Align stats structure with StudySessionStats for SessionSummary
    const [stats, setStats] = useState<StudySessionStats>({ correct: 0, wrong: 0, skipped: 0, startTime: Date.now() });
    const [mistakes, setMistakes] = useState<TranslateStudyItem[]>([]);

    // UI State
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<'typing' | 'correct' | 'wrong'>('typing');
    const inputRef = useRef<HTMLInputElement>(null);

    // AI
    const [aiVerifying, setAiVerifying] = useState(false);
    const [aiResult, setAiResult] = useState<AIVerifyResponse | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationType, setCelebrationType] = useState<'correct' | 'session-complete'>('correct');

    // Gamification state
    const { updateStats } = useGamificationStore();
    const [sessionPoints, setSessionPoints] = useState(0);
    const [pointsDetails, setPointsDetails] = useState({ gained: 0, lost: 0, wordle: 0, aiCorrected: 0 });
    const [maxSessionCombo, setMaxSessionCombo] = useState(0);
    const [showWordle, setShowWordle] = useState(false);
    const [wordleTarget, setWordleTarget] = useState("");

    useEffect(() => {
        if (stateMode === 'selection') fetchGroups();
    }, [stateMode]);

    useEffect(() => {
        setInput('');
        setStatus('typing');
        setAiResult(null);
        setAiError(null);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, [currentIndex, items]);

    const fetchGroups = async () => {
        try {
            const res = await api.get<StudyGroup[]>(endpoints.groups);
            setGroups(res.data);
        } catch (e) { console.error(e); }
    };

    const handleStart = async (groupIds: string[], includeLearned: boolean) => {
        setStateMode('loading');
        setStats({ correct: 0, wrong: 0, skipped: 0, startTime: Date.now() });
        setSessionPoints(0);
        setPointsDetails({ gained: 0, lost: 0, wordle: 0, aiCorrected: 0 });
        setMaxSessionCombo(0);

        try {
            const res = await api.post(endpoints.session, {
                group_ids: groupIds,
                include_learned: includeLearned,
                limit: 50
            });

            const mapped = res.data.map((item: any) => ({
                id: item.id,
                question: mode === 'pl-fr' ? item.text_pl : item.text_target,
                answer: mode === 'pl-fr' ? item.text_target : item.text_pl,
                category: item.category
            }));

            setItems(mapped);
            setStats({ correct: 0, wrong: 0, skipped: 0, startTime: Date.now() });
            setMistakes([]);
            setCurrentIndex(0);
            setStateMode('learning');
        } catch (e) {
            console.error(e);
            setStateMode('selection');
        }
    };

    const handleGamification = async (correct: boolean, isKnown: boolean = false, isAICorrection: boolean = false) => {
        try {
            const current = items[currentIndex];
            const scoreRes = await gamificationApi.submitScore({
                is_correct: correct,
                is_known: isKnown,
                item_id: current.id,
                level: 'A1' // Should parse from category if possible?
            });

            updateStats(scoreRes.new_total_points, scoreRes.new_combo);
            setSessionPoints(prev => prev + scoreRes.points_delta);

            if (scoreRes.points_delta > 0) {
                setPointsDetails(prev => ({
                    ...prev,
                    gained: prev.gained + scoreRes.points_delta,
                    aiCorrected: isAICorrection ? (prev.aiCorrected || 0) + scoreRes.points_delta : (prev.aiCorrected || 0)
                }));
            } else {
                setPointsDetails(prev => ({ ...prev, lost: prev.lost + Math.abs(scoreRes.points_delta) }));
            }

            setMaxSessionCombo(prev => Math.max(prev, scoreRes.new_combo));

            if (scoreRes.trigger_mini_game) {
                const wordleData = await wordleApi.start();
                setWordleTarget(wordleData.target_word);
                setShowWordle(true);
            }
        } catch (e) {
            console.error("Score error", e);
        }
    };

    const checkAnswer = async () => {
        if (!input.trim()) return;
        const current = items[currentIndex];
        const isCorrect = normalizeForComparison(input) === normalizeForComparison(current.answer);

        setStatus(isCorrect ? 'correct' : 'wrong');

        if (isCorrect) {
            setStats(p => ({ ...p, correct: p.correct + 1 }));
            api.post(endpoints.progress, { item_id: current.id, learned: true }).catch(console.error);
            setCelebrationType('correct');
            setShowCelebration(true);

            await handleGamification(true);

            setTimeout(() => nextCard(), 1200);
        } else {
            setStats(p => ({ ...p, wrong: p.wrong + 1 }));
            setMistakes(p => [...p, current]);
            api.post(endpoints.progress, { item_id: current.id, learned: false }).catch(console.error);

            await handleGamification(false);
        }
    };

    // Called when AI verifies answer as correct
    const handleAICorrect = async () => {
        const current = items[currentIndex];
        // Revert wrong stat and add correct? Or just leave as is but award points?
        // User answered, marked wrong. Then AI says "it's correct".
        // Logic: Remove from mistakes, decrement wrong, increment correct.
        setStats(p => ({ ...p, correct: p.correct + 1, wrong: p.wrong - 1 }));
        setMistakes(p => p.filter(m => m.id !== current.id));
        api.post(endpoints.progress, { item_id: current.id, learned: true }).catch(console.error);

        // Trigger gamification as correct (compensating for the previous penalty? 
        // Previous call did -Penalty. This call does +Points. Net result matches correct answer?
        // Actually if we just call submitScore(true), it will add points and increment combo.
        // Effectively "healing" the combo might clarify, but our simplistic logic just adds on top. 
        // Good enough.)
        await handleGamification(true, false, true);

        setStatus('correct');
        setCelebrationType('correct');
        setShowCelebration(true);
        setTimeout(() => nextCard(), 1200);
    };

    const nextCard = () => {
        setShowCelebration(false);
        if (currentIndex < items.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setStats(prev => ({ ...prev, endTime: Date.now() }));
            setCelebrationType('session-complete');
            setShowCelebration(true);
            setTimeout(() => setStateMode('summary'), 1500);
        }
    };

    const handleWordleComplete = (success: boolean) => {
        if (success) {
            const bonus = 100;
            updateStats(useGamificationStore.getState().points + bonus, useGamificationStore.getState().currentStreak);
            setSessionPoints(prev => prev + bonus);
            setPointsDetails(prev => ({ ...prev, wordle: prev.wordle + bonus }));
        }
        setShowWordle(false);
        // Wordle usually triggers AFTER answer, so we continue flow if any paused?
        // In current implementation, wordle shows but doesn't block background flow unless we pause it.
        // `StudyPage` returned early. Here checkAnswer sets timeout.
        // We might need to handle timeout better if wordle appears.
        // But for translate mode, checkAnswer uses setTimeout to advance. Wordle might appear during that?
        // Let's assume Wordle is non-blocking for now or user just plays it.
    };

    const handleWrongNext = () => nextCard();
    const handleSkip = () => {
        setStats(p => ({ ...p, skipped: p.skipped + 1 }));
        nextCard();
    };

    const handleRepeatMistakes = () => {
        if (mistakes.length === 0) return;
        setItems(mistakes);
        setMistakes([]);
        setStats({ correct: 0, wrong: 0, skipped: 0, startTime: Date.now() });
        setCurrentIndex(0);
        setStateMode('learning');
    };

    // Theme-aware colors
    const colors = {
        bg: isHK ? 'hk-bg' : isDark ? 'bg-[hsl(220,40%,8%)]' : 'bg-[hsl(48,100%,97%)]',
        card: isHK ? 'hk-card' : isDark ? 'bg-[hsl(220,30%,15%)] border-[hsl(220,30%,25%)]' : 'bg-white border-[hsl(45,20%,88%)]',
        text: isHK ? 'hk-title' : isDark ? 'text-white' : 'text-[hsl(220,40%,13%)]',
        textMuted: isHK ? 'hk-text-muted' : isDark ? 'text-[hsl(220,20%,65%)]' : 'text-[hsl(220,20%,45%)]',
        input: isHK ? 'hk-input' : isDark ? 'bg-[hsl(220,30%,12%)] border-[hsl(220,30%,30%)] text-white' : 'border-[hsl(45,20%,85%)]',
        progress: isHK ? 'hk-progress' : isDark ? 'bg-[hsl(220,30%,20%)]' : 'bg-[hsl(45,20%,90%)]',
        progressBar: isHK ? 'hk-progress-bar' : 'bg-gradient-to-r from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)]',
        btn: isHK ? 'hk-btn' : 'bg-gradient-to-r from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)] text-white',
    };

    if (stateMode === 'loading') {
        return (
            <div className={`min-h-[60vh] flex items-center justify-center ${colors.bg}`}>
                <div className="text-center space-y-4">
                    <div className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto ${isHK ? 'border-[hsl(350,90%,70%)]' : 'border-[hsl(16,90%,60%)]'}`} />
                    <p className={`font-medium ${colors.textMuted}`}>Ładowanie...</p>
                </div>
            </div>
        );
    }

    if (stateMode === 'selection') {
        return (
            <div className={`max-w-4xl mx-auto animate-fade-in ${isHK ? 'theme-hellokitty' : ''}`}>
                <Button variant="ghost" className={`mb-6 ${colors.textMuted}`} onClick={() => window.location.href = '/student/dashboard'}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Wróć do Dashboard
                </Button>
                <div className="text-center mb-8">
                    <h1 className={`text-4xl font-bold mb-2 ${colors.text}`}>{titles.page}</h1>
                    <p className={colors.textMuted}>Wybierz grupy do ćwiczeń</p>
                </div>
                <StudyGroupSelector groups={groups} onStart={handleStart} isLoading={false} />
            </div>
        );
    }

    if (stateMode === 'summary') {
        return (
            <div className={isHK ? 'theme-hellokitty' : ''}>
                <SessionSummary
                    stats={stats}
                    sessionPoints={sessionPoints}
                    pointsDetails={pointsDetails}
                    maxSessionCombo={maxSessionCombo}
                    mistakesCount={mistakes.length}
                    onRepeatMistakes={handleRepeatMistakes}
                    onContinue={() => setStateMode('selection')}
                />
            </div>
        );
    }

    const currentItem = items[currentIndex];
    const progress = ((currentIndex + 1) / items.length) * 100;

    return (
        <div className={`min-h-[80vh] pt-4 pb-12 px-4 animate-fade-in ${isHK ? 'theme-hellokitty hk-bg' : ''}`}>
            <SuccessCelebration show={showCelebration} type={celebrationType} theme={isHK ? 'hellokitty' : 'default'} />

            {/* Header */}
            <div className="max-w-lg mx-auto mb-6">
                <div className="flex items-center justify-between mb-4">
                    <span className={`text-sm font-medium ${colors.textMuted}`}>
                        {currentIndex + 1} / {items.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${isHK ? 'text-[hsl(350,70%,60%)]' : 'text-[hsl(160,50%,45%)]'}`}>
                            {isHK ? '💖' : '✓'} {stats.correct}
                        </span>
                        {isAdmin && adminEditRoute && (
                            <Button variant="ghost" size="sm" onClick={() => window.location.href = adminEditRoute}>
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

            {/* Card */}
            <div className={`max-w-lg mx-auto rounded-3xl shadow-xl overflow-hidden border-2 transition-all duration-300 ${status === 'correct' ? (isHK ? 'border-[hsl(350,70%,70%)] shadow-[0_0_30px_-5px_hsl(350,70%,70%,0.3)]' : 'border-[hsl(160,50%,55%)] shadow-[0_0_30px_-5px_hsl(160,50%,55%,0.3)]') :
                status === 'wrong' ? 'border-[hsl(350,80%,65%)]' :
                    colors.card
                }`}>
                {/* Question Section */}
                <div className={`p-8 text-center ${isHK ? 'bg-gradient-to-b from-[hsl(350,100%,97%)] to-white' : isDark ? 'bg-[hsl(220,30%,18%)]' : 'bg-gradient-to-b from-[hsl(48,100%,98%)] to-white'}`}>
                    <p className={`text-xs font-medium uppercase tracking-wider mb-3 ${colors.textMuted}`}>
                        {titles.langSource}
                    </p>
                    <h3 className={`text-2xl md:text-3xl font-bold leading-relaxed ${colors.text}`}>
                        {currentItem.question}
                    </h3>
                    {currentItem.category && (
                        <span className={`inline-block mt-4 px-3 py-1 text-xs font-medium rounded-full ${isHK ? 'bg-[hsl(350,80%,92%)] text-[hsl(350,50%,45%)]' : 'bg-[hsl(260,60%,95%)] text-[hsl(260,50%,45%)]'}`}>
                            {currentItem.category}
                        </span>
                    )}
                </div>

                {/* Answer Section */}
                <div className={`p-8 space-y-6 ${isDark ? 'bg-[hsl(220,30%,15%)]' : ''}`}>
                    <p className={`text-sm text-center ${colors.textMuted}`}>{titles.instruction}</p>

                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (status === 'typing' ? checkAnswer() : handleWrongNext())}
                        disabled={status !== 'typing'}
                        className={`w-full text-center text-xl p-5 rounded-2xl border-2 transition-all outline-none font-medium
              ${status === 'typing' ? `${colors.input} focus:border-[hsl(${isHK ? '350,90%,70%' : '16,90%,60%'})] focus:shadow-[0_0_0_3px_hsl(${isHK ? '350,90%,70%' : '16,90%,60%'},0.1)]` : ''}
              ${status === 'correct' ? (isHK ? 'border-[hsl(350,70%,70%)] bg-[hsl(350,100%,97%)] text-[hsl(350,50%,40%)]' : 'border-[hsl(160,50%,55%)] bg-[hsl(160,50%,97%)] text-[hsl(160,45%,35%)]') : ''}
              ${status === 'wrong' ? 'border-[hsl(350,80%,70%)] bg-[hsl(350,80%,98%)] text-[hsl(350,70%,40%)]' : ''}`}
                        placeholder="Wpisz tłumaczenie..."
                        autoComplete="off"
                    />

                    {status === 'correct' && (
                        <div className="text-center animate-slide-up">
                            <p className={`text-sm mb-1 ${isHK ? 'text-[hsl(350,60%,55%)]' : 'text-[hsl(160,40%,45%)]'}`}>
                                {isHK ? '💖 Kawaii!' : '✓ Doskonale!'}
                            </p>
                            <p className={`text-lg font-semibold ${isHK ? 'text-[hsl(350,50%,40%)]' : 'text-[hsl(160,45%,35%)]'}`}>{currentItem.answer}</p>
                        </div>
                    )}

                    {status === 'wrong' && (
                        <div className="space-y-4 animate-slide-up">
                            <div className="text-center">
                                <p className="text-sm text-[hsl(350,60%,50%)] mb-1">Poprawna odpowiedź:</p>
                                <p className="text-lg font-semibold text-[hsl(350,70%,40%)]">{currentItem.answer}</p>
                            </div>

                            {aiResult && (
                                <div className={`p-4 rounded-xl ${aiResult.is_correct ? 'bg-[hsl(160,50%,95%)] border border-[hsl(160,50%,80%)]' : 'bg-[hsl(30,80%,95%)] border border-[hsl(30,60%,80%)]'}`}>
                                    <p className={`text-sm font-medium ${aiResult.is_correct ? 'text-[hsl(160,45%,35%)]' : 'text-[hsl(30,70%,40%)]'}`}>
                                        {aiResult.is_correct ? '✅ AI potwierdza!' : '❌ AI potwierdza błąd'}
                                    </p>
                                    <p className="text-sm text-[hsl(220,20%,40%)] mt-1">{aiResult.explanation}</p>
                                </div>
                            )}

                            {aiError && (
                                <div className="p-4 rounded-xl bg-[hsl(350,80%,97%)] border border-[hsl(350,60%,85%)]">
                                    <p className="text-sm text-[hsl(350,70%,45%)]">{aiError}</p>
                                </div>
                            )}

                            <div className="flex gap-3 justify-center">
                                {!aiResult && (
                                    <Button
                                        onClick={async () => {
                                            setAiVerifying(true);
                                            setAiError(null);
                                            try {
                                                const taskType = mode === 'pl-fr' ? 'translate_pl_to_target' : 'translate_target_to_pl';
                                                const result = await aiApi.verifyAnswer({
                                                    task_type: taskType,
                                                    item_id: currentItem.id,
                                                    user_answer: input,
                                                    question: currentItem.question,
                                                    expected_answer: currentItem.answer
                                                });
                                                setAiResult(result);
                                                if (result.is_correct) {
                                                    await handleAICorrect();
                                                }
                                            } catch (e) {
                                                setAiError('Błąd połączenia z AI. Spróbuj ponownie.');
                                            } finally {
                                                setAiVerifying(false);
                                            }
                                        }}
                                        variant="outline"
                                        disabled={aiVerifying}
                                    >
                                        {aiVerifying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sprawdzanie...</> : <><Bot className="w-4 h-4 mr-2" />Sprawdź z AI</>}
                                    </Button>
                                )}
                                <Button onClick={handleWrongNext} variant="ghost" className={colors.textMuted}>
                                    Dalej →
                                </Button>
                            </div>
                        </div>
                    )}

                    {status === 'typing' && (
                        <div className="flex gap-3">
                            <Button onClick={handleSkip} variant="outline" className="flex-1" size="lg">
                                Pomiń
                            </Button>
                            <Button onClick={checkAnswer} className={`flex-[2] ${colors.btn} shadow-lg`} size="lg">
                                Sprawdź
                            </Button>
                        </div>
                    )}
                </div>
            </div>
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
}
