
import React from 'react';

interface ModelOption {
    name: string;
    description: string;
}

interface ModelSelectorProps {
    models: ModelOption[];
    selectedModel: string;
    onSelect: (model: string) => void;
    label: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, selectedModel, onSelect, label }) => {
    return (
        <div className="my-6">
            <label className="block text-lg font-semibold text-gray-700 mb-3 text-center sm:text-left">{label}</label>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 justify-center">
                {models.map((model) => (
                    <button
                        key={model.name}
                        onClick={() => onSelect(model.name)}
                        className={`flex-1 text-left p-4 rounded-lg border-2 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg ${
                            selectedModel === model.name
                                ? 'bg-indigo-100 border-indigo-600 ring-2 ring-indigo-500 shadow-lg'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-500'
                        }`}
                    >
                        <span className="font-bold block text-indigo-800">{model.name}</span>
                        <span className={`text-sm font-normal ${selectedModel === model.name ? 'text-indigo-700' : 'text-gray-600'}`}>{model.description}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ModelSelector;