
import React from 'react';

interface TitleSelectorProps {
    titles: string[];
    selectedTitle: string;
    onSelect: (title: string) => void;
}

const TitleSelector: React.FC<TitleSelectorProps> = ({ titles, selectedTitle, onSelect }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {titles.map((title, index) => (
                <div
                    key={index}
                    onClick={() => onSelect(title)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl ${
                        selectedTitle === title
                            ? 'bg-indigo-100 border-indigo-600 ring-2 ring-indigo-500 shadow-lg'
                            : 'bg-white border-gray-200 hover:border-indigo-400'
                    }`}
                >
                    <div className="flex justify-between items-start gap-2">
                        <p className={`font-semibold flex-grow ${selectedTitle === title ? 'text-indigo-800' : 'text-gray-800'}`}>
                            <strong>{index + 1}.</strong> {title}
                        </p>
                        {index === 0 && (
                            <span className="text-xs font-bold text-white bg-green-500 px-2 py-1 rounded-full flex-shrink-0">
                                Improved
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default TitleSelector;
