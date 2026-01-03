import React, { useState, useEffect } from 'react';
import { PersonalData } from '../types';

interface PersonalDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: PersonalData[]) => void; // Changed to accept an array of PersonalData
    initialData: PersonalData[]; // Changed to accept an array of PersonalData
}

const PersonalDataModal: React.FC<PersonalDataModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [authors, setAuthors] = useState<PersonalData[]>(initialData);

    useEffect(() => {
        if (isOpen) {
            // Ensure we work with a copy and provide a default if initialData is empty
            setAuthors(initialData.length > 0 ? [...initialData] : [{ name: '', affiliation: '', orcid: '' }]);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Filter out completely empty authors before saving
        const filteredAuthors = authors.filter(
            author => author.name.trim() !== '' || author.affiliation.trim() !== '' || author.orcid.trim() !== ''
        );
        onSave(filteredAuthors.length > 0 ? filteredAuthors : [{ name: '', affiliation: '', orcid: '' }]); // Ensure at least one default author
    };

    const handleAddAuthor = () => {
        setAuthors(prev => [...prev, { name: '', affiliation: '', orcid: '' }]);
    };

    const handleRemoveAuthor = (indexToRemove: number) => {
        if (authors.length === 1) {
            alert('Você deve ter pelo menos um autor.');
            return;
        }
        setAuthors(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handleAuthorChange = (index: number, field: keyof PersonalData, value: string) => {
        setAuthors(prev => prev.map((author, i) => 
            i === index ? { ...author, [field]: value } : author
        ));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md transform transition-all duration-300 p-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">⚙️ Dados Pessoais do Autor</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Fechar configurações de dados pessoais">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <p className="text-gray-600 mb-6">
                    Insira os dados dos autores para o artigo e publicação no Zenodo. Eles serão salvos no seu navegador.
                </p>
                
                <div className="space-y-6">
                    {authors.map((author, index) => (
                        <div key={index} className="border border-gray-200 p-4 rounded-lg bg-gray-50 relative">
                            {authors.length > 1 && (
                                <button
                                    onClick={() => handleRemoveAuthor(index)}
                                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 rounded-full bg-white transition-colors"
                                    aria-label={`Remover autor ${index + 1}`}
                                >
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            )}
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Autor {index + 1}</h3>
                            <div>
                                <label htmlFor={`author-name-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                                    👤 Nome Completo (ex: DE ANDRADE, PAULO SÉRGIO)
                                </label>
                                <input
                                    id={`author-name-${index}`}
                                    type="text"
                                    value={author.name}
                                    onChange={(e) => handleAuthorChange(index, 'name', e.target.value)}
                                    placeholder="Nome completo do autor"
                                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="mt-4">
                                <label htmlFor={`author-affiliation-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                                    🏢 Afiliação (ex: Faculdade de Guarulhos (FG))
                                </label>
                                <input
                                    id={`author-affiliation-${index}`}
                                    type="text"
                                    value={author.affiliation}
                                    onChange={(e) => handleAuthorChange(index, 'affiliation', e.target.value)}
                                    placeholder="Instituição de afiliação do autor"
                                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                            <div className="mt-4">
                                <label htmlFor={`author-orcid-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                                    🔗 ORCID (ex: 0000-0000-0000-0000)
                                </label>
                                <input
                                    id={`author-orcid-${index}`}
                                    type="text"
                                    value={author.orcid}
                                    onChange={(e) => handleAuthorChange(index, 'orcid', e.target.value)}
                                    placeholder="ORCID do autor (opcional)"
                                    className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <small className="text-xs text-gray-500 mt-1 block">
                                    Seu ORCID é um identificador digital persistente para pesquisadores.
                                    Obtenha um em <a href="https://orcid.org/register" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">orcid.org/register</a>.
                                </small>
                            </div>
                        </div>
                    ))}
                    <button
                        onClick={handleAddAuthor}
                        className="w-full flex items-center justify-center gap-2 px-6 py-2 font-semibold text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Adicionar Autor
                    </button>
                </div>

                <div className="flex justify-end gap-4 mt-8">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex items-center justify-center gap-2 px-6 py-2 font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105"
                    >
                        Salvar e Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PersonalDataModal;