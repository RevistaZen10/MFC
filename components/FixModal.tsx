import React from 'react';
import { FIX_OPTIONS } from '../constants';

interface FixModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: () => void;
    selectedFixes: Record<string, boolean>;
    onFixChange: (fixKey: string, isSelected: boolean) => void;
    isApplying: boolean;
    fixesApplied: boolean;
    title: string;
}

const FixModal: React.FC<FixModalProps> = ({ isOpen, onClose, onApply, selectedFixes, onFixChange, isApplying, fixesApplied, title }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl transform transition-all duration-300 scale-95 hover:scale-100 p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <p className="text-gray-600 mb-6">Select one or more common issues to diagnose and attempt to fix automatically. The AI will rewrite the LaTeX code to apply the selected corrections.</p>
                
                <div className="space-y-4 mb-8">
                    {FIX_OPTIONS.map(option => (
                        <label key={option.key} className="flex items-start p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-400">
                            <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mt-1"
                                checked={selectedFixes[option.key] || false}
                                onChange={(e) => onFixChange(option.key, e.target.checked)}
                                aria-label={option.label}
                            />
                            <div className="ml-4">
                                <span className="font-semibold text-gray-800">{option.label}</span>
                                <p className="text-sm text-gray-500">{option.description}</p>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="flex justify-end gap-4">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onApply}
                        disabled={isApplying || Object.values(selectedFixes).every(v => !v)}
                        className="flex items-center justify-center gap-2 px-6 py-2 font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 disabled:bg-gray-400 disabled:cursor-wait transition-all transform hover:scale-105"
                    >
                        {isApplying && (
                             <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        )}
                        <span>{isApplying ? 'Applying...' : 'Apply Fixes'}</span>
                    </button>
                </div>
                 {fixesApplied && <p className="text-green-600 text-center mt-4">Fixes applied successfully! You may now re-run the analysis or download the updated paper.</p>}
            </div>
        </div>
    );
};

export default FixModal;
