import React from 'react';

interface PageSelectorProps {
    options: number[];
    selectedPageCount: number;
    onSelect: (pages: number) => void;
}

const PageSelector: React.FC<PageSelectorProps> = ({ options, selectedPageCount, onSelect }) => {
    return (
        <div className="flex flex-wrap gap-3 justify-center mb-4">
            {options.map((option) => (
                <button
                    key={option}
                    onClick={() => onSelect(option)}
                    className={`px-6 py-2 rounded-full font-semibold border-2 transition-all duration-300 transform hover:scale-105 ${
                        selectedPageCount === option
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-500'
                    }`}
                >
                    {option} Pages
                </button>
            ))}
        </div>
    );
};

export default PageSelector;
