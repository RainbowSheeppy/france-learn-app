import { create } from 'zustand';
import { gamificationApi } from '../lib/api';

interface GamificationState {
    points: number;
    highestCombo: number;
    currentStreak: number;
    fetchStats: () => Promise<void>;
    updateStats: (newTotalPoints: number, newCombo: number) => void;
}

export const useGamificationStore = create<GamificationState>((set) => ({
    points: 0,
    highestCombo: 0,
    currentStreak: 0,
    fetchStats: async () => {
        try {
            const data = await gamificationApi.getStats();
            set({
                points: Math.max(0, data.total_points),
                highestCombo: data.highest_combo,
                currentStreak: data.current_streak
            });
        } catch (e) {
            // console.error("Failed to fetch gamification stats");
        }
    },
    updateStats: (newTotalPoints, newCombo) => set({
        points: Math.max(0, newTotalPoints),
        currentStreak: newCombo
    })
}));
