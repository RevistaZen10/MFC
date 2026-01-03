import React from 'react';
import type { IterationAnalysis } from '../types';

interface ResultsDisplayProps {
    analysisResults: IterationAnalysis[];
    totalIterations: number;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ analysisResults, totalIterations }) => {
    if (analysisResults.length === 0) {
        return <div className="text-center text-gray-500 py-8">Analysis results will be displayed here.</div>;
    }

    // Helper function to get text label based on score
    const getScoreLabel = (score: number) => {
        if (score >= 9.5) return '🏆 MESTRE DOS GÊNIOS';
        if (score >= 8.5) return 'Excelente';
        if (score >= 7.0) return 'Aceitável';
        return 'Precisa Melhorar';
    };

    return (
        <div className="space-y-8 max-h-[600px] overflow-y-auto p-4 bg-white border border-gray-200 rounded-lg">
            {analysisResults.map((iteration) => (
                <div key={iteration.iteration}>
                    <h3 className="sticky top-0 text-2xl font-bold text-center text-white bg-gradient-to-r from-purple-600 to-indigo-600 p-3 rounded-lg shadow-md mb-4">
                        ═══ ITERATION {iteration.iteration} of {totalIterations} ═══
                    </h3>
                    <div className="space-y-4">
                        {iteration.results.map((result, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-lg border-l-4 border-indigo-500 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-gray-800">{result.topic.name}</h4>
                                    <span className={`px-3 py-1 text-xs font-bold text-white rounded-full ${result.scoreClass}`}>
                                        {getScoreLabel(result.score)}: {result.score.toFixed(1)}
                                    </span>
                                </div>
                                <p className="text-gray-600 italic">"{result.improvement}"</p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ResultsDisplay;