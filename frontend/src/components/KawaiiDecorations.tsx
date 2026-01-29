import { useThemeStore } from '@/store/themeStore';

// Floating decorative elements for Hello Kitty theme
export function FloatingDecorations() {
    const theme = useThemeStore((state) => state.theme);

    if (theme !== 'hellokitty') return null;

    const decorations = [
        { emoji: '🌸', top: '10%', left: '5%', delay: '0s', size: '24px' },
        { emoji: '✨', top: '15%', right: '8%', delay: '0.5s', size: '18px' },
        { emoji: '💖', top: '25%', left: '3%', delay: '1s', size: '20px' },
        { emoji: '🎀', top: '35%', right: '5%', delay: '1.5s', size: '22px' },
        { emoji: '🌟', top: '50%', left: '2%', delay: '2s', size: '16px' },
        { emoji: '💕', top: '65%', right: '4%', delay: '2.5s', size: '18px' },
        { emoji: '🌸', top: '80%', left: '6%', delay: '3s', size: '20px' },
        { emoji: '✨', top: '85%', right: '7%', delay: '0.3s', size: '16px' },
    ];

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {decorations.map((deco, index) => (
                <span
                    key={index}
                    className="absolute hk-float-slow opacity-40"
                    style={{
                        top: deco.top,
                        left: deco.left,
                        right: deco.right,
                        fontSize: deco.size,
                        animationDelay: deco.delay,
                    }}
                >
                    {deco.emoji}
                </span>
            ))}
        </div>
    );
}

// Corner ribbon decoration
export function CornerRibbon({ position = 'top-right' }: { position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
    const theme = useThemeStore((state) => state.theme);

    if (theme !== 'hellokitty') return null;

    const positionClasses = {
        'top-left': 'top-2 left-2',
        'top-right': 'top-2 right-2',
        'bottom-left': 'bottom-2 left-2',
        'bottom-right': 'bottom-2 right-2',
    };

    return (
        <span className={`absolute ${positionClasses[position]} text-2xl hk-bounce-gentle`}>
            🎀
        </span>
    );
}

// Sparkle decoration for highlighting elements
export function SparkleDecoration({ className = '' }: { className?: string }) {
    const theme = useThemeStore((state) => state.theme);

    if (theme !== 'hellokitty') return null;

    return (
        <span className={`absolute text-sm hk-twinkle ${className}`}>
            ✨
        </span>
    );
}

// Hearts border decoration
export function HeartsBorder({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    const theme = useThemeStore((state) => state.theme);
    const isHK = theme === 'hellokitty';

    if (!isHK) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div className={`relative ${className}`}>
            {/* Corner hearts */}
            <span className="absolute -top-2 -left-2 text-lg">💖</span>
            <span className="absolute -top-2 -right-2 text-lg">💖</span>
            <span className="absolute -bottom-2 -left-2 text-lg">💖</span>
            <span className="absolute -bottom-2 -right-2 text-lg">💖</span>
            {children}
        </div>
    );
}

// Kawaii card wrapper
export function KawaiiCard({
    children,
    className = '',
    showRibbon = true,
    showStars = true,
}: {
    children: React.ReactNode;
    className?: string;
    showRibbon?: boolean;
    showStars?: boolean;
}) {
    const theme = useThemeStore((state) => state.theme);
    const isHK = theme === 'hellokitty';

    if (!isHK) {
        return <div className={className}>{children}</div>;
    }

    return (
        <div className={`relative hk-gradient-card rounded-2xl ${className}`}>
            {showRibbon && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl hk-bounce-gentle z-10">
                    🎀
                </span>
            )}
            {showStars && (
                <>
                    <span className="absolute top-2 left-2 text-sm hk-twinkle">✨</span>
                    <span className="absolute top-2 right-2 text-sm hk-twinkle" style={{ animationDelay: '1s' }}>✨</span>
                    <span className="absolute bottom-2 left-2 text-sm hk-twinkle" style={{ animationDelay: '0.5s' }}>🌸</span>
                    <span className="absolute bottom-2 right-2 text-sm hk-twinkle" style={{ animationDelay: '1.5s' }}>🌸</span>
                </>
            )}
            {children}
        </div>
    );
}

// Kawaii divider
export function KawaiiDivider() {
    const theme = useThemeStore((state) => state.theme);

    if (theme !== 'hellokitty') {
        return <hr className="border-gray-200 dark:border-gray-700 my-4" />;
    }

    return (
        <div className="flex items-center justify-center gap-2 my-6">
            <span className="text-sm opacity-60">🌸</span>
            <span className="text-lg">✨</span>
            <span className="text-xl">🎀</span>
            <span className="text-lg">✨</span>
            <span className="text-sm opacity-60">🌸</span>
        </div>
    );
}

// Export all components
export default {
    FloatingDecorations,
    CornerRibbon,
    SparkleDecoration,
    HeartsBorder,
    KawaiiCard,
    KawaiiDivider,
};
