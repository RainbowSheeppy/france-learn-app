
import React, { createContext, useContext, useState } from 'react';

export type LanguageMode = 'PL-FR' | 'PL-EN';

interface LanguageContextType {
    mode: LanguageMode;
    setMode: (mode: LanguageMode) => void;
    isEnglish: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Try to load from local storage
    const [mode, setModeState] = useState<LanguageMode>(() => {
        const saved = localStorage.getItem('language_mode');
        return (saved === 'PL-EN' || saved === 'PL-FR') ? saved : 'PL-FR';
    });

    const setMode = (newMode: LanguageMode) => {
        setModeState(newMode);
        localStorage.setItem('language_mode', newMode);
    };

    const isEnglish = mode === 'PL-EN';

    return (
        <LanguageContext.Provider value={{ mode, setMode, isEnglish }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
