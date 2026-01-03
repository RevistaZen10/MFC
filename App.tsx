
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ArticleEntry, PersonalData } from './types';

import LatexCompiler from './components/LatexCompiler';
import ApiKeyModal from './components/ApiKeyModal';
import ZenodoUploader, { type ZenodoUploaderRef } from './components/ZenodoUploader';
import PersonalDataModal from './components/PersonalDataModal';

const App: React.FC = () => {
    // Modais e Configurações
    const [isApiModalOpen, setIsApiModalOpen] = useState(false);
    const [isPersonalDataModalOpen, setIsPersonalDataModalOpen] = useState(false);

    // == ESTADO DO PUBLICADOR ==
    const [latexToCompile, setLatexToCompile] = useState<string>(() => {
        return localStorage.getItem('last_latex_session') || `% Comece seu artigo aqui...
\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\title{Título do meu Artigo}
\\author{Autor Exemplo}
\\begin{document}
\\maketitle
\\begin{abstract}
Resumo do artigo aqui.
\\end{abstract}
\\section{Introdução}
Conteúdo aqui...
\\end{document}`;
    });
    const [isCompiling, setIsCompiling] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [uploadingToZenodo, setUploadingToZenodo] = useState(false);
    const [zenodoStatus, setZenodoStatus] = useState<React.ReactNode>(null);
    const [metadata, setMetadata] = useState({ title: '', abstract: '', keywords: '', authors: [] as PersonalData[] });

    // == HISTÓRICO E DADOS ==
    const [history, setHistory] = useState<ArticleEntry[]>(() => {
        const s = localStorage.getItem('scientific_history');
        return s ? JSON.parse(s) : [];
    });
    const [authors, setAuthors] = useState<PersonalData[]>(() => {
        const s = localStorage.getItem('all_authors_data');
        return s ? JSON.parse(s) : [{ name: 'SÉRGIO DE ANDRADE, PAULO', affiliation: 'Faculdade de Guarulhos (FG)', orcid: '0009-0004-2555-3178' }];
    });

    const uploaderRef = useRef<ZenodoUploaderRef>(null);

    // Salvar histórico
    useEffect(() => {
        localStorage.setItem('scientific_history', JSON.stringify(history));
    }, [history]);

    // Salvar autores
    useEffect(() => {
        localStorage.setItem('all_authors_data', JSON.stringify(authors));
    }, [authors]);

    // Persistir sessão de código
    useEffect(() => {
        localStorage.setItem('last_latex_session', latexToCompile);
    }, [latexToCompile]);

    const handleSaveApiKeys = (keys: { gemini: string[], zenodo: string, xai: string }) => {
        localStorage.setItem('gemini_api_keys', JSON.stringify(keys.gemini));
        if (keys.gemini.length > 0) {
            localStorage.setItem('gemini_api_key', keys.gemini[0]);
        } else {
            localStorage.removeItem('gemini_api_key');
        }
        localStorage.setItem('zenodo_api_key', keys.zenodo);
        localStorage.setItem('xai_api_key', keys.xai);
        setIsApiModalOpen(false);
    };

    const syncMetadata = useCallback((code: string) => {
        const titleMatch = code.match(/\\title\{(.*?)\}/);
        const abstractMatch = code.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
        const keywordsMatch = code.match(/\\keywords\{(.*?)\}/);
        
        setMetadata({
            title: titleMatch ? titleMatch[1] : '',
            abstract: abstractMatch ? abstractMatch[1].trim() : '',
            keywords: keywordsMatch ? keywordsMatch[1] : '',
            authors
        });
    }, [authors]);

    // Sincronizar metadados no carregamento inicial
    useEffect(() => {
        syncMetadata(latexToCompile);
    }, [authors]);

    const handleCodeChange = (newCode: string) => {
        setLatexToCompile(newCode);
        setPdfUrl('');
        setPdfFile(null);
        setZenodoStatus(null);
        syncMetadata(newCode);
    };

    const handleCompile = async () => {
        setIsCompiling(true);
        try {
            const response = await fetch('/compile-latex', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latex: latexToCompile }),
            });

            if (!response.ok) throw new Error('Falha na compilação.');
            
            const base64 = await response.text();
            const url = `data:application/pdf;base64,${base64}`;
            const blob = await (await fetch(url)).blob();
            const file = new File([blob], "artigo.pdf", { type: "application/pdf" });
            
            setPdfUrl(url);
            setPdfFile(file);
        } catch (e) {
            alert('Erro ao compilar PDF. Verifique a sintaxe LaTeX no editor.');
        } finally {
            setIsCompiling(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} onSave={handleSaveApiKeys} />
            <PersonalDataModal isOpen={isPersonalDataModalOpen} onClose={() => setIsPersonalDataModalOpen(false)} onSave={(d) => { setAuthors(d); setIsPersonalDataModalOpen(false); }} initialData={authors} />

            <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-indigo-600 uppercase">Scientific Publish</h1>
                        <p className="text-xs text-slate-500 font-medium">EDITOR LATEX + COMPILADOR + ZENODO</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsPersonalDataModalOpen(true)} 
                            className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all text-slate-600 border border-slate-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                            <span className="text-sm font-bold hidden sm:inline">Autores</span>
                        </button>
                        <button 
                            onClick={() => setIsApiModalOpen(true)} 
                            className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all text-slate-600 border border-slate-200"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                            <span className="text-sm font-bold hidden sm:inline">APIs</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                <div className="space-y-8 animate-fadeIn">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Editor e Compilador */}
                        <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-indigo-700">
                                <span className="bg-indigo-50 p-2 rounded-lg">🖋️</span> Editor de LaTeX Profissional
                            </h2>
                            <LatexCompiler code={latexToCompile} onCodeChange={handleCodeChange} />
                            
                            <div className="mt-6 flex flex-wrap gap-4">
                                <button 
                                    onClick={handleCompile} 
                                    disabled={isCompiling}
                                    className="flex-1 min-w-[200px] py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                                >
                                    {isCompiling ? 'Compilando...' : '⚙️ Compilar para PDF'}
                                </button>
                                <button 
                                    onClick={() => uploaderRef.current?.submit()} 
                                    disabled={!pdfFile || uploadingToZenodo}
                                    className="flex-1 min-w-[200px] py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all shadow-md active:scale-95 disabled:opacity-50"
                                >
                                    {uploadingToZenodo ? 'Publicando...' : '🚀 Publicar no Zenodo'}
                                </button>
                            </div>

                            {pdfUrl && (
                                <div className="mt-8 border-t pt-8 animate-fadeIn">
                                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9H7v2h2V9zm4 0h-2v2h2V9z"/></svg>
                                        Pré-visualização do PDF
                                    </h3>
                                    <div className="h-[600px] w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                                        <iframe src={pdfUrl} className="w-full h-full" title="PDF Preview" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Detalhes Zenodo */}
                        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 border-l-4 border-l-green-500 h-fit sticky top-28">
                            <h2 className="text-xl font-bold mb-6 text-green-700">Metadados para Publicação</h2>
                            <ZenodoUploader 
                                ref={uploaderRef}
                                title={metadata.title}
                                abstractText={metadata.abstract}
                                keywords={metadata.keywords}
                                authors={metadata.authors}
                                compiledPdfFile={pdfFile}
                                onFileSelect={() => {}}
                                onPublishStart={() => setUploadingToZenodo(true)}
                                onPublishSuccess={(res) => {
                                    setUploadingToZenodo(false);
                                    setZenodoStatus(<div className="p-4 bg-green-50 text-green-700 font-bold rounded-xl border border-green-200 mt-4 text-center">✅ Publicado com Sucesso!<br/><span className="text-xs font-normal">DOI: {res.doi}</span></div>);
                                    setHistory(prev => [{ id: crypto.randomUUID(), title: metadata.title, date: new Date().toISOString(), status: 'published', link: res.zenodoLink, doi: res.doi }, ...prev]);
                                }}
                                onPublishError={(msg) => { 
                                    setUploadingToZenodo(false); 
                                    setZenodoStatus(<div className="p-4 bg-red-50 text-red-700 font-bold rounded-xl border border-red-200 mt-4 text-center">❌ Erro na Publicação:<br/><span className="text-xs font-normal">{msg}</span></div>); 
                                }}
                                extractedMetadata={metadata}
                            />
                            {zenodoStatus}
                        </div>
                    </div>

                    {/* Histórico Global */}
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span className="bg-slate-50 p-2 rounded-lg">📚</span> Histórico de Publicações
                            </h2>
                            <button 
                                onClick={() => { if(confirm('Limpar todo o histórico?')) setHistory([]); }} 
                                className="text-xs text-red-400 font-bold hover:text-red-600 transition-colors uppercase tracking-wider"
                            >
                                Limpar Tudo
                            </button>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-slate-50">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black">
                                    <tr>
                                        <th className="px-6 py-4">Título do Artigo</th>
                                        <th className="px-6 py-4">Data de Registro</th>
                                        <th className="px-6 py-4">DOI / Link Externo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm">
                                    {history.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-700">{item.title}</td>
                                            <td className="px-6 py-4 text-slate-400">{new Date(item.date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold hover:underline flex items-center gap-1">
                                                    {item.doi || 'Ver Depósito'}
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && (
                                        <tr><td colSpan={3} className="text-center py-16 text-slate-300 italic">Nenhum registro encontrado. Suas publicações aparecerão aqui.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
