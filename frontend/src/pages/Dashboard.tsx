import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function Dashboard() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const isAdmin = user?.is_superuser;

    useEffect(() => {
        // Redirect based on user role
        if (isAdmin) {
            navigate('/admin/dashboard', { replace: true });
        } else {
            navigate('/student/dashboard', { replace: true });
        }
    }, [isAdmin, navigate]);

    // Show loading while redirecting
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center space-y-4 animate-fade-in">
                <div className="w-12 h-12 border-4 border-[hsl(16,90%,60%)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[hsl(220,20%,45%)] font-medium">Przekierowuję...</p>
            </div>
        </div>
    );
}
