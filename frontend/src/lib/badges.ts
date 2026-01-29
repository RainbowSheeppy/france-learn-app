// Badge system - badges are calculated based on user stats, not stored in DB

export interface Badge {
    id: string;
    name: string;
    namePl: string;
    description: string;
    descriptionPl: string;
    emoji: string;
    emojiHK: string; // Hello Kitty themed emoji
    category: 'points' | 'streak' | 'progress' | 'special';
    tier: 'bronze' | 'silver' | 'gold' | 'diamond';
    requirement: number;
    checkFn: (stats: UserStats) => boolean;
}

export interface UserStats {
    totalPoints: number;
    highestCombo: number;
    currentStreak: number;
    totalLearned: number;
    totalItems: number;
    fiszkiLearned: number;
    translatePlFrLearned: number;
    translateFrPlLearned: number;
    guessObjectLearned: number;
    fillBlankLearned: number;
}

export const BADGES: Badge[] = [
    // Points badges
    {
        id: 'first-points',
        name: 'First Steps',
        namePl: 'Pierwsze kroki',
        description: 'Earn your first 10 points',
        descriptionPl: 'Zdobądź pierwsze 10 punktów',
        emoji: '🌱',
        emojiHK: '🌸',
        category: 'points',
        tier: 'bronze',
        requirement: 10,
        checkFn: (stats) => stats.totalPoints >= 10,
    },
    {
        id: 'points-100',
        name: 'Point Collector',
        namePl: 'Kolekcjoner punktów',
        description: 'Earn 100 points',
        descriptionPl: 'Zdobądź 100 punktów',
        emoji: '⭐',
        emojiHK: '💫',
        category: 'points',
        tier: 'bronze',
        requirement: 100,
        checkFn: (stats) => stats.totalPoints >= 100,
    },
    {
        id: 'points-500',
        name: 'Point Hunter',
        namePl: 'Łowca punktów',
        description: 'Earn 500 points',
        descriptionPl: 'Zdobądź 500 punktów',
        emoji: '🏅',
        emojiHK: '💖',
        category: 'points',
        tier: 'silver',
        requirement: 500,
        checkFn: (stats) => stats.totalPoints >= 500,
    },
    {
        id: 'points-1000',
        name: 'Point Master',
        namePl: 'Mistrz punktów',
        description: 'Earn 1000 points',
        descriptionPl: 'Zdobądź 1000 punktów',
        emoji: '🏆',
        emojiHK: '👑',
        category: 'points',
        tier: 'gold',
        requirement: 1000,
        checkFn: (stats) => stats.totalPoints >= 1000,
    },
    {
        id: 'points-5000',
        name: 'Point Legend',
        namePl: 'Legenda punktów',
        description: 'Earn 5000 points',
        descriptionPl: 'Zdobądź 5000 punktów',
        emoji: '💎',
        emojiHK: '✨',
        category: 'points',
        tier: 'diamond',
        requirement: 5000,
        checkFn: (stats) => stats.totalPoints >= 5000,
    },

    // Streak/Combo badges
    {
        id: 'combo-5',
        name: 'On Fire',
        namePl: 'W ogniu',
        description: 'Reach a 5x combo',
        descriptionPl: 'Osiągnij combo 5x',
        emoji: '🔥',
        emojiHK: '💗',
        category: 'streak',
        tier: 'bronze',
        requirement: 5,
        checkFn: (stats) => stats.highestCombo >= 5,
    },
    {
        id: 'combo-10',
        name: 'Combo King',
        namePl: 'Król combo',
        description: 'Reach a 10x combo',
        descriptionPl: 'Osiągnij combo 10x',
        emoji: '👑',
        emojiHK: '🎀',
        category: 'streak',
        tier: 'silver',
        requirement: 10,
        checkFn: (stats) => stats.highestCombo >= 10,
    },
    {
        id: 'combo-25',
        name: 'Unstoppable',
        namePl: 'Nie do zatrzymania',
        description: 'Reach a 25x combo',
        descriptionPl: 'Osiągnij combo 25x',
        emoji: '⚡',
        emojiHK: '💕',
        category: 'streak',
        tier: 'gold',
        requirement: 25,
        checkFn: (stats) => stats.highestCombo >= 25,
    },
    {
        id: 'combo-50',
        name: 'Perfect Streak',
        namePl: 'Perfekcyjna seria',
        description: 'Reach a 50x combo',
        descriptionPl: 'Osiągnij combo 50x',
        emoji: '🌟',
        emojiHK: '🌸',
        category: 'streak',
        tier: 'diamond',
        requirement: 50,
        checkFn: (stats) => stats.highestCombo >= 50,
    },

    // Progress badges
    {
        id: 'learned-10',
        name: 'Quick Learner',
        namePl: 'Szybki uczeń',
        description: 'Learn 10 items',
        descriptionPl: 'Naucz się 10 słów',
        emoji: '📚',
        emojiHK: '📖',
        category: 'progress',
        tier: 'bronze',
        requirement: 10,
        checkFn: (stats) => stats.totalLearned >= 10,
    },
    {
        id: 'learned-50',
        name: 'Knowledge Seeker',
        namePl: 'Poszukiwacz wiedzy',
        description: 'Learn 50 items',
        descriptionPl: 'Naucz się 50 słów',
        emoji: '🎓',
        emojiHK: '🎀',
        category: 'progress',
        tier: 'silver',
        requirement: 50,
        checkFn: (stats) => stats.totalLearned >= 50,
    },
    {
        id: 'learned-100',
        name: 'Scholar',
        namePl: 'Uczony',
        description: 'Learn 100 items',
        descriptionPl: 'Naucz się 100 słów',
        emoji: '🧠',
        emojiHK: '💖',
        category: 'progress',
        tier: 'gold',
        requirement: 100,
        checkFn: (stats) => stats.totalLearned >= 100,
    },
    {
        id: 'learned-250',
        name: 'Vocabulary Master',
        namePl: 'Mistrz słownictwa',
        description: 'Learn 250 items',
        descriptionPl: 'Naucz się 250 słów',
        emoji: '🏛️',
        emojiHK: '👑',
        category: 'progress',
        tier: 'diamond',
        requirement: 250,
        checkFn: (stats) => stats.totalLearned >= 250,
    },

    // Special badges
    {
        id: 'all-rounder',
        name: 'All-Rounder',
        namePl: 'Wszechstronny',
        description: 'Learn at least 5 items in each mode',
        descriptionPl: 'Naucz się przynajmniej 5 słów w każdym trybie',
        emoji: '🌈',
        emojiHK: '🌸',
        category: 'special',
        tier: 'gold',
        requirement: 5,
        checkFn: (stats) =>
            stats.fiszkiLearned >= 5 &&
            stats.translatePlFrLearned >= 5 &&
            stats.translateFrPlLearned >= 5 &&
            stats.guessObjectLearned >= 5 &&
            stats.fillBlankLearned >= 5,
    },
    {
        id: 'flashcard-fan',
        name: 'Flashcard Fan',
        namePl: 'Fan fiszek',
        description: 'Learn 25 flashcards',
        descriptionPl: 'Naucz się 25 fiszek',
        emoji: '🃏',
        emojiHK: '💕',
        category: 'special',
        tier: 'silver',
        requirement: 25,
        checkFn: (stats) => stats.fiszkiLearned >= 25,
    },
    {
        id: 'translator',
        name: 'Translator',
        namePl: 'Tłumacz',
        description: 'Learn 50 translations (PL→FR + FR→PL combined)',
        descriptionPl: 'Naucz się 50 tłumaczeń łącznie',
        emoji: '🌐',
        emojiHK: '🎀',
        category: 'special',
        tier: 'gold',
        requirement: 50,
        checkFn: (stats) => stats.translatePlFrLearned + stats.translateFrPlLearned >= 50,
    },
];

// Calculate which badges a user has earned
export function getEarnedBadges(stats: UserStats): Badge[] {
    return BADGES.filter((badge) => badge.checkFn(stats));
}

// Get badges close to being earned (for motivation)
export function getUpcomingBadges(stats: UserStats, limit = 3): { badge: Badge; progress: number }[] {
    const unearned = BADGES.filter((badge) => !badge.checkFn(stats));

    const withProgress = unearned.map((badge) => {
        let current = 0;
        let required = badge.requirement;

        switch (badge.category) {
            case 'points':
                current = stats.totalPoints;
                break;
            case 'streak':
                current = stats.highestCombo;
                break;
            case 'progress':
                current = stats.totalLearned;
                break;
            case 'special':
                // Special badges have custom logic
                if (badge.id === 'all-rounder') {
                    const min = Math.min(
                        stats.fiszkiLearned,
                        stats.translatePlFrLearned,
                        stats.translateFrPlLearned,
                        stats.guessObjectLearned,
                        stats.fillBlankLearned
                    );
                    current = min;
                } else if (badge.id === 'flashcard-fan') {
                    current = stats.fiszkiLearned;
                } else if (badge.id === 'translator') {
                    current = stats.translatePlFrLearned + stats.translateFrPlLearned;
                }
                break;
        }

        return {
            badge,
            progress: Math.min((current / required) * 100, 99), // Cap at 99% for unearned
        };
    });

    // Sort by closest to completion
    return withProgress.sort((a, b) => b.progress - a.progress).slice(0, limit);
}

// Get tier color
export function getTierColor(tier: Badge['tier']): string {
    switch (tier) {
        case 'bronze':
            return 'from-amber-600 to-amber-700';
        case 'silver':
            return 'from-gray-400 to-gray-500';
        case 'gold':
            return 'from-yellow-400 to-yellow-500';
        case 'diamond':
            return 'from-cyan-400 to-blue-500';
        default:
            return 'from-gray-400 to-gray-500';
    }
}

export function getTierColorHK(tier: Badge['tier']): string {
    switch (tier) {
        case 'bronze':
            return 'from-[hsl(350,70%,75%)] to-[hsl(350,60%,65%)]';
        case 'silver':
            return 'from-[hsl(330,60%,80%)] to-[hsl(330,50%,70%)]';
        case 'gold':
            return 'from-[hsl(350,90%,75%)] to-[hsl(340,85%,65%)]';
        case 'diamond':
            return 'from-[hsl(340,100%,80%)] to-[hsl(350,95%,70%)]';
        default:
            return 'from-[hsl(350,60%,75%)] to-[hsl(350,50%,65%)]';
    }
}
