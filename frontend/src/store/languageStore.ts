import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'

export type TargetLanguage = 'fr' | 'en'

export interface LanguageConfig {
    name: string
    name_en: string
    code: string
    flag: string
}

interface LanguageState {
    activeLanguage: TargetLanguage
    config: LanguageConfig
    isLoading: boolean
    setLanguage: (lang: TargetLanguage) => Promise<void>
    fetchLanguage: () => Promise<void>
}

const DEFAULT_CONFIG: Record<TargetLanguage, LanguageConfig> = {
    fr: {
        name: 'francuski',
        name_en: 'French',
        code: 'FR',
        flag: '🇫🇷',
    },
    en: {
        name: 'angielski',
        name_en: 'English',
        code: 'EN',
        flag: '🇬🇧',
    },
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set, get) => ({
            activeLanguage: 'fr',
            config: DEFAULT_CONFIG.fr,
            isLoading: false,

            setLanguage: async (lang: TargetLanguage) => {
                set({ isLoading: true })
                try {
                    const response = await api.post<{ language: TargetLanguage; config: LanguageConfig }>(
                        '/user/language',
                        { language: lang }
                    )
                    set({
                        activeLanguage: response.data.language,
                        config: response.data.config,
                        isLoading: false,
                    })
                } catch (error) {
                    console.error('Failed to set language:', error)
                    // Fallback to local state update
                    set({
                        activeLanguage: lang,
                        config: DEFAULT_CONFIG[lang],
                        isLoading: false,
                    })
                }
            },

            fetchLanguage: async () => {
                set({ isLoading: true })
                try {
                    const response = await api.get<{ language: TargetLanguage; config: LanguageConfig }>(
                        '/user/language'
                    )
                    set({
                        activeLanguage: response.data.language,
                        config: response.data.config,
                        isLoading: false,
                    })
                } catch (error) {
                    console.error('Failed to fetch language:', error)
                    // Keep current state on error
                    set({ isLoading: false })
                }
            },
        }),
        {
            name: 'language-storage',
            partialize: (state) => ({
                activeLanguage: state.activeLanguage,
                config: state.config,
            }),
        }
    )
)

// Helper functions for language-aware display
export const getLanguageLabel = (lang: TargetLanguage): string => {
    return DEFAULT_CONFIG[lang].name
}

export const getLanguageFlag = (lang: TargetLanguage): string => {
    return DEFAULT_CONFIG[lang].flag
}

export const getAppTitle = (lang: TargetLanguage): string => {
    return lang === 'fr' ? 'Nauka Francuskiego' : 'Nauka Angielskiego'
}

export const getTranslateFromPLLabel = (lang: TargetLanguage): string => {
    return lang === 'fr' ? 'PL → FR' : 'PL → EN'
}

export const getTranslateToPLLabel = (lang: TargetLanguage): string => {
    return lang === 'fr' ? 'FR → PL' : 'EN → PL'
}
