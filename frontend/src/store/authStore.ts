import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../lib/api'

interface AuthState {
    user: User | null
    token: string | null
    isAuthenticated: boolean

    login: (token: string, user: User) => void
    logout: () => void
    setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,

            login: (token: string, user: User) => {
                localStorage.setItem('auth_token', token)
                set({ token, user, isAuthenticated: true })
            },

            logout: () => {
                localStorage.removeItem('auth_token')
                set({ token: null, user: null, isAuthenticated: false })
            },

            setUser: (user: User) => {
                set({ user })
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
