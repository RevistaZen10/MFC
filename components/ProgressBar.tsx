
import React from 'react';

interface ProgressBarProps {
    progress: number;
    isVisible: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, isVisible }) => {
    if (!isVisible) return null;

    return (
        <div className="w-full bg-gray-200 rounded-full h-6 my-6 overflow-hidden shadow-inner">
            <div
                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-6 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
            >
                {Math.round(progress)}%
            </div>
        </div>
    );
};

export default ProgressBar;
