import { Sun, Moon, Sparkles } from 'lucide-react';
import { useThemeStore, applyTheme, type ThemeMode } from '@/store/themeStore';
import { useEffect } from 'react';

const themes: { id: ThemeMode; label: string; icon: typeof Sun; emoji: string }[] = [
    { id: 'light', label: 'Jasny', icon: Sun, emoji: '☀️' },
    { id: 'dark', label: 'Ciemny', icon: Moon, emoji: '🌙' },
    { id: 'hellokitty', label: 'Hello Kitty', icon: Sparkles, emoji: '🎀' },
];

export default function ThemeSwitcher() {
    const { theme, setTheme } = useThemeStore();

    // Apply theme on mount and when it changes
    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const currentIndex = themes.findIndex(t => t.id === theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];

    return (
        <button
            onClick={() => setTheme(nextTheme.id)}
            className="flex items-center gap-2 px-3 py-2 rounded-full border transition-all duration-300 hover:scale-105
        border-[hsl(45,20%,85%)] bg-white/80 hover:bg-white
        dark:border-[hsl(220,30%,30%)] dark:bg-[hsl(220,35%,20%)] dark:hover:bg-[hsl(220,35%,25%)]
        theme-hellokitty:border-[hsl(350,80%,80%)] theme-hellokitty:bg-white/90"
            title={`Zmień na: ${nextTheme.label}`}
        >
            <span className="text-lg">{themes[currentIndex].emoji}</span>
            <span className="text-xs font-medium hidden sm:inline
        text-[hsl(220,30%,40%)]
        dark:text-[hsl(220,20%,70%)]">
                {themes[currentIndex].label}
            </span>
        </button>
    );
}
