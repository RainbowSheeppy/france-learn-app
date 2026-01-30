import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { useLanguageStore, getTranslateFromPLLabel, getTranslateToPLLabel, getAppTitle } from '@/store/languageStore';
import { BookOpen, Languages, MessageSquare, HelpCircle, TextCursorInput, Sparkles, Trophy, Flame, Star, TrendingUp, Award, Info, X } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { dashboardApi, DashboardStats } from '@/lib/api';
import { getEarnedBadges, getUpcomingBadges, UserStats } from '@/lib/badges';
import BadgeDisplay from '@/components/BadgeDisplay';

// Study modes are now generated dynamically based on active language
const getStudyModes = (activeLanguage: 'fr' | 'en') => {
    const langFlag = activeLanguage === 'fr' ? '🇫🇷' : '🇬🇧';
    const langCode = activeLanguage.toUpperCase();

    return [
        {
            id: 'fiszki',
            title: 'Fiszki',
            description: 'Ucz się słówek z fiszkami',
            icon: BookOpen,
            path: '/learn/fiszki',
            emoji: '📚',
            kawaii: '🌸',
        },
        {
            id: 'translate-pl-fr',
            title: getTranslateFromPLLabel(activeLanguage),
            description: `Tłumacz z polskiego na ${activeLanguage === 'fr' ? 'francuski' : 'angielski'}`,
            icon: Languages,
            path: '/learn/translate-pl-fr',
            emoji: `🇵🇱➡️${langFlag}`,
            kawaii: '💖',
        },
        {
            id: 'translate-fr-pl',
            title: getTranslateToPLLabel(activeLanguage),
            description: `Tłumacz z ${activeLanguage === 'fr' ? 'francuskiego' : 'angielskiego'} na polski`,
            icon: MessageSquare,
            path: '/learn/translate-fr-pl',
            emoji: `${langFlag}➡️🇵🇱`,
            kawaii: '🎀',
        },
        {
            id: 'guess-object',
            title: 'Zgadnij',
            description: 'Rozpoznaj przedmiot po opisie',
            icon: HelpCircle,
            path: '/learn/guess-object',
            emoji: '🎯',
            kawaii: '⭐',
        },
        {
            id: 'fill-blank',
            title: 'Uzupełnij',
            description: 'Wypełnij luki w zdaniach',
            icon: TextCursorInput,
            path: '/learn/fill-blank',
            emoji: '✏️',
            kawaii: '🌟',
        },
    ];
};

// Points Info Modal
function PointsInfoModal({ isOpen, onClose, isHK, isDark }: { isOpen: boolean; onClose: () => void; isHK: boolean; isDark: boolean }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
            <div className={`relative max-w-lg w-full max-h-[80vh] overflow-y-auto rounded-2xl p-6 ${isHK
                ? 'bg-white border-2 border-[hsl(350,80%,85%)]'
                : isDark
                    ? 'bg-[hsl(220,30%,15%)] border border-[hsl(220,30%,25%)]'
                    : 'bg-white border border-gray-200'
                }`}>
                <button
                    onClick={onClose}
                    className={`absolute top-4 right-4 p-1 rounded-full transition-colors ${isHK
                        ? 'hover:bg-[hsl(350,80%,92%)] text-[hsl(350,60%,50%)]'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
                        }`}
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className={`text-2xl font-bold mb-4 ${isHK ? 'text-[hsl(350,50%,40%)]' : isDark ? 'text-white' : 'text-gray-900'}`}>
                    {isHK ? '🎀 Jak zdobywać punkty? 🎀' : 'Jak zdobywać punkty?'}
                </h2>

                <div className={`space-y-4 text-sm ${isHK ? 'text-[hsl(350,30%,40%)]' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {/* Podstawowe punkty */}
                    <div className={`p-4 rounded-xl ${isHK ? 'bg-[hsl(350,80%,96%)]' : isDark ? 'bg-[hsl(220,30%,20%)]' : 'bg-gray-50'}`}>
                        <h3 className={`font-semibold mb-2 ${isHK ? 'text-[hsl(350,60%,45%)]' : isDark ? 'text-white' : 'text-gray-900'}`}>
                            Punkty za poprawne odpowiedzi
                        </h3>
                        <ul className="space-y-1">
                            <li>Poziom A1/A2: <span className="font-bold text-green-600">+10 pkt</span></li>
                            <li>Poziom B1/B2: <span className="font-bold text-green-600">+20 pkt</span></li>
                            <li>Poziom C1/C2: <span className="font-bold text-green-600">+30 pkt</span></li>
                            <li>Powtórka (nauczone): <span className="font-bold text-green-600">+2 pkt</span></li>
                        </ul>
                    </div>

                    {/* Combo */}
                    <div className={`p-4 rounded-xl ${isHK ? 'bg-[hsl(330,80%,96%)]' : isDark ? 'bg-[hsl(220,30%,20%)]' : 'bg-orange-50'}`}>
                        <h3 className={`font-semibold mb-2 ${isHK ? 'text-[hsl(330,60%,45%)]' : isDark ? 'text-white' : 'text-orange-800'}`}>
                            {isHK ? '✨ Mnożnik Combo ✨' : 'Mnożnik Combo'}
                        </h3>
                        <ul className="space-y-1">
                            <li>2-4 poprawne z rzędu: <span className="font-bold text-orange-600">x1.2</span></li>
                            <li>5-9 poprawnych z rzędu: <span className="font-bold text-orange-600">x1.5</span></li>
                            <li>10+ poprawnych z rzędu: <span className="font-bold text-orange-600">x2.0</span></li>
                        </ul>
                        <p className="mt-2 text-xs opacity-70">Błędna odpowiedź resetuje combo do 0!</p>
                    </div>

                    {/* Kary */}
                    <div className={`p-4 rounded-xl ${isHK ? 'bg-[hsl(350,60%,96%)]' : isDark ? 'bg-[hsl(220,30%,20%)]' : 'bg-red-50'}`}>
                        <h3 className={`font-semibold mb-2 ${isHK ? 'text-[hsl(350,50%,45%)]' : isDark ? 'text-white' : 'text-red-800'}`}>
                            Kary za błędy
                        </h3>
                        <ul className="space-y-1">
                            <li>Błąd przy nowym słowie: <span className="font-bold text-red-600">-4 pkt</span></li>
                            <li>Błąd przy znanym słowie: <span className="font-bold text-red-600">-10 pkt</span></li>
                        </ul>
                        <p className="mt-2 text-xs opacity-70">Punkty nie mogą spaść poniżej 0.</p>
                    </div>

                    {/* Wordle */}
                    <div className={`p-4 rounded-xl ${isHK ? 'bg-[hsl(280,80%,96%)]' : isDark ? 'bg-[hsl(220,30%,20%)]' : 'bg-purple-50'}`}>
                        <h3 className={`font-semibold mb-2 ${isHK ? 'text-[hsl(280,60%,45%)]' : isDark ? 'text-white' : 'text-purple-800'}`}>
                            {isHK ? '🎮 Minigra Wordle 🎮' : 'Minigra Wordle'}
                        </h3>
                        <p>15% szansa na uruchomienie po poprawnej odpowiedzi</p>
                        <p className="mt-1">Wygrana: <span className="font-bold text-purple-600">+100 pkt</span></p>
                    </div>

                    {/* Poziomy */}
                    <div className={`p-4 rounded-xl ${isHK ? 'bg-[hsl(200,80%,96%)]' : isDark ? 'bg-[hsl(220,30%,20%)]' : 'bg-blue-50'}`}>
                        <h3 className={`font-semibold mb-2 ${isHK ? 'text-[hsl(200,60%,45%)]' : isDark ? 'text-white' : 'text-blue-800'}`}>
                            Poziomy gracza
                        </h3>
                        <ul className="space-y-1">
                            <li>0 pkt: <span className="font-medium">Debiutant</span></li>
                            <li>100 pkt: <span className="font-medium">Nowicjusz</span></li>
                            <li>250 pkt: <span className="font-medium">Uczestnik</span></li>
                            <li>500 pkt: <span className="font-medium">Adept</span></li>
                            <li>1000 pkt: <span className="font-medium">Mistrz</span></li>
                            <li>2000 pkt: <span className="font-medium">Legenda</span></li>
                        </ul>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className={`mt-6 w-full py-3 rounded-xl font-semibold transition-colors ${isHK
                        ? 'bg-gradient-to-r from-[hsl(350,90%,75%)] to-[hsl(330,85%,70%)] text-white hover:opacity-90'
                        : 'bg-gradient-to-r from-[hsl(16,90%,60%)] to-[hsl(350,80%,60%)] text-white hover:opacity-90'
                        }`}
                >
                    {isHK ? 'Rozumiem! 💕' : 'Rozumiem!'}
                </button>
            </div>
        </div>
    );
}

// Floating hearts component for kawaii effect
function FloatingHearts({ count = 5 }: { count?: number }) {
    const [hearts, setHearts] = useState<Array<{ id: number; left: number; delay: number }>>([]);

    useEffect(() => {
        const newHearts = Array.from({ length: count }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 2,
        }));
        setHearts(newHearts);
    }, [count]);

    return (
        <>
            {hearts.map(heart => (
                <div
                    key={heart.id}
                    className="hk-heart"
                    style={{
                        left: `${heart.left}%`,
                        animationDelay: `${heart.delay}s`,
                        fontSize: `${16 + Math.random() * 12}px`,
                    }}
                >
                    {['💕', '💗', '💖', '🎀', '✨'][Math.floor(Math.random() * 5)]}
                </div>
            ))}
        </>
    );
}

// Progress bar component
function ProgressBar({ value, max, isHK }: { value: number; max: number; isHK: boolean }) {
    const percent = max > 0 ? Math.round((value / max) * 100) : 0;

    return (
        <div className="w-full">
            <div className={`h-2 rounded-full overflow-hidden ${isHK ? 'bg-[hsl(350,60%,90%)]' : 'bg-[hsl(45,20%,90%)] dark:bg-[hsl(220,30%,25%)]'}`}>
                <div
                    className={`h-full transition-all duration-700 ease-out ${isHK
                        ? 'bg-gradient-to-r from-[hsl(350,90%,75%)] to-[hsl(330,90%,70%)]'
                        : 'bg-gradient-to-r from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)]'
                        }`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <div className="flex justify-between mt-1">
                <span className={`text-xs ${isHK ? 'text-[hsl(350,40%,55%)]' : 'text-[hsl(220,20%,55%)] dark:text-[hsl(220,20%,60%)]'}`}>
                    {value} / {max}
                </span>
                <span className={`text-xs font-medium ${isHK ? 'text-[hsl(350,60%,50%)]' : 'text-[hsl(16,70%,50%)]'}`}>
                    {percent}%
                </span>
            </div>
        </div>
    );
}

// Stats card component
function StatCard({
    icon: Icon,
    label,
    value,
    subValue,
    isHK,
    isDark,
    color
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subValue?: string;
    isHK: boolean;
    isDark: boolean;
    color: 'coral' | 'mint' | 'lavender' | 'rose';
}) {
    const colorMap = {
        coral: isHK ? 'from-[hsl(350,90%,80%)] to-[hsl(350,80%,70%)]' : 'from-[hsl(16,90%,60%)] to-[hsl(16,80%,50%)]',
        mint: isHK ? 'from-[hsl(330,80%,80%)] to-[hsl(340,70%,70%)]' : 'from-[hsl(160,50%,55%)] to-[hsl(160,45%,45%)]',
        lavender: isHK ? 'from-[hsl(350,100%,85%)] to-[hsl(330,90%,75%)]' : 'from-[hsl(260,60%,70%)] to-[hsl(260,50%,60%)]',
        rose: isHK ? 'from-[hsl(340,90%,80%)] to-[hsl(350,85%,70%)]' : 'from-[hsl(350,80%,65%)] to-[hsl(350,70%,55%)]',
    };

    return (
        <div className={`p-4 rounded-2xl transition-all duration-300 hover:scale-105 ${isHK
            ? 'bg-white/90 border-2 border-[hsl(350,80%,88%)] shadow-lg shadow-pink-100/50'
            : isDark
                ? 'bg-[hsl(220,30%,18%)] border border-[hsl(220,30%,25%)]'
                : 'bg-white border border-[hsl(45,20%,90%)] shadow-sm'
            }`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${colorMap[color]}`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                    <p className={`text-2xl font-bold ${isHK ? 'text-[hsl(350,50%,40%)]' : isDark ? 'text-white' : 'text-[hsl(220,40%,13%)]'}`}>
                        {value}
                    </p>
                    <p className={`text-xs ${isHK ? 'text-[hsl(350,30%,55%)]' : 'text-[hsl(220,20%,55%)] dark:text-[hsl(220,20%,60%)]'}`}>
                        {label}
                        {subValue && <span className="ml-1 opacity-70">{subValue}</span>}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function StudentDashboard() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const theme = useThemeStore((state) => state.theme);
    const { activeLanguage, config } = useLanguageStore();
    const [showHearts, setShowHearts] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [showPointsInfo, setShowPointsInfo] = useState(false);
    const isHelloKitty = theme === 'hellokitty';
    const isDark = theme === 'dark';

    // Get study modes based on active language
    const studyModes = useMemo(() => getStudyModes(activeLanguage), [activeLanguage]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await dashboardApi.getStats();
                setStats(data);
            } catch (err) {
                console.error('Failed to fetch dashboard stats:', err);
            } finally {
                setStatsLoading(false);
            }
        };
        fetchStats();
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Dzień dobry';
        if (hour < 18) return 'Cześć';
        return 'Dobry wieczór';
    };

    const handleCardClick = (path: string) => {
        if (isHelloKitty) {
            setShowHearts(true);
        }
        setTimeout(() => {
            navigate(path);
        }, isHelloKitty ? 300 : 100);
    };

    // Get progress for each mode
    const getModeProgress = (modeId: string): { total: number; learned: number } => {
        if (!stats) return { total: 0, learned: 0 };
        const mapping: Record<string, { total: number; learned: number }> = {
            'fiszki': stats.fiszki,
            'translate-pl-fr': stats.translate_pl_fr,
            'translate-fr-pl': stats.translate_fr_pl,
            'guess-object': stats.guess_object,
            'fill-blank': stats.fill_blank,
        };
        return mapping[modeId] || { total: 0, learned: 0 };
    };

    // Calculate badges
    const userStatsForBadges: UserStats | null = useMemo(() => {
        if (!stats) return null;
        return {
            totalPoints: stats.total_points,
            highestCombo: stats.highest_combo,
            currentStreak: stats.current_streak,
            totalLearned: stats.total_learned,
            totalItems: stats.total_items,
            fiszkiLearned: stats.fiszki.learned,
            translatePlFrLearned: stats.translate_pl_fr.learned,
            translateFrPlLearned: stats.translate_fr_pl.learned,
            guessObjectLearned: stats.guess_object.learned,
            fillBlankLearned: stats.fill_blank.learned,
        };
    }, [stats]);

    const earnedBadges = useMemo(() => {
        if (!userStatsForBadges) return [];
        return getEarnedBadges(userStatsForBadges);
    }, [userStatsForBadges]);

    const upcomingBadges = useMemo(() => {
        if (!userStatsForBadges) return [];
        return getUpcomingBadges(userStatsForBadges, 3);
    }, [userStatsForBadges]);

    return (
        <div className={`min-h-[80vh] animate-fade-in relative ${isHelloKitty ? 'hk-bg theme-hellokitty' : ''}`}>
            {showHearts && <FloatingHearts count={8} />}
            <PointsInfoModal isOpen={showPointsInfo} onClose={() => setShowPointsInfo(false)} isHK={isHelloKitty} isDark={isDark} />

            {/* Hero Section */}
            <div className="text-center mb-8 space-y-4 relative z-10 pt-4">
                <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-md transition-colors
          ${isHelloKitty
                        ? 'bg-white border-[hsl(350,80%,85%)]'
                        : 'bg-white/80 border-[hsl(45,20%,88%)] dark:bg-[hsl(220,30%,20%)] dark:border-[hsl(220,30%,30%)]'
                    }`}>
                    <Sparkles className={`w-4 h-4 ${isHelloKitty ? 'text-[hsl(350,90%,65%)]' : 'text-[hsl(16,90%,60%)] dark:text-[hsl(16,80%,65%)]'}`} />
                    <span className={`text-sm font-medium ${isHelloKitty ? 'hk-text' : 'text-[hsl(220,30%,40%)] dark:text-[hsl(220,20%,70%)]'}`}>
                        {isHelloKitty ? '✨ Kawaii Learning ✨' : '✨ Nauka z pasją ✨'}
                    </span>
                    <span className="text-lg">{isHelloKitty ? '🎀' : config.flag}</span>
                </div>

                <h1 className={`text-5xl font-bold tracking-tight transition-colors
          ${isHelloKitty
                        ? 'hk-title'
                        : 'text-[hsl(220,40%,13%)] dark:text-white'
                    }`}>
                    {getGreeting()}, {user?.name}! {isHelloKitty ? '💕' : ''}
                </h1>

                <p className={`text-lg max-w-md mx-auto transition-colors
          ${isHelloKitty
                        ? 'hk-text-muted'
                        : 'text-[hsl(220,20%,45%)] dark:text-[hsl(220,20%,65%)]'
                    }`}>
                    {isHelloKitty
                        ? (activeLanguage === 'fr'
                            ? 'Wybierz tryb nauki i rozpocznij przygodę z francuskim! 🌸'
                            : 'Wybierz tryb nauki i rozpocznij przygodę z angielskim! 🌸')
                        : 'Wybierz tryb nauki i rozpocznij naukę'}
                </p>
            </div>

            {/* Stats Section */}
            {!statsLoading && stats && (
                <div className="max-w-5xl mx-auto mb-10 px-4 relative z-10 animate-slide-up">
                    {/* Points Info Button */}
                    <div className="flex justify-end mb-3">
                        <button
                            onClick={() => setShowPointsInfo(true)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 ${isHelloKitty
                                ? 'bg-white border-2 border-[hsl(350,80%,85%)] text-[hsl(350,60%,50%)] hover:bg-[hsl(350,80%,96%)]'
                                : isDark
                                    ? 'bg-[hsl(220,30%,22%)] border border-[hsl(220,30%,30%)] text-[hsl(220,20%,70%)] hover:bg-[hsl(220,30%,26%)]'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Info className="w-4 h-4" />
                            {isHelloKitty ? 'Jak zdobywać punkty? 💕' : 'Jak zdobywać punkty?'}
                        </button>
                    </div>

                    {/* Main Stats Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <StatCard
                            icon={Trophy}
                            label="Punkty"
                            value={stats.total_points}
                            isHK={isHelloKitty}
                            isDark={isDark}
                            color="coral"
                        />
                        <StatCard
                            icon={Flame}
                            label="Seria"
                            value={stats.current_streak}
                            subValue={stats.highest_combo > 0 ? `(max: ${stats.highest_combo})` : undefined}
                            isHK={isHelloKitty}
                            isDark={isDark}
                            color="rose"
                        />
                        <StatCard
                            icon={Star}
                            label="Poziom"
                            value={stats.level}
                            isHK={isHelloKitty}
                            isDark={isDark}
                            color="lavender"
                        />
                        <StatCard
                            icon={TrendingUp}
                            label="Nauczone"
                            value={stats.total_learned}
                            subValue={`/ ${stats.total_items}`}
                            isHK={isHelloKitty}
                            isDark={isDark}
                            color="mint"
                        />
                    </div>

                    {/* Level Progress Bar */}
                    <div className={`p-4 rounded-2xl mb-4 ${isHelloKitty
                        ? 'bg-white/80 border-2 border-[hsl(350,80%,88%)]'
                        : isDark
                            ? 'bg-[hsl(220,30%,16%)] border border-[hsl(220,30%,22%)]'
                            : 'bg-white/90 border border-[hsl(45,20%,90%)]'
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${isHelloKitty ? 'text-[hsl(350,50%,45%)]' : isDark ? 'text-white' : 'text-[hsl(220,40%,20%)]'}`}>
                                {isHelloKitty ? '✨ ' : ''}Postęp do następnego poziomu
                            </span>
                            <span className={`text-sm ${isHelloKitty ? 'text-[hsl(350,60%,55%)]' : 'text-[hsl(16,70%,50%)]'}`}>
                                {Math.round(stats.level_progress)}%
                            </span>
                        </div>
                        <div className={`h-3 rounded-full overflow-hidden ${isHelloKitty ? 'bg-[hsl(350,60%,92%)]' : 'bg-[hsl(45,20%,92%)] dark:bg-[hsl(220,30%,22%)]'}`}>
                            <div
                                className={`h-full transition-all duration-1000 ease-out rounded-full ${isHelloKitty
                                    ? 'bg-gradient-to-r from-[hsl(350,90%,75%)] via-[hsl(330,90%,70%)] to-[hsl(350,90%,75%)] animate-shimmer'
                                    : 'bg-gradient-to-r from-[hsl(16,90%,60%)] via-[hsl(350,80%,60%)] to-[hsl(260,60%,65%)]'
                                    }`}
                                style={{ width: `${stats.level_progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Badges Section */}
                    {(earnedBadges.length > 0 || upcomingBadges.length > 0) && (
                        <div className={`p-4 rounded-2xl ${isHelloKitty
                            ? 'bg-white/80 border-2 border-[hsl(350,80%,88%)]'
                            : isDark
                                ? 'bg-[hsl(220,30%,16%)] border border-[hsl(220,30%,22%)]'
                                : 'bg-white/90 border border-[hsl(45,20%,90%)]'
                            }`}>
                            {/* Earned Badges */}
                            {earnedBadges.length > 0 && (
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Award className={`w-4 h-4 ${isHelloKitty ? 'text-[hsl(350,70%,60%)]' : 'text-[hsl(16,70%,55%)]'}`} />
                                        <span className={`text-sm font-semibold ${isHelloKitty ? 'text-[hsl(350,50%,45%)]' : isDark ? 'text-white' : 'text-[hsl(220,40%,20%)]'}`}>
                                            {isHelloKitty ? 'Twoje odznaki 🎀' : 'Twoje odznaki'}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${isHelloKitty ? 'bg-[hsl(350,80%,90%)] text-[hsl(350,60%,50%)]' : 'bg-[hsl(16,80%,92%)] text-[hsl(16,70%,45%)]'}`}>
                                            {earnedBadges.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {earnedBadges.slice(0, 6).map((badge) => (
                                            <BadgeDisplay key={badge.id} badge={badge} earned size="sm" />
                                        ))}
                                        {earnedBadges.length > 6 && (
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${isHelloKitty
                                                ? 'bg-[hsl(350,80%,92%)] text-[hsl(350,60%,50%)]'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                                }`}>
                                                +{earnedBadges.length - 6}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Upcoming Badges */}
                            {upcomingBadges.length > 0 && (
                                <div>
                                    <span className={`text-xs font-medium uppercase tracking-wide ${isHelloKitty ? 'text-[hsl(350,40%,60%)]' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {isHelloKitty ? '✨ Prawie tam!' : 'Prawie tam'}
                                    </span>
                                    <div className="mt-2 space-y-2">
                                        {upcomingBadges.map(({ badge, progress }) => (
                                            <div key={badge.id} className="flex items-center gap-3">
                                                <BadgeDisplay badge={badge} earned={false} size="sm" />
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`text-xs font-medium ${isHelloKitty ? 'text-[hsl(350,40%,45%)]' : 'text-gray-600 dark:text-gray-300'}`}>
                                                            {badge.namePl}
                                                        </span>
                                                        <span className={`text-xs ${isHelloKitty ? 'text-[hsl(350,50%,55%)]' : 'text-gray-500'}`}>
                                                            {Math.round(progress)}%
                                                        </span>
                                                    </div>
                                                    <div className={`h-1.5 rounded-full overflow-hidden ${isHelloKitty ? 'bg-[hsl(350,60%,92%)]' : 'bg-gray-200 dark:bg-gray-600'}`}>
                                                        <div
                                                            className={`h-full rounded-full ${isHelloKitty
                                                                ? 'bg-gradient-to-r from-[hsl(350,70%,80%)] to-[hsl(330,70%,75%)]'
                                                                : 'bg-gradient-to-r from-[hsl(16,70%,65%)] to-[hsl(350,60%,65%)]'
                                                                }`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Mode Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto relative z-10 px-4">
                {studyModes.map((mode, index) => {
                    const Icon = mode.icon;
                    const progress = getModeProgress(mode.id);
                    return (
                        <button
                            key={mode.id}
                            onClick={() => handleCardClick(mode.path)}
                            className={`group text-left p-6 animate-card-entrance transition-all duration-300
                ${isHelloKitty
                                    ? 'hk-mode-card'
                                    : 'bg-white dark:bg-[hsl(220,30%,18%)] rounded-2xl border-2 border-transparent hover:border-[hsl(16,90%,70%)] dark:hover:border-[hsl(16,80%,60%)] hover:shadow-2xl hover:-translate-y-2'
                                }`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            {/* Kawaii decoration (only in HK mode) */}
                            {isHelloKitty && (
                                <div className="absolute top-3 right-3 text-2xl opacity-70 group-hover:opacity-100 transition-opacity group-hover:animate-float">
                                    {mode.kawaii}
                                </div>
                            )}

                            {/* Icon */}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform
                ${isHelloKitty
                                    ? 'bg-gradient-to-br from-[hsl(350,90%,80%)] to-[hsl(330,85%,70%)]'
                                    : 'bg-gradient-to-br from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)] dark:from-[hsl(16,70%,50%)] dark:to-[hsl(350,60%,55%)]'
                                }`}>
                                <Icon className="w-7 h-7 text-white" />
                            </div>

                            {/* Content */}
                            <h3 className={`text-xl font-bold mb-2 transition-colors
                ${isHelloKitty
                                    ? 'hk-title'
                                    : 'text-[hsl(220,40%,13%)] dark:text-white'
                                }`}>
                                {mode.title}
                            </h3>
                            <p className={`text-sm mb-3 transition-colors
                ${isHelloKitty
                                    ? 'hk-text-muted'
                                    : 'text-[hsl(220,20%,45%)] dark:text-[hsl(220,20%,65%)]'
                                }`}>
                                {mode.description}
                            </p>

                            {/* Progress Bar */}
                            {stats && progress.total > 0 && (
                                <div className="mb-4">
                                    <ProgressBar value={progress.learned} max={progress.total} isHK={isHelloKitty} />
                                </div>
                            )}

                            {/* Emoji footer */}
                            <div className="flex items-center justify-between">
                                <span className="text-2xl">{mode.emoji}</span>
                                <span className={`text-sm font-medium group-hover:translate-x-1 transition-transform
                  ${isHelloKitty
                                        ? 'text-[hsl(350,70%,60%)]'
                                        : 'text-[hsl(16,70%,55%)] dark:text-[hsl(16,70%,65%)]'
                                    }`}>
                                    {isHelloKitty ? "Let's go! →" : 'Rozpocznij →'}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer decoration */}
            <div className="text-center mt-16 pb-8 relative z-10">
                <div className={`inline-flex items-center gap-3 transition-colors
          ${isHelloKitty
                        ? 'text-[hsl(350,50%,60%)]'
                        : 'text-[hsl(220,20%,55%)] dark:text-[hsl(220,20%,60%)]'
                    }`}>
                    <span>{isHelloKitty ? '🎀' : (activeLanguage === 'fr' ? '🥐' : '☕')}</span>
                    <span className="text-sm">
                        {isHelloKitty ? 'Ucz się z Hello Kitty vibes!' : 'Ucz się z przyjemnością!'}
                    </span>
                    <span>{isHelloKitty ? '🌸' : config.flag}</span>
                </div>
            </div>
        </div>
    );
}
