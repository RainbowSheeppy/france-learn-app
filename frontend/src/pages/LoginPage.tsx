import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Lock, Mail, AlertCircle } from 'lucide-react'

export default function LoginPage() {
    const navigate = useNavigate()
    const login = useAuthStore((state) => state.login)

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // Login i pobierz token
            const tokenResponse = await authApi.login({ username: email, password })

            // Zapisz token w store (potrzebny do następnego zapytania)
            login(tokenResponse.access_token, {
                id: '',
                name: '',
                email: email,
                is_superuser: false,
                created_at: '',
                updated_at: ''
            })

            // Pobierz dane użytkownika (już z tokenem w headers)
            const currentUser = await authApi.getCurrentUser()

            // Zaktualizuj store z pełnymi danymi
            login(tokenResponse.access_token, currentUser)

            // Redirect do dashboardu
            navigate('/dashboard')
        } catch (err: any) {
            console.error('Login error:', err)
            setError(err.response?.data?.detail || 'Nieprawidłowy email lub hasło')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 p-4">
            <div className="w-full max-w-md animate-fade-in">
                <Card className="shadow-2xl border-0">
                    <CardHeader className="space-y-2 text-center pb-8">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-4">
                            <Lock className="w-8 h-8 text-white" />
                        </div>
                        <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            Witaj ponownie!
                        </CardTitle>
                        <CardDescription className="text-base">
                            Zaloguj się, aby kontynuować naukę
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2 animate-slide-up">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <p className="text-sm">{error}</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Email
                                </label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="twoj@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="h-12"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                                    <Lock className="w-4 h-4" />
                                    Hasło
                                </label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="h-12"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 text-base font-semibold mt-6"
                                disabled={loading}
                            >
                                {loading ? 'Logowanie...' : 'Zaloguj się'}
                            </Button>
                        </form>


                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
