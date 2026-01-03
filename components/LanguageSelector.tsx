
import React from 'react';
import type { Language, LanguageOption } from '../types';

interface LanguageSelectorProps {
    languages: LanguageOption[];
    selectedLanguage: Language;
    onSelect: (lang: Language) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ languages, selectedLanguage, onSelect }) => {
    return (
        <div className="flex flex-wrap gap-3 justify-center mb-4">
            {languages.map((lang) => (
                <button
                    key={lang.code}
                    onClick={() => onSelect(lang.code)}
                    className={`px-6 py-2 rounded-full font-semibold border-2 transition-all duration-300 transform hover:scale-105 ${
                        selectedLanguage === lang.code
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-500'
                    }`}
                >
                    {lang.flag} {lang.name}
                </button>
            ))}
        </div>
    );
};

export default LanguageSelector;
