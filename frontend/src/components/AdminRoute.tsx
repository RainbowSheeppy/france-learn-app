import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import AppLayout from './layout/AppLayout'

export default function AdminRoute() {
    const { isAuthenticated, user } = useAuthStore()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    if (!user?.is_superuser) {
        return <Navigate to="/dashboard" replace />
    }

    return (
        <AppLayout>
            <Outlet />
        </AppLayout>
    )
}
