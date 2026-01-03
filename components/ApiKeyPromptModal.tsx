

import React, { useState } from 'react';

interface ApiKeyPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectApiKey: () => void;
    onSetManualApiKey: (key: string) => void;
    error: string | null;
}

const ApiKeyPromptModal: React.FC<ApiKeyPromptModalProps> = ({ isOpen, onClose, onSelectApiKey, onSetManualApiKey, error }) => {
    if (!isOpen) return null;
    
    const [manualKey, setManualKey] = useState('');

    const handleUseManualKey = () => {
        if (manualKey.trim()) {
            onSetManualApiKey(manualKey.trim());
        }
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg transform transition-all duration-300 scale-95 hover:scale-100 p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Gemini API Key</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close API Key Prompt">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <p className="text-gray-700 mb-4">
                    To use this app, please select an API key via the AI Studio dialog or enter one manually for testing.
                </p>

                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 my-4 rounded-md shadow" role="alert">
                        <p className="font-bold">Error:</p>
                        <p>{error}</p>
                    </div>
                )}
                
                <div className="mt-6 space-y-4">
                     <p className="text-center text-sm text-gray-600">Recommended for Google AI Studio:</p>
                    <button 
                        onClick={onSelectApiKey}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-md hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v2H4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2h-2V6a4 4 0 00-4-4zm2 6V6a2 2 0 10-4 0v2h4z" clipRule="evenodd" />
                        </svg>
                        Select API Key via AI Studio
                    </button>
                </div>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center">
                        <span className="bg-white px-2 text-sm text-gray-500">Or for testing</span>
                    </div>
                </div>

                <div className="space-y-2">
                     <label htmlFor="manual-api-key" className="block text-sm font-medium text-gray-700">
                        Enter API Key Manually:
                    </label>
                    <input
                        id="manual-api-key"
                        type="password"
                        value={manualKey}
                        onChange={(e) => setManualKey(e.target.value)}
                        placeholder="Paste your Gemini API Key here"
                        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                        onClick={handleUseManualKey}
                        disabled={!manualKey.trim()}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-gray-600 rounded-full shadow-md hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Use This Key
                    </button>
                </div>

                <p className="text-center text-sm text-gray-500 mt-6">
                    Learn more about billing for the Gemini API: <br />
                    <a 
                        href="https://ai.google.dev/gemini-api/docs/billing" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-indigo-600 hover:underline"
                    >
                        ai.google.dev/gemini-api/docs/billing
                    </a>
                </p>
            </div>
        </div>
    );
};

export default ApiKeyPromptModal;
