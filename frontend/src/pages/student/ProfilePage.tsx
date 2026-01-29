import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import { Trophy, Flame, Zap, User as UserIcon, Calendar, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ProfilePage: React.FC = () => {
    const user = useAuthStore((state) => state.user);
    const { points, highestCombo, currentStreak, fetchStats } = useGamificationStore();
    const navigate = useNavigate();

    useEffect(() => {
        fetchStats();
    }, []);

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto p-6 animate-fade-in">
            <Button variant="ghost" className="mb-6" onClick={() => navigate('/student/dashboard')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Wróć do Dashboard
            </Button>

            {/* Header / Profile Card */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 mb-8 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-pink-500" />

                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white shadow-lg">
                        <span className="text-4xl font-bold">{user.name.charAt(0).toUpperCase()}</span>
                    </div>

                    <div className="text-center md:text-left">
                        <h1 className="text-3xl font-bold dark:text-white mb-2">{user.name}</h1>
                        <p className="text-gray-500 dark:text-gray-400 flex items-center justify-center md:justify-start gap-2">
                            <UserIcon className="w-4 h-4" /> {user.email}
                        </p>
                        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 flex items-center justify-center md:justify-start gap-2">
                            <Calendar className="w-3 h-3" /> Dołączono: {new Date(user.created_at || Date.now()).toLocaleDateString()}
                        </p>
                    </div>

                    <div className="md:ml-auto bg-yellow-50 dark:bg-yellow-900/10 px-6 py-4 rounded-2xl border border-yellow-100 dark:border-yellow-800/30">
                        <p className="text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase tracking-wider mb-1">Całkowity Wynik</p>
                        <p className="text-4xl font-black text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                            <Trophy className="w-8 h-8" /> {points}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                        <Flame className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Aktualny Streak</p>
                        <p className="text-2xl font-bold dark:text-white">{currentStreak}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                        <Zap className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Najwyższe Combo</p>
                        <p className="text-2xl font-bold dark:text-white">x{highestCombo}</p>
                    </div>
                </div>
            </div>

            <div className="mt-8 text-center">
                <p className="text-sm text-gray-400">Graj dalej, aby odblokować więcej statystyk i odznak!</p>
            </div>
        </div>
    );
};

export default ProfilePage;
