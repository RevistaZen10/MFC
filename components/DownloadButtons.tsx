import React from 'react';

interface DownloadButtonsProps {
    isVisible: boolean;
    onCopyToClipboard: () => void;
    isCopied: boolean;
}

const DownloadButtons: React.FC<DownloadButtonsProps> = ({ 
    isVisible, 
    onCopyToClipboard, 
    isCopied,
}) => {
    if (!isVisible) return null;

    return (
        <div className="flex flex-wrap justify-center gap-4 mt-6">
            <button
                onClick={onCopyToClipboard}
                className={`flex items-center gap-2 px-6 py-3 font-semibold text-white rounded-full shadow-lg transition-all transform hover:scale-105 ${
                    isCopied ? 'bg-teal-500' : 'bg-gray-700 hover:bg-gray-800'
                }`}
            >
                {isCopied ? (
                    '✅ Copied!'
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Latex
                    </>
                )}
            </button>
        </div>
    );
};

export default DownloadButtons;