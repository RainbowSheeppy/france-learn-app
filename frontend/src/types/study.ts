export interface StudyGroup {
    id: string;
    name: string;
    description?: string;
    language?: 'fr' | 'en'; // Target language for this group
    total_fiszki?: number; // legacy for fiszki
    learned_fiszki?: number; // legacy for fiszki
    total_items?: number; // for translation modes
    learned_items?: number; // for translation modes
    updated_at?: string; // ISO date string for modification date
}

export interface StudyFlashcard {
    id: string;
    text_pl: string;
    text_target: string; // The correct answer
    image_url?: string;
    // We don't need internal learned status here as backend filters it, 
    // but useful for tracking session state if needed.
}

export interface StudySessionStats {
    correct: number;
    wrong: number;
    skipped: number;
    startTime: number;
    endTime?: number;
}
