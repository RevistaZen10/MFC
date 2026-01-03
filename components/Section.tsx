import React from 'react';

interface SectionProps {
    title: string;
    stepNumber: number;
    children: React.ReactNode;
    contentClassName?: string;
}

const Section: React.FC<SectionProps> = ({ title, stepNumber, children, contentClassName }) => {
    const finalClassName = contentClassName !== undefined ? contentClassName : 'pl-11';
    return (
        <section className="mb-8 p-6 bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold mr-3">{stepNumber}</span>
                {title}
            </h2>
            <div className={finalClassName}>
                {children}
            </div>
        </section>
    );
};

export default Section;