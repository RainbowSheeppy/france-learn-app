
import React, { useState, useMemo } from 'react';
import { StudyGroup } from '../types/study';
import { Search, Filter, Calendar } from 'lucide-react';

interface StudyGroupSelectorProps {
    groups: StudyGroup[];
    onStart: (groupIds: string[], includeLearned: boolean) => void;
    isLoading?: boolean;
}

type FilterType = 'all' | 'completed' | 'incomplete';

const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const StudyGroupSelector: React.FC<StudyGroupSelectorProps> = ({ groups, onStart, isLoading }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [includeLearned, setIncludeLearned] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<FilterType>('all');

    // Filter groups based on search and filter type
    const filteredGroups = useMemo(() => {
        return groups.filter(group => {
            // Search filter
            const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (group.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

            // Completion filter
            const total = group.total_items ?? group.total_fiszki ?? 0;
            const learned = group.learned_items ?? group.learned_fiszki ?? 0;
            const isComplete = total > 0 && learned === total;

            if (filter === 'completed') {
                return matchesSearch && isComplete;
            } else if (filter === 'incomplete') {
                return matchesSearch && !isComplete;
            }
            return matchesSearch;
        });
    }, [groups, searchQuery, filter]);

    const toggleGroup = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleAll = () => {
        if (selectedIds.size === filteredGroups.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredGroups.map(g => g.id)));
        }
    };

    const handleStart = () => {
        onStart(Array.from(selectedIds), includeLearned);
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-[hsl(220,30%,15%)] rounded-xl shadow-lg border border-gray-100 dark:border-[hsl(220,30%,25%)]">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Wybierz grupy do nauki</h2>

            {/* Search and Filter Section */}
            <div className="space-y-4 mb-6">
                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Szukaj grupy..."
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 dark:border-[hsl(220,30%,30%)] bg-white dark:bg-[hsl(220,30%,12%)] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                </div>

                {/* Filter Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${filter === 'all'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 dark:bg-[hsl(220,30%,20%)] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[hsl(220,30%,25%)]'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        Wszystkie
                    </button>
                    <button
                        onClick={() => setFilter('completed')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${filter === 'completed'
                                ? 'bg-green-600 text-white shadow-md'
                                : 'bg-gray-100 dark:bg-[hsl(220,30%,20%)] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[hsl(220,30%,25%)]'
                            }`}
                    >
                        ✓ Ukończone
                    </button>
                    <button
                        onClick={() => setFilter('incomplete')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${filter === 'incomplete'
                                ? 'bg-orange-500 text-white shadow-md'
                                : 'bg-gray-100 dark:bg-[hsl(220,30%,20%)] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[hsl(220,30%,25%)]'
                            }`}
                    >
                        ○ Nieukończone
                    </button>
                </div>
            </div>

            <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[hsl(220,30%,25%)]">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {filteredGroups.length} {filteredGroups.length === 1 ? 'grupa' : 'grup'}
                        {searchQuery && ` dla "${searchQuery}"`}
                    </span>
                    <button
                        onClick={toggleAll}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                        {selectedIds.size === filteredGroups.length && filteredGroups.length > 0 ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                    </button>
                </div>

                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-1">
                    {filteredGroups.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            {searchQuery ? 'Nie znaleziono grup pasujących do wyszukiwania' : 'Brak dostępnych grup'}
                        </div>
                    ) : (
                        filteredGroups.map(group => {
                            const total = group.total_items ?? group.total_fiszki ?? 0;
                            const learned = group.learned_items ?? group.learned_fiszki ?? 0;
                            const isComplete = total > 0 && learned === total;

                            return (
                                <label
                                    key={group.id}
                                    className={`
                                        flex flex-col p-4 rounded-lg border cursor-pointer transition-all
                                        ${selectedIds.has(group.id)
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'border-gray-200 dark:border-[hsl(220,30%,25%)] hover:border-gray-300 dark:hover:border-[hsl(220,30%,35%)] hover:bg-gray-50 dark:hover:bg-[hsl(220,30%,18%)]'}
                                    `}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(group.id)}
                                                onChange={() => toggleGroup(group.id)}
                                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                                            />
                                            <div>
                                                <span className="font-medium text-gray-900 dark:text-white block">{group.name}</span>
                                                {group.description && (
                                                    <span className="text-sm text-gray-500 dark:text-gray-400">{group.description}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`text-sm font-medium px-3 py-1 rounded-full border shadow-sm
                                            ${isComplete
                                                ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800'
                                                : 'text-gray-600 dark:text-gray-300 bg-white dark:bg-[hsl(220,30%,20%)] border-gray-100 dark:border-[hsl(220,30%,30%)]'
                                            }`}>
                                            {learned} / {total} nauczone
                                        </div>
                                    </div>

                                    {/* Modification Date */}
                                    {group.updated_at && (
                                        <div className="flex items-center gap-1.5 mt-2 ml-8 text-xs text-gray-400 dark:text-gray-500">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>Ostatnia modyfikacja: {formatDate(group.updated_at)}</span>
                                        </div>
                                    )}
                                </label>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-[hsl(220,30%,25%)]">
                <label className="flex items-center gap-2 mb-6 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={includeLearned}
                        onChange={(e) => setIncludeLearned(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Powtórz też już nauczone (complete)</span>
                </label>

                <button
                    onClick={handleStart}
                    disabled={selectedIds.size === 0 || isLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                    {isLoading ? 'Ładowanie...' : 'Rozpocznij naukę'}
                </button>
            </div>
        </div>
    );
};
