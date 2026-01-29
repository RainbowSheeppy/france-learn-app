import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'hellokitty';

interface ThemeState {
    theme: ThemeMode;
    setTheme: (theme: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: 'light',
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: 'theme-storage',
        }
    )
);

// Apply theme to document
export function applyTheme(theme: ThemeMode) {
    const root = document.documentElement;

    // Remove all theme classes
    root.classList.remove('dark', 'theme-hellokitty', 'theme-light');

    // Apply new theme
    switch (theme) {
        case 'dark':
            root.classList.add('dark');
            break;
        case 'hellokitty':
            root.classList.add('theme-hellokitty');
            break;
        case 'light':
        default:
            root.classList.add('theme-light');
            break;
    }
}
