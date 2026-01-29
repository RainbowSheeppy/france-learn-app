import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Normalizuje tekst do porównania w ćwiczeniach tłumaczeniowych.
 * Usuwa diakrytyki francuskie, wielkość liter i interpunkcję.
 * Oryginalna odpowiedź z poprawnymi znakami powinna być wyświetlana użytkownikowi.
 */
export function normalizeForComparison(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/œ/g, 'oe')
        .replace(/æ/g, 'ae')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.,!?;:'"()-]/g, '');
}
