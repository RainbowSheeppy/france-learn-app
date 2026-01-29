import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import StudentDashboard from './pages/student/StudentDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import StudyPage from './pages/student/StudyPage'
import FiszkiAdminPage from './pages/admin/FiszkiAdminPage'
import GroupsPage from './pages/admin/GroupsPage'
import GroupDetailsPage from './pages/admin/GroupDetailsPage'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import TranslatePlFrGroupsPage from './pages/admin/TranslatePlFrGroupsPage'
import TranslatePlFrDetailsPage from './pages/admin/TranslatePlFrDetailsPage'
import TranslateFrPlGroupsPage from './pages/admin/TranslateFrPlGroupsPage'
import TranslateFrPlDetailsPage from './pages/admin/TranslateFrPlDetailsPage'
import TranslateStudyPage from './pages/student/TranslateStudyPage'
import GuessObjectGroupsPage from './pages/admin/GuessObjectGroupsPage'
import GuessObjectDetailsPage from './pages/admin/GuessObjectDetailsPage'
import FillBlankGroupsPage from './pages/admin/FillBlankGroupsPage'
import FillBlankDetailsPage from './pages/admin/FillBlankDetailsPage'
import GuessObjectStudyPage from './pages/student/GuessObjectStudyPage'
import FillBlankStudyPage from './pages/student/FillBlankStudyPage'
import ProfilePage from './pages/student/ProfilePage'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<LoginPage />} />

                <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/student/dashboard" element={<StudentDashboard />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/learn/fiszki" element={<StudyPage />} />
                    <Route path="/learn/translate-pl-fr" element={
                        <TranslateStudyPage
                            mode="pl-fr"
                            endpoints={{
                                groups: '/study/translate-pl-fr/groups',
                                session: '/study/translate-pl-fr/session',
                                progress: '/study/translate-pl-fr/progress'
                            }}
                            titles={{
                                page: 'Tłumaczenie PL → FR',
                                instruction: 'Wpisz po francusku',
                                langSource: 'Polski',
                                langTarget: 'Francuski'
                            }}
                            adminEditRoute="/admin/translate-pl-fr"
                        />
                    } />
                    <Route path="/learn/translate-fr-pl" element={
                        <TranslateStudyPage
                            mode="fr-pl"
                            endpoints={{
                                groups: '/study/translate-fr-pl/groups',
                                session: '/study/translate-fr-pl/session',
                                progress: '/study/translate-fr-pl/progress'
                            }}
                            titles={{
                                page: 'Tłumaczenie FR → PL',
                                instruction: 'Wpisz po polsku',
                                langSource: 'Francuski',
                                langTarget: 'Polski'
                            }}
                            adminEditRoute="/admin/translate-fr-pl"
                        />
                    } />
                    <Route path="/learn/guess-object" element={<GuessObjectStudyPage />} />
                    <Route path="/learn/fill-blank" element={<FillBlankStudyPage />} />
                </Route>

                <Route element={<AdminRoute />}>
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/fiszki" element={<FiszkiAdminPage />} />
                    <Route path="/admin/groups" element={<GroupsPage />} />
                    <Route path="/admin/groups/:groupId" element={<GroupDetailsPage />} />
                    <Route path="/admin/translate-pl-fr" element={<TranslatePlFrGroupsPage />} />
                    <Route path="/admin/translate-pl-fr/:groupId" element={<TranslatePlFrDetailsPage />} />
                    <Route path="/admin/translate-fr-pl" element={<TranslateFrPlGroupsPage />} />
                    <Route path="/admin/translate-fr-pl/:groupId" element={<TranslateFrPlDetailsPage />} />
                    <Route path="/admin/guess-object" element={<GuessObjectGroupsPage />} />
                    <Route path="/admin/guess-object/:groupId" element={<GuessObjectDetailsPage />} />
                    <Route path="/admin/fill-blank" element={<FillBlankGroupsPage />} />
                    <Route path="/admin/fill-blank/:groupId" element={<FillBlankDetailsPage />} />
                </Route>
            </Routes>
        </BrowserRouter>
    )
}

export default App
