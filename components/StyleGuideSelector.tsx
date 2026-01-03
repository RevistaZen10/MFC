import React from 'react';
import type { StyleGuide, StyleGuideOption } from '../types';

interface StyleGuideSelectorProps {
    guides: StyleGuideOption[];
    selectedGuide: StyleGuide;
    onSelect: (guide: StyleGuide) => void;
}

const StyleGuideSelector: React.FC<StyleGuideSelectorProps> = ({ guides, selectedGuide, onSelect }) => {
    return (
        <div className="flex flex-wrap gap-2 justify-center">
            {guides.map((guide) => (
                <button
                    key={guide.key}
                    onClick={() => onSelect(guide.key)}
                    className={`px-4 py-2 text-sm rounded-md font-semibold border-2 transition-all duration-200 transform hover:scale-105 ${
                        selectedGuide === guide.key
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-500'
                    }`}
                    title={guide.description}
                >
                    {guide.name}
                </button>
            ))}
        </div>
    );
};

export default StyleGuideSelector;
