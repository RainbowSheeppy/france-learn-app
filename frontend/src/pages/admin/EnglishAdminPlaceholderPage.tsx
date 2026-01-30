import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction, ArrowLeft } from 'lucide-react';

interface EnglishAdminPlaceholderPageProps {
    title: string;
    description: string;
}

export default function EnglishAdminPlaceholderPage({ title, description }: EnglishAdminPlaceholderPageProps) {
    const navigate = useNavigate();

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in px-6 py-6">
            <Button
                variant="ghost"
                onClick={() => navigate('/admin/dashboard')}
                className="gap-2"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>

            <Card className="border-2 border-dashed border-amber-300 bg-amber-50/50">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-amber-100 p-4 rounded-full w-fit mb-4">
                        <Construction className="w-12 h-12 text-amber-600" />
                    </div>
                    <CardTitle className="text-3xl text-amber-800">{title}</CardTitle>
                    <CardDescription className="text-lg text-amber-700">
                        {description}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-amber-600">
                        This feature is coming soon! The English content management pages are under development.
                    </p>
                    <p className="text-sm text-amber-500">
                        For now, you can manage English content via the API endpoints directly,
                        or use the French admin pages as a reference.
                    </p>
                    <div className="flex gap-4 justify-center pt-4">
                        <Button
                            variant="outline"
                            onClick={() => navigate('/admin/dashboard')}
                        >
                            Go to Dashboard
                        </Button>
                        <Button
                            onClick={() => navigate('/student/dashboard')}
                            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                        >
                            Try Learning Mode
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
