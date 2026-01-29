import { ReactNode, useEffect } from 'react';
import { LogOut, Home, Shield, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore, applyTheme } from '@/store/themeStore';
import { Button } from '@/components/ui/button';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useGamificationStore } from '@/store/useGamificationStore';
import { GamifiedStatusWidget } from '@/components/GamifiedStatusWidget';

interface AppLayoutProps {
    children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { theme } = useThemeStore();
    const { points, currentStreak, fetchStats } = useGamificationStore();
    const isAdmin = user?.is_superuser;
    const isAdminPage = location.pathname.startsWith('/admin');

    // Apply theme on mount
    useEffect(() => {
        applyTheme(theme);
        if (user) {
            fetchStats();
        }
    }, [theme, user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen transition-colors duration-300
      bg-[hsl(48,100%,97%)]
      dark:bg-[hsl(220,40%,10%)]
      theme-hellokitty:bg-gradient-to-br theme-hellokitty:from-[hsl(350,100%,95%)] theme-hellokitty:to-[hsl(330,80%,92%)]">

            {/* Header */}
            <header className="border-b sticky top-0 z-50 backdrop-blur-sm transition-colors duration-300
        border-[hsl(45,20%,88%)] bg-white/80
        dark:border-[hsl(220,30%,20%)] dark:bg-[hsl(220,35%,15%)]/90
        theme-hellokitty:border-[hsl(350,70%,85%)] theme-hellokitty:bg-white/90">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-colors
                bg-gradient-to-br from-[hsl(16,90%,60%)] to-[hsl(350,80%,65%)]
                dark:from-[hsl(16,70%,50%)] dark:to-[hsl(350,60%,55%)]
                theme-hellokitty:from-[hsl(350,90%,75%)] theme-hellokitty:to-[hsl(330,85%,70%)]">
                                <span className="text-white text-lg">🇫🇷</span>
                            </div>
                            <h1 className="text-xl font-bold transition-colors
                text-[hsl(220,40%,13%)]
                dark:text-white
                theme-hellokitty:text-[hsl(350,60%,45%)]">
                                Nauka Francuskiego
                            </h1>
                        </div>

                        {/* Navigation & User */}
                        <div className="flex items-center gap-3">

                            {/* Gamification Stats */}
                            {user && (
                                <div className="hidden sm:flex items-center mr-2">
                                    <GamifiedStatusWidget points={points} currentStreak={currentStreak} />
                                </div>
                            )}

                            {/* Theme Switcher */}
                            <ThemeSwitcher />

                            {/* User Info */}
                            {user && (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors
                  bg-[hsl(48,100%,97%)] border-[hsl(45,20%,88%)]
                  dark:bg-[hsl(220,30%,20%)] dark:border-[hsl(220,30%,30%)]
                  theme-hellokitty:bg-white theme-hellokitty:border-[hsl(350,80%,85%)]">
                                    {isAdmin ? (
                                        <Shield className="w-4 h-4 text-[hsl(16,90%,60%)] dark:text-[hsl(16,80%,65%)]" />
                                    ) : (
                                        <Sparkles className="w-4 h-4 text-[hsl(260,60%,70%)] theme-hellokitty:text-[hsl(350,80%,65%)]" />
                                    )}
                                    <span className="text-sm font-medium transition-colors
                    text-[hsl(220,40%,13%)]
                    dark:text-white
                    theme-hellokitty:text-[hsl(350,50%,40%)]">
                                        {user.name}
                                    </span>
                                </div>
                            )}

                            {/* Dashboard Button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(isAdmin ? '/admin/dashboard' : '/student/dashboard')}
                                className="transition-colors
                  text-[hsl(220,30%,35%)] hover:text-[hsl(16,90%,60%)] hover:bg-[hsl(16,90%,95%)]
                  dark:text-[hsl(220,20%,70%)] dark:hover:text-[hsl(16,80%,65%)] dark:hover:bg-[hsl(220,30%,20%)]"
                            >
                                <Home className="w-4 h-4 mr-2" />
                                Dashboard
                            </Button>

                            {/* Admin Toggle (for admins only) */}
                            {isAdmin && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(isAdminPage ? '/student/dashboard' : '/admin/dashboard')}
                                    className="transition-colors
                    text-[hsl(220,30%,35%)] hover:text-[hsl(260,60%,60%)] hover:bg-[hsl(260,60%,95%)]
                    dark:text-[hsl(220,20%,70%)] dark:hover:text-[hsl(260,60%,70%)] dark:hover:bg-[hsl(220,30%,20%)]"
                                >
                                    {isAdminPage ? (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Tryb Ucznia
                                        </>
                                    ) : (
                                        <>
                                            <Shield className="w-4 h-4 mr-2" />
                                            Panel Admin
                                        </>
                                    )}
                                </Button>
                            )}

                            {/* Logout */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleLogout}
                                className="transition-colors
                  border-[hsl(45,20%,88%)] text-[hsl(220,30%,35%)] hover:bg-[hsl(350,80%,95%)] hover:text-[hsl(350,80%,45%)] hover:border-[hsl(350,80%,70%)]
                  dark:border-[hsl(220,30%,30%)] dark:text-[hsl(220,20%,70%)] dark:hover:bg-[hsl(350,60%,30%)] dark:hover:text-white"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Wyloguj
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="border-t mt-auto py-6 backdrop-blur-sm transition-colors
        border-[hsl(45,20%,88%)] bg-white/60
        dark:border-[hsl(220,30%,20%)] dark:bg-[hsl(220,35%,12%)]/80
        theme-hellokitty:border-[hsl(350,70%,88%)] theme-hellokitty:bg-white/70">
                <div className="container mx-auto px-4 text-center text-sm transition-colors
          text-[hsl(220,20%,55%)]
          dark:text-[hsl(220,20%,60%)]
          theme-hellokitty:text-[hsl(350,40%,55%)]">
                    <p>© 2026 Nauka Francuskiego • Ucz się z przyjemnością 🥐</p>
                </div>
            </footer>
        </div>
    );
}
