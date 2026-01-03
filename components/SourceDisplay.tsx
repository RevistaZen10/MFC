
import React from 'react';
import type { PaperSource } from '../types';

interface SourceDisplayProps {
    sources: PaperSource[];
}

const SourceDisplay: React.FC<SourceDisplayProps> = ({ sources }) => {
    if (sources.length === 0) {
        return null;
    }

    return (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="text-md font-semibold text-gray-800 mb-3">
                Sources Used for Bibliography Generation:
            </h4>
            <ul className="list-disc list-inside space-y-2 max-h-48 overflow-y-auto">
                {sources.map((source, index) => (
                    <li key={index} className="text-sm text-gray-700 truncate">
                        <a
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 hover:underline"
                            title={source.title}
                        >
                            {source.title || source.uri}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default SourceDisplay;
