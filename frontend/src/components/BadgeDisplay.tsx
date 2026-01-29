import { Badge, getTierColor, getTierColorHK } from '@/lib/badges';
import { useThemeStore } from '@/store/themeStore';

interface BadgeDisplayProps {
    badge: Badge;
    earned?: boolean;
    showDescription?: boolean;
    size?: 'sm' | 'md' | 'lg';
    animate?: boolean;
}

export default function BadgeDisplay({
    badge,
    earned = true,
    showDescription = false,
    size = 'md',
    animate = false,
}: BadgeDisplayProps) {
    const theme = useThemeStore((state) => state.theme);
    const isHK = theme === 'hellokitty';

    const sizeClasses = {
        sm: 'w-12 h-12 text-xl',
        md: 'w-16 h-16 text-2xl',
        lg: 'w-20 h-20 text-3xl',
    };

    const tierGradient = isHK ? getTierColorHK(badge.tier) : getTierColor(badge.tier);
    const emoji = isHK ? badge.emojiHK : badge.emoji;

    return (
        <div className={`flex flex-col items-center gap-2 ${animate ? 'animate-scale-pop' : ''}`}>
            <div
                className={`
                    relative rounded-full flex items-center justify-center
                    ${sizeClasses[size]}
                    ${earned
                        ? `bg-gradient-to-br ${tierGradient} shadow-lg`
                        : 'bg-gray-200 dark:bg-gray-700 opacity-50'
                    }
                    ${earned && animate ? 'animate-glow-pulse' : ''}
                    transition-all duration-300
                `}
            >
                <span className={earned ? '' : 'grayscale opacity-50'}>
                    {emoji}
                </span>

                {/* Sparkle effect for earned badges */}
                {earned && isHK && (
                    <>
                        <span className="absolute -top-1 -right-1 text-sm animate-sparkle">✨</span>
                        <span className="absolute -bottom-1 -left-1 text-sm animate-sparkle" style={{ animationDelay: '0.3s' }}>✨</span>
                    </>
                )}

                {/* Tier indicator */}
                {earned && badge.tier === 'diamond' && (
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                )}
            </div>

            {showDescription && (
                <div className="text-center">
                    <p className={`text-sm font-semibold ${isHK ? 'text-[hsl(350,50%,40%)]' : 'text-gray-800 dark:text-white'}`}>
                        {badge.namePl}
                    </p>
                    <p className={`text-xs ${isHK ? 'text-[hsl(350,30%,55%)]' : 'text-gray-500 dark:text-gray-400'}`}>
                        {badge.descriptionPl}
                    </p>
                </div>
            )}
        </div>
    );
}

// Badge grid component for profile page
interface BadgeGridProps {
    badges: Badge[];
    earnedBadgeIds: Set<string>;
}

export function BadgeGrid({ badges, earnedBadgeIds }: BadgeGridProps) {
    const theme = useThemeStore((state) => state.theme);
    const isHK = theme === 'hellokitty';

    // Group badges by category
    const categories = {
        points: badges.filter((b) => b.category === 'points'),
        streak: badges.filter((b) => b.category === 'streak'),
        progress: badges.filter((b) => b.category === 'progress'),
        special: badges.filter((b) => b.category === 'special'),
    };

    const categoryLabels = {
        points: isHK ? '✨ Punkty' : 'Punkty',
        streak: isHK ? '🔥 Seria' : 'Seria',
        progress: isHK ? '📚 Postęp' : 'Postęp',
        special: isHK ? '🌟 Specjalne' : 'Specjalne',
    };

    return (
        <div className="space-y-6">
            {(Object.keys(categories) as Array<keyof typeof categories>).map((category) => (
                <div key={category}>
                    <h3 className={`text-sm font-bold uppercase tracking-wide mb-3 ${isHK ? 'text-[hsl(350,50%,50%)]' : 'text-gray-500 dark:text-gray-400'}`}>
                        {categoryLabels[category]}
                    </h3>
                    <div className="flex flex-wrap gap-4">
                        {categories[category].map((badge) => (
                            <BadgeDisplay
                                key={badge.id}
                                badge={badge}
                                earned={earnedBadgeIds.has(badge.id)}
                                showDescription
                                size="md"
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// New badge notification component
interface NewBadgeNotificationProps {
    badge: Badge;
    show: boolean;
    onClose: () => void;
}

export function NewBadgeNotification({ badge, show, onClose }: NewBadgeNotificationProps) {
    const theme = useThemeStore((state) => state.theme);
    const isHK = theme === 'hellokitty';

    if (!show) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div
                className={`
                    pointer-events-auto p-8 rounded-3xl shadow-2xl text-center
                    animate-bounce-in
                    ${isHK
                        ? 'bg-white border-4 border-[hsl(350,80%,85%)]'
                        : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700'
                    }
                `}
            >
                <div className="mb-4">
                    <span className="text-lg font-medium text-gray-500 dark:text-gray-400">
                        {isHK ? '🎀 Nowa odznaka! 🎀' : 'Nowa odznaka!'}
                    </span>
                </div>

                <BadgeDisplay badge={badge} earned size="lg" animate />

                <div className="mt-4 space-y-1">
                    <h3 className={`text-xl font-bold ${isHK ? 'text-[hsl(350,50%,40%)]' : 'text-gray-800 dark:text-white'}`}>
                        {badge.namePl}
                    </h3>
                    <p className={`text-sm ${isHK ? 'text-[hsl(350,30%,55%)]' : 'text-gray-500 dark:text-gray-400'}`}>
                        {badge.descriptionPl}
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className={`
                        mt-6 px-6 py-2 rounded-full font-medium transition-all
                        ${isHK
                            ? 'bg-gradient-to-r from-[hsl(350,90%,75%)] to-[hsl(330,85%,70%)] text-white hover:from-[hsl(350,90%,70%)] hover:to-[hsl(330,85%,65%)]'
                            : 'bg-gradient-to-r from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)] text-white hover:from-[hsl(16,90%,55%)] hover:to-[hsl(350,80%,60%)]'
                        }
                    `}
                >
                    {isHK ? 'Super! ✨' : 'Super!'}
                </button>
            </div>

            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/30 -z-10"
                onClick={onClose}
            />
        </div>
    );
}
