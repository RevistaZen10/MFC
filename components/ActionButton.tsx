
import React from 'react';

interface ActionButtonProps {
    onClick: () => void;
    disabled: boolean;
    isLoading: boolean;
    text: string;
    loadingText: string;
    completed?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, disabled, isLoading, text, loadingText, completed = false }) => {
    const baseClasses = "w-full sm:w-auto mx-auto flex items-center justify-center text-lg font-bold py-3 px-12 rounded-full transition-all duration-300 transform focus:outline-none focus:ring-4 focus:ring-opacity-50";
    
    let stateClasses = "bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 hover:scale-105 shadow-lg";
    if (disabled && !isLoading) {
        stateClasses = "bg-gray-300 text-gray-500 cursor-not-allowed";
    }
    if (isLoading) {
        stateClasses = "bg-gray-400 text-white cursor-wait";
    }
    if(completed) {
        stateClasses = "bg-gradient-to-r from-green-500 to-emerald-500 text-white cursor-default";
    }


    return (
        <button
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`${baseClasses} ${stateClasses}`}
        >
            {isLoading && (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {isLoading ? loadingText : text}
        </button>
    );
};

export default ActionButton;
