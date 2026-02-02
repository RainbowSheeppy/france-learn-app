import axios from 'axios'

const getApiBaseUrl = () => {
    let url = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`
    }
    return url
}

const API_BASE_URL = getApiBaseUrl()

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor - dodaje token do każdego requesta
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor - obsługa błędów 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Usuń token i przekieruj na login
            localStorage.removeItem('auth_token')
            localStorage.removeItem('user')
            window.location.href = '/login'
        }
        return Promise.reject(error)
    }
)

// Language Types
export type TargetLanguage = 'fr' | 'en'

export interface LanguageConfig {
    name: string
    name_en: string
    code: string
    flag: string
}

export interface LanguageResponse {
    language: TargetLanguage
    config: LanguageConfig
}

// API Endpoints Types
export interface LoginCredentials {
    username: string // email
    password: string
}

export interface TokenResponse {
    access_token: string
    token_type: string
}

export interface User {
    id: string
    name: string
    email: string
    is_superuser: boolean
    created_at: string
    updated_at: string
}

export interface Group {
    id: string
    name: string
    description?: string
    language?: TargetLanguage
    created_at?: string
    updated_at?: string
    total_items?: number
}

export interface GroupCreate {
    name: string
    description?: string
    language?: TargetLanguage
}

export interface GroupUpdate {
    name?: string;
    description?: string;
    language?: TargetLanguage;
}

export interface Fiszka {
    id: string
    text_pl: string
    text_target: string
    image_url: string | null
    learned?: boolean
    half_learned?: boolean
    mistake?: boolean
    group_id: string | null
    created_at?: string
    updated_at?: string
}

export interface FiszkaCreate {
    text_pl: string
    text_target: string
    image_url?: string | null
    group_id?: string | null
}

export interface FiszkaUpdate {
    text_pl?: string
    text_target?: string
    image_url?: string | null
    group_id?: string | null
}

// Translate Types
export interface TranslateItem {
    id: string;
    text_pl: string;
    text_target: string;
    category?: string | null;
    group_id: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface TranslateItemCreate {
    text_pl: string; // for Pl->Target this is Question. For Target->Pl this is Answer.
    text_target: string; // for Pl->Target this is Answer. For Target->Pl this is Question.
    category?: string | null;
    group_id?: string | null;
}

export interface TranslateItemUpdate {
    text_pl?: string;
    text_target?: string;
    category?: string | null;
    group_id?: string | null;
}


// AI Generation Types
export interface GenerateRequest {
    level: string; // A1, A2, etc.
    count: number;
    category?: string; // vocabulary, grammar, phrases, idioms, verbs
}

export interface GeneratedItem {
    text_pl: string;
    text_target: string;
    category?: string | null;
}

export interface BatchCreatePlToTarget {
    items: TranslateItemCreate[];
    group_id: string;
}

export interface BatchCreateTargetToPl {
    items: TranslateItemCreate[];
    group_id: string;
}

// AI Verification Types
export interface AIVerifyRequest {
    task_type: 'translate_pl_to_target' | 'translate_target_to_pl' | 'translate_pl_fr' | 'translate_fr_pl' | 'fill_blank';
    item_id: string;
    user_answer: string;
    question: string;
    expected_answer: string;
}

export interface AIVerifyResponse {
    is_correct: boolean;
    explanation: string;
    answer_added: boolean;
}

export const aiApi = {
    generate: async (level: string, count: number, category?: string): Promise<GeneratedItem[]> => {
        const response = await api.post<GeneratedItem[]>('/api/ai/generate', { level, count, category })
        return response.data
    },

    verifyAnswer: async (data: AIVerifyRequest): Promise<AIVerifyResponse> => {
        const response = await api.post<AIVerifyResponse>('/api/ai/verify-answer', data)
        return response.data
    }
}

// Auth API
export const authApi = {
    login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
        // FastAPI OAuth2PasswordRequestForm oczekuje form-data
        const formData = new FormData()
        formData.append('username', credentials.username)
        formData.append('password', credentials.password)

        const response = await api.post<TokenResponse>('/auth/login', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })
        return response.data
    },

    logout: async () => {
        await api.post('/auth/logout')
    },

    getCurrentUser: async (): Promise<User> => {
        const response = await api.get<User>('/auth/me')
        return response.data
    },
}

// Groups API (Now Fiszki Groups)
export const groupsApi = {
    getAll: async (language?: TargetLanguage): Promise<Group[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<Group[]>('/fiszki/groups/', { params })
        return response.data
    },

    getOne: async (id: string): Promise<Group> => {
        const response = await api.get<Group>(`/fiszki/groups/${id}`)
        return response.data
    },

    create: async (data: GroupCreate): Promise<Group> => {
        const response = await api.post<Group>('/fiszki/groups/', data)
        return response.data
    },

    update: async (id: string, data: GroupUpdate): Promise<Group> => {
        const response = await api.put<Group>(`/fiszki/groups/${id}`, data)
        return response.data
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/fiszki/groups/${id}`)
    },
}

// Fiszki API
export const fiszkiApi = {
    getAll: async (groupId?: string): Promise<Fiszka[]> => {
        const params = groupId ? { group_id: groupId } : undefined
        const response = await api.get<Fiszka[]>('/fiszki/', { params })
        return response.data
    },

    getOne: async (id: string): Promise<Fiszka> => {
        const response = await api.get<Fiszka>(`/fiszki/${id}`)
        return response.data
    },

    create: async (data: FiszkaCreate): Promise<Fiszka> => {
        const response = await api.post<Fiszka>('/fiszki/', data)
        return response.data
    },

    update: async (id: string, data: FiszkaUpdate): Promise<Fiszka> => {
        const response = await api.put<Fiszka>(`/fiszki/${id}`, data)
        return response.data
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/fiszki/${id}`)
    },

    importFromCsv: async (groupId: string, file: File): Promise<{ message: string }> => {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post<{ message: string }>(`/fiszki/import?group_id=${groupId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    },
}

// Translate PL -> FR API
export const translatePlFrApi = {
    getGroups: async (language?: TargetLanguage): Promise<Group[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<Group[]>('/translate-pl-fr/groups/', { params })
        return response.data
    },

    createGroup: async (data: GroupCreate): Promise<Group> => {
        const response = await api.post<Group>('/translate-pl-fr/groups/', data)
        return response.data
    },

    deleteGroup: async (id: string): Promise<void> => {
        await api.delete(`/translate-pl-fr/groups/${id}`)
    },

    updateGroup: async (id: string, data: GroupUpdate): Promise<Group> => {
        const response = await api.put<Group>(`/translate-pl-fr/groups/${id}`, data)
        return response.data
    },

    getAllItems: async (groupId: string): Promise<TranslateItem[]> => {
        const response = await api.get<TranslateItem[]>('/translate-pl-fr/items/', { params: { group_id: groupId } })
        return response.data
    },

    createItem: async (data: TranslateItemCreate): Promise<TranslateItem> => {
        const response = await api.post<TranslateItem>('/translate-pl-fr/items/', data)
        return response.data
    },

    updateItem: async (id: string, data: TranslateItemUpdate): Promise<TranslateItem> => {
        const response = await api.put<TranslateItem>(`/translate-pl-fr/items/${id}`, data)
        return response.data
    },

    deleteItem: async (id: string): Promise<void> => {
        await api.delete(`/translate-pl-fr/items/${id}`)
    },

    importFromCsv: async (groupId: string, file: File): Promise<{ message: string }> => {
        const formData = new FormData()
        formData.append('file', file)
        const response = await api.post<{ message: string }>(`/translate-pl-fr/import?group_id=${groupId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    },

    batchCreate: async (data: BatchCreatePlToTarget): Promise<TranslateItem[]> => {
        const response = await api.post<TranslateItem[]>('/translate-pl-fr/items/batch', data)
        return response.data
    }
}

// Translate FR -> PL API
export const translateFrPlApi = {
    getGroups: async (language?: TargetLanguage): Promise<Group[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<Group[]>('/translate-fr-pl/groups/', { params })
        return response.data
    },

    createGroup: async (data: GroupCreate): Promise<Group> => {
        const response = await api.post<Group>('/translate-fr-pl/groups/', data)
        return response.data
    },

    updateGroup: async (id: string, data: GroupUpdate): Promise<Group> => {
        const response = await api.put<Group>(`/translate-fr-pl/groups/${id}`, data)
        return response.data
    },

    deleteGroup: async (id: string): Promise<void> => {
        await api.delete(`/translate-fr-pl/groups/${id}`)
    },

    getAllItems: async (groupId: string): Promise<TranslateItem[]> => {
        const response = await api.get<TranslateItem[]>('/translate-fr-pl/items/', { params: { group_id: groupId } })
        return response.data
    },

    createItem: async (data: TranslateItemCreate): Promise<TranslateItem> => {
        const response = await api.post<TranslateItem>('/translate-fr-pl/items/', data)
        return response.data
    },

    updateItem: async (id: string, data: TranslateItemUpdate): Promise<TranslateItem> => {
        const response = await api.put<TranslateItem>(`/translate-fr-pl/items/${id}`, data)
        return response.data
    },

    deleteItem: async (id: string): Promise<void> => {
        await api.delete(`/translate-fr-pl/items/${id}`)
    },

    importFromCsv: async (groupId: string, file: File): Promise<{ message: string }> => {
        const formData = new FormData()
        formData.append('file', file)
        const response = await api.post<{ message: string }>(`/translate-fr-pl/import?group_id=${groupId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    },

    batchCreate: async (data: BatchCreateTargetToPl): Promise<TranslateItem[]> => {
        const response = await api.post<TranslateItem[]>('/translate-fr-pl/items/batch', data)
        return response.data
    }
}


// ==========================================
// Guess Object (Zgadnij przedmiot) Types & API
// ==========================================

export interface GuessObjectItem {
    id: string
    description_target: string
    description_pl?: string | null
    answer_target: string
    answer_pl?: string | null
    category?: string | null
    hint?: string | null
    group_id: string | null
    created_at?: string
    updated_at?: string
}

export interface GuessObjectItemCreate {
    description_target: string
    description_pl?: string | null
    answer_target: string
    answer_pl?: string | null
    category?: string | null
    hint?: string | null
    group_id?: string | null
}

export interface GuessObjectItemUpdate {
    description_target?: string
    description_pl?: string | null
    answer_target?: string
    answer_pl?: string | null
    category?: string | null
    hint?: string | null
    group_id?: string | null
}

export interface GeneratedGuessObjectItem {
    description_target: string
    description_pl?: string | null
    answer_target: string
    answer_pl?: string | null
    category?: string | null
    hint?: string | null
}

export interface BatchCreateGuessObject {
    items: GuessObjectItemCreate[]
    group_id: string
}

export const guessObjectApi = {
    getGroups: async (language?: TargetLanguage): Promise<Group[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<Group[]>('/guess-object/groups/', { params })
        return response.data
    },

    createGroup: async (data: GroupCreate): Promise<Group> => {
        const response = await api.post<Group>('/guess-object/groups/', data)
        return response.data
    },

    updateGroup: async (id: string, data: GroupUpdate): Promise<Group> => {
        const response = await api.put<Group>(`/guess-object/groups/${id}`, data)
        return response.data
    },

    deleteGroup: async (id: string): Promise<void> => {
        await api.delete(`/guess-object/groups/${id}`)
    },

    getAllItems: async (groupId: string): Promise<GuessObjectItem[]> => {
        const response = await api.get<GuessObjectItem[]>('/guess-object/items/', { params: { group_id: groupId } })
        return response.data
    },

    createItem: async (data: GuessObjectItemCreate): Promise<GuessObjectItem> => {
        const response = await api.post<GuessObjectItem>('/guess-object/items/', data)
        return response.data
    },

    updateItem: async (id: string, data: GuessObjectItemUpdate): Promise<GuessObjectItem> => {
        const response = await api.put<GuessObjectItem>(`/guess-object/items/${id}`, data)
        return response.data
    },

    deleteItem: async (id: string): Promise<void> => {
        await api.delete(`/guess-object/items/${id}`)
    },

    importFromCsv: async (groupId: string, file: File): Promise<{ message: string }> => {
        const formData = new FormData()
        formData.append('file', file)
        const response = await api.post<{ message: string }>(`/guess-object/import?group_id=${groupId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    },

    batchCreate: async (data: BatchCreateGuessObject): Promise<GuessObjectItem[]> => {
        const response = await api.post<GuessObjectItem[]>('/guess-object/items/batch', data)
        return response.data
    },

    generateAI: async (level: string, count: number): Promise<GeneratedGuessObjectItem[]> => {
        const response = await api.post<GeneratedGuessObjectItem[]>('/api/ai/generate-guess-object', { level, count })
        return response.data
    }
}


// ==========================================
// Fill Blank (Uzupełnij zdanie) Types & API
// ==========================================

export interface FillBlankItem {
    id: string
    sentence_with_blank: string
    sentence_pl?: string | null
    answer: string
    full_sentence?: string | null
    hint?: string | null
    grammar_focus?: string | null
    group_id: string | null
    created_at?: string
    updated_at?: string
}

export interface FillBlankItemCreate {
    sentence_with_blank: string
    sentence_pl?: string | null
    answer: string
    full_sentence?: string | null
    hint?: string | null
    grammar_focus?: string | null
    group_id?: string | null
}

export interface FillBlankItemUpdate {
    sentence_with_blank?: string
    sentence_pl?: string | null
    answer?: string
    full_sentence?: string | null
    hint?: string | null
    grammar_focus?: string | null
    group_id?: string | null
}

export interface GeneratedFillBlankItem {
    sentence_with_blank: string
    sentence_pl?: string | null
    answer: string
    full_sentence: string
    hint?: string | null
    grammar_focus?: string | null
}

export interface BatchCreateFillBlank {
    items: FillBlankItemCreate[]
    group_id: string
}

export const fillBlankApi = {
    getGroups: async (language?: TargetLanguage): Promise<Group[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<Group[]>('/fill-blank/groups/', { params })
        return response.data
    },

    createGroup: async (data: GroupCreate): Promise<Group> => {
        const response = await api.post<Group>('/fill-blank/groups/', data)
        return response.data
    },

    updateGroup: async (id: string, data: GroupUpdate): Promise<Group> => {
        const response = await api.put<Group>(`/fill-blank/groups/${id}`, data)
        return response.data
    },

    deleteGroup: async (id: string): Promise<void> => {
        await api.delete(`/fill-blank/groups/${id}`)
    },

    getAllItems: async (groupId: string): Promise<FillBlankItem[]> => {
        const response = await api.get<FillBlankItem[]>('/fill-blank/items/', { params: { group_id: groupId } })
        return response.data
    },

    createItem: async (data: FillBlankItemCreate): Promise<FillBlankItem> => {
        const response = await api.post<FillBlankItem>('/fill-blank/items/', data)
        return response.data
    },

    updateItem: async (id: string, data: FillBlankItemUpdate): Promise<FillBlankItem> => {
        const response = await api.put<FillBlankItem>(`/fill-blank/items/${id}`, data)
        return response.data
    },

    deleteItem: async (id: string): Promise<void> => {
        await api.delete(`/fill-blank/items/${id}`)
    },

    importFromCsv: async (groupId: string, file: File): Promise<{ message: string }> => {
        const formData = new FormData()
        formData.append('file', file)
        const response = await api.post<{ message: string }>(`/fill-blank/import?group_id=${groupId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    },

    batchCreate: async (data: BatchCreateFillBlank): Promise<FillBlankItem[]> => {
        const response = await api.post<FillBlankItem[]>('/fill-blank/items/batch', data)
        return response.data
    },

    generateAI: async (level: string, count: number, grammarFocus?: string): Promise<GeneratedFillBlankItem[]> => {
        const response = await api.post<GeneratedFillBlankItem[]>('/api/ai/generate-fill-blank', {
            level,
            count,
            grammar_focus: grammarFocus
        })
        return response.data
    }
}



// ==========================================
// Gamification & Mini-games API
// ==========================================

export interface ScoreRequest {
    is_correct: boolean
    is_known: boolean
    level?: string | null
    item_id?: string | null
}

export interface ScoreResponse {
    points_delta: number
    new_total_points: number
    new_combo: number
    multiplier: number
    trigger_mini_game: boolean
    message?: string | null
}

export interface WordleCheckResponse {
    result: string[] // 'correct', 'present', 'absent'
}

export const gamificationApi = {
    submitScore: async (data: ScoreRequest): Promise<ScoreResponse> => {
        const response = await api.post<ScoreResponse>('/api/gamification/score', data)
        return response.data
    },

    getStats: async (): Promise<{ total_points: number, highest_combo: number, current_streak: number }> => {
        const response = await api.get('/user/profile/stats')
        return response.data
    }
}

// Dashboard Statistics Types
export interface ModeStats {
    total: number
    learned: number
}

export interface DashboardStats {
    total_points: number
    highest_combo: number
    current_streak: number
    fiszki: ModeStats
    translate_pl_fr: ModeStats
    translate_fr_pl: ModeStats
    guess_object: ModeStats
    fill_blank: ModeStats
    total_learned: number
    total_items: number
    level: string
    level_progress: number
}

export const dashboardApi = {
    getStats: async (): Promise<DashboardStats> => {
        const response = await api.get<DashboardStats>('/user/dashboard/stats')
        return response.data
    }
}

export const wordleApi = {
    start: async (level: string = 'A1'): Promise<{ target_word: string }> => {
        const response = await api.post<{ target_word: string }>('/minigame/wordle/start', { level })
        return response.data
    },

    check: async (target_word: string, guess: string): Promise<WordleCheckResponse> => {
        const response = await api.post<WordleCheckResponse>('/minigame/wordle/check', { target_word, guess })
        return response.data
    }
}

export interface GenerateContentResponse {
    success: boolean
    message: string
    groups_created: number
    items_created: number
}

export const adminApi = {
    generateInitialContent: async (groupCount?: number, itemsPerGroup?: number): Promise<GenerateContentResponse> => {
        const response = await api.post<GenerateContentResponse>('/api/admin/generate-initial-content', {
            group_count: groupCount,
            items_per_group: itemsPerGroup
        })
        return response.data
    }
}

// Language API
export const languageApi = {
    get: async (): Promise<LanguageResponse> => {
        const response = await api.get<LanguageResponse>('/user/language')
        return response.data
    },

    set: async (language: TargetLanguage): Promise<LanguageResponse> => {
        const response = await api.post<LanguageResponse>('/user/language', { language })
        return response.data
    }
}

// Study groups with language filter
export interface StudyGroup extends Group {
    total_items: number
    learned_items: number
    language: TargetLanguage
}

export const studyApi = {
    getFiszkiGroups: async (language?: TargetLanguage): Promise<StudyGroup[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<StudyGroup[]>('/study/fiszki/groups', { params })
        return response.data
    },

    getTranslatePlFrGroups: async (language?: TargetLanguage): Promise<StudyGroup[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<StudyGroup[]>('/study/translate-pl-fr/groups', { params })
        return response.data
    },

    getTranslateFrPlGroups: async (language?: TargetLanguage): Promise<StudyGroup[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<StudyGroup[]>('/study/translate-fr-pl/groups', { params })
        return response.data
    },

    getGuessObjectGroups: async (language?: TargetLanguage): Promise<StudyGroup[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<StudyGroup[]>('/study/guess-object/groups', { params })
        return response.data
    },

    getFillBlankGroups: async (language?: TargetLanguage): Promise<StudyGroup[]> => {
        const params = language ? { language } : undefined
        const response = await api.get<StudyGroup[]>('/study/fill-blank/groups', { params })
        return response.data
    },
}
