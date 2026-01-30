import { useLanguageStore, TargetLanguage } from '@/store/languageStore'
import { useThemeStore } from '@/store/themeStore'
import { Globe } from 'lucide-react'

const LANGUAGES: { value: TargetLanguage; label: string; flag: string }[] = [
    { value: 'fr', label: 'Francuski', flag: '🇫🇷' },
    { value: 'en', label: 'Angielski', flag: '🇬🇧' },
]

export default function LanguageSwitcher() {
    const { activeLanguage, setLanguage, isLoading } = useLanguageStore()
    const { theme } = useThemeStore()
    const isHelloKitty = theme === 'hellokitty'

    const handleLanguageChange = async (lang: TargetLanguage) => {
        if (lang !== activeLanguage && !isLoading) {
            await setLanguage(lang)
            // Refresh the page to update all language-dependent content
            window.location.reload()
        }
    }

    return (
        <div className={`flex items-center gap-1 p-1 rounded-full border transition-colors ${isHelloKitty
            ? 'bg-white border-[hsl(350,80%,85%)]'
            : 'bg-[hsl(48,100%,97%)] border-[hsl(45,20%,88%)] dark:bg-[hsl(220,30%,20%)] dark:border-[hsl(220,30%,30%)]'
            }`}>
            <Globe className={`w-4 h-4 mx-1 ${isHelloKitty
                ? 'text-[hsl(350,60%,60%)]'
                : 'text-[hsl(220,30%,50%)] dark:text-[hsl(220,20%,60%)]'
                }`} />
            {LANGUAGES.map((lang) => (
                <button
                    key={lang.value}
                    onClick={() => handleLanguageChange(lang.value)}
                    disabled={isLoading}
                    className={`
                        flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium
                        transition-all duration-200
                        ${activeLanguage === lang.value
                            ? isHelloKitty
                                ? 'bg-gradient-to-r from-[hsl(350,90%,75%)] to-[hsl(330,85%,70%)] text-white shadow-sm'
                                : 'bg-gradient-to-r from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)] text-white shadow-sm'
                            : isHelloKitty
                                ? 'text-[hsl(350,40%,50%)] hover:bg-[hsl(350,80%,95%)]'
                                : 'text-[hsl(220,30%,40%)] hover:bg-[hsl(45,30%,93%)] dark:text-[hsl(220,20%,70%)] dark:hover:bg-[hsl(220,30%,25%)]'
                        }
                        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    title={lang.label}
                >
                    <span className="text-base">{lang.flag}</span>
                    <span className="hidden sm:inline">{lang.value.toUpperCase()}</span>
                </button>
            ))}
        </div>
    )
}
