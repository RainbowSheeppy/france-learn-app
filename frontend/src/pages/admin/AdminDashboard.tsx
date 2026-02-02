import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    BookOpen, Languages, MessageSquare, ArrowRight,
    Folder, HelpCircle, TextCursorInput, Shield, Gamepad2, Sparkles, Loader2
} from 'lucide-react';
import { WordleModal } from '@/components/WordleModal';
import GenerateContentDialog from '@/components/admin/GenerateContentDialog';
import { wordleApi, adminApi, dashboardApi, type DashboardStats } from '@/lib/api';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const { activeLanguage } = useLanguageStore();
    const [showWordle, setShowWordle] = useState(false);
    const [wordleTarget, setWordleTarget] = useState("");
    const [generating, setGenerating] = useState(false);
    const [generateMessage, setGenerateMessage] = useState<string | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [showGenerateDialog, setShowGenerateDialog] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await dashboardApi.getStats();
                setStats(data);
            } catch (err) {
                console.error("Failed to fetch admin stats", err);
            }
        };
        fetchStats();
    }, [activeLanguage]);

    const langName = activeLanguage === 'fr' ? 'francuski' : 'angielski';


    const managementSections = [
        {
            title: 'Zarządzanie treścią',
            items: [
                {
                    id: 'groups',
                    title: 'Grupy Fiszek',
                    description: 'Zarządzaj grupami i fiszkami',
                    icon: Folder,
                    path: '/admin/groups',
                    color: 'bg-gradient-to-br from-[hsl(16,90%,60%)] to-[hsl(16,85%,50%)]',
                },
                {
                    id: 'translate-pl-fr',
                    title: `Tłumaczenia PL → ${activeLanguage === 'fr' ? 'FR' : 'EN'}`,
                    description: `Grupy tłumaczeń polski-${langName}`,
                    icon: Languages,
                    path: '/admin/translate-pl-fr',
                    color: 'bg-gradient-to-br from-[hsl(260,60%,60%)] to-[hsl(260,50%,50%)]',
                },
                {
                    id: 'translate-fr-pl',
                    title: `Tłumaczenia ${activeLanguage === 'fr' ? 'FR' : 'EN'} → PL`,
                    description: `Grupy tłumaczeń ${langName}-polski`,
                    icon: MessageSquare,
                    path: '/admin/translate-fr-pl',
                    color: 'bg-gradient-to-br from-[hsl(180,50%,50%)] to-[hsl(180,45%,40%)]',
                },
                {
                    id: 'guess-object',
                    title: 'Zgadnij przedmiot',
                    description: 'Grupy zagadek słownych',
                    icon: HelpCircle,
                    path: '/admin/guess-object',
                    color: 'bg-gradient-to-br from-[hsl(45,90%,55%)] to-[hsl(30,85%,50%)]',
                },
                {
                    id: 'fill-blank',
                    title: 'Uzupełnij zdanie',
                    description: 'Grupy ćwiczeń z lukami',
                    icon: TextCursorInput,
                    path: '/admin/fill-blank',
                    color: 'bg-gradient-to-br from-[hsl(160,50%,50%)] to-[hsl(160,45%,40%)]',
                },
            ],
        },
    ];

    const quickActions = [
        {
            id: 'study-mode',
            title: 'Tryb nauki',
            description: 'Przejdź do widoku ucznia',
            icon: BookOpen,
            path: '/student/dashboard',
            variant: 'outline' as const,
        },
    ];
    const handleGenerateContent = async (groupCount: number, itemsPerGroup: number) => {
        if (generating) return;
        setGenerating(true);
        setGenerateMessage("Generowanie treści... (może potrwać 1-2 minuty)");
        try {
            const res = await adminApi.generateInitialContent(groupCount, itemsPerGroup);
            setGenerateMessage(`✓ ${res.message}`);
            setTimeout(() => setGenerateMessage(null), 5000);
            // Odśwież statystyki po wygenerowaniu
            const data = await dashboardApi.getStats();
            setStats(data);
        } catch (e) {
            setGenerateMessage("✗ Błąd generowania");
            setTimeout(() => setGenerateMessage(null), 5000);
        } finally {
            setGenerating(false);
        }
    };

    const handleStartWordle = async () => {
        try {
            const res = await wordleApi.start('B1');
            setWordleTarget(res.target_word);
            setShowWordle(true);
        } catch (e) {
            console.error("Failed to start Wordle", e);
        }
    };

    const handleWordleCheck = async (guess: string): Promise<string[]> => {
        const res = await wordleApi.check(wordleTarget, guess);
        return res.result;
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-[hsl(16,90%,60%)]" />
                        <span className="text-sm font-medium text-[hsl(16,90%,60%)]">Panel Administratora</span>
                    </div>
                    <h1 className="text-4xl font-bold text-[hsl(220,40%,13%)] tracking-tight">
                        Witaj, {user?.name}
                    </h1>
                    <p className="text-[hsl(220,20%,45%)]">
                        Zarządzaj materiałami do nauki i monitoruj postępy
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3 items-center">
                    <Button
                        variant="default"
                        onClick={() => setShowGenerateDialog(true)}
                        disabled={generating}
                        className="gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {generating ? 'Generowanie...' : 'Generuj treści AI'}
                    </Button>
                    <Button
                        variant="default"
                        onClick={handleStartWordle}
                        className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                        <Gamepad2 className="w-4 h-4" />
                        Testuj Wordle
                    </Button>
                    {generateMessage && (
                        <span className={`text-sm ${generateMessage.startsWith('✓') ? 'text-green-600' : generateMessage.startsWith('✗') ? 'text-red-600' : 'text-gray-600'}`}>
                            {generateMessage}
                        </span>
                    )}
                    {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <Button
                                key={action.id}
                                variant={action.variant}
                                onClick={() => navigate(action.path)}
                                className="gap-2"
                            >
                                <Icon className="w-4 h-4" />
                                {action.title}
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Wszystkie fiszki', value: stats?.fiszki.total ?? '—', icon: BookOpen, color: 'text-[hsl(16,90%,60%)]' },
                    { label: 'Grupy tłumaczeń', value: stats ? (stats.translate_pl_fr.total + stats.translate_fr_pl.total) : '—', icon: Languages, color: 'text-[hsl(260,60%,60%)]' },
                    { label: 'Ćwiczenia', value: stats?.fill_blank.total ?? '—', icon: TextCursorInput, color: 'text-[hsl(160,50%,55%)]' },
                    { label: 'Zagadki', value: stats?.guess_object.total ?? '—', icon: HelpCircle, color: 'text-[hsl(45,90%,55%)]' },
                ].map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <Card key={index} className="animate-card-entrance" style={{ animationDelay: `${index * 50}ms` }}>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-[hsl(220,20%,45%)]">{stat.label}</p>
                                        <p className="text-2xl font-bold text-[hsl(220,40%,13%)]">{stat.value}</p>
                                    </div>
                                    <Icon className={`w-8 h-8 ${stat.color} opacity-80`} />
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Management Sections */}
            {managementSections.map((section) => (
                <div key={section.title} className="space-y-4">
                    <h2 className="text-xl font-semibold text-[hsl(220,40%,13%)]">{section.title}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {section.items.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <Card
                                    key={item.id}
                                    className="group cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-card-entrance"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                    onClick={() => navigate(item.path)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-[hsl(220,20%,75%)] group-hover:text-[hsl(16,90%,60%)] group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <CardTitle className="text-lg mb-1">{item.title}</CardTitle>
                                        <CardDescription>{item.description}</CardDescription>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Wordle Modal */}
            <WordleModal
                isOpen={showWordle}
                onClose={() => setShowWordle(false)}
                onComplete={(success) => {
                    setShowWordle(false);
                    if (success) {
                        console.log("Admin Wordle: Won!");
                    }
                }}
                checkWord={handleWordleCheck}
            />

            {/* Generate Content Dialog */}
            <GenerateContentDialog
                open={showGenerateDialog}
                onOpenChange={setShowGenerateDialog}
                onGenerate={handleGenerateContent}
                loading={generating}
            />
        </div>
    );
}
