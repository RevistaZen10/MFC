
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateInitialPaper, analyzePaper, improvePaper, generatePaperTitle, fixLatexPaper } from './services/geminiService';
import type { Language, IterationAnalysis, PaperSource, ArticleEntry, PersonalData } from './types';
import { LANGUAGES, AVAILABLE_MODELS, getAllDisciplines, getRandomTopic, TOTAL_ITERATIONS } from './constants';

import LanguageSelector from './components/LanguageSelector';
import ModelSelector from './components/ModelSelector';
import ActionButton from './components/ActionButton';
import ProgressBar from './components/ProgressBar';
import SourceDisplay from './components/SourceDisplay';
import LatexCompiler from './components/LatexCompiler';
import ApiKeyModal from './components/ApiKeyModal';
import ZenodoUploader, { type ZenodoUploaderRef } from './components/ZenodoUploader';
import PersonalDataModal from './components/PersonalDataModal';

const App: React.FC = () => {
    // Navegação entre módulos
    const [activeTab, setActiveTab] = useState<'generator' | 'publisher'>('generator');
    
    // Modais e Configurações
    const [isApiModalOpen, setIsApiModalOpen] = useState(false);
    const [isPersonalDataModalOpen, setIsPersonalDataModalOpen] = useState(false);

    // == ESTADO DO GERADOR (Módulo 1) ==
    const [language, setLanguage] = useState<Language>('pt');
    const [generationModel, setGenerationModel] = useState('gemini-3-pro-preview');
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>(getAllDisciplines()[0]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [genProgress, setGenProgress] = useState(0);
    const [genStatus, setGenStatus] = useState('');
    const [paperSources, setPaperSources] = useState<PaperSource[]>([]);
    const [generatedLatex, setGeneratedLatex] = useState('');

    // == ESTADO DO PUBLICADOR (Módulo 2) ==
    const [latexToCompile, setLatexToCompile] = useState(`% Cole seu código LaTeX aqui...`);
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

    // ATUALIZAÇÃO DOS AUTORES PADRÃO
    const [authors, setAuthors] = useState<PersonalData[]>(() => {
        const s = localStorage.getItem('all_authors_data');
        return s ? JSON.parse(s) : [
            { name: 'Revista, Zen', affiliation: 'Editorial Center', orcid: '0009-0007-6299-2008' },
            { name: 'MATH, 10', affiliation: 'Scientific Department', orcid: '0009-0007-6299-2008' }
        ];
    });

    const uploaderRef = useRef<ZenodoUploaderRef>(null);

    useEffect(() => {
        localStorage.setItem('scientific_history', JSON.stringify(history));
    }, [history]);

    useEffect(() => {
        localStorage.setItem('all_authors_data', JSON.stringify(authors));
    }, [authors]);

    // Extração Automática de Metadados do LaTeX
    const syncMetadata = useCallback((code: string) => {
        const titleMatch = code.match(/\\title\{(.*?)\}/);
        const title = titleMatch ? titleMatch[1].replace(/\\/g, '').trim() : '';
        
        const abstractMatch = code.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
        const abstract = abstractMatch ? abstractMatch[1].trim() : '';
        
        const keywordsMatch = code.match(/\\keywords\{(.*?)\}/);
        const keywords = keywordsMatch ? keywordsMatch[1].trim() : '';
        
        setMetadata({ title, abstract, keywords, authors });
    }, [authors]);

    const handleCodeChange = (newCode: string) => {
        setLatexToCompile(newCode);
        setPdfUrl('');
        setPdfFile(null);
        setZenodoStatus(null);
        syncMetadata(newCode);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        setGenProgress(0);
        try {
            setGenStatus('Definindo título impactante...');
            const topic = getRandomTopic(selectedDiscipline);
            const title = await generatePaperTitle(topic, language, generationModel, selectedDiscipline);
            setGenProgress(20);

            setGenStatus('Pesquisando fontes e gerando rascunho...');
            const { paper, sources } = await generateInitialPaper(title, language, 10, generationModel, authors);
            setPaperSources(sources);
            let currentPaper = paper;
            setGenProgress(50);

            setGenStatus('Refinando qualidade acadêmica...');
            const analysis = await analyzePaper(currentPaper, 10, generationModel);
            currentPaper = await improvePaper(currentPaper, analysis, language, generationModel);
            
            setGeneratedLatex(currentPaper);
            setGenProgress(100);
            setGenStatus('✅ LaTeX Gerado com Sucesso!');
        } catch (e) {
            setGenStatus(`❌ Erro: ${e instanceof Error ? e.message : 'Falha na geração'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCompile = async () => {
        setIsCompiling(true);
        try {
            const response = await fetch('/compile-latex', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latex: latexToCompile }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Falha na compilação.');
            
            const base64 = typeof result === 'string' ? result : result.pdf;
            const url = `data:application/pdf;base64,${base64}`;
            const blob = await (await fetch(url)).blob();
            const file = new File([blob], "artigo.pdf", { type: "application/pdf" });
            
            setPdfUrl(url);
            setPdfFile(file);
        } catch (e: any) {
            alert(`Erro na compilação:\n\n${e.message}`);
        } finally {
            setIsCompiling(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} onSave={() => setIsApiModalOpen(false)} />
            <PersonalDataModal isOpen={isPersonalDataModalOpen} onClose={() => setIsPersonalDataModalOpen(false)} onSave={(d) => { setAuthors(d); setIsPersonalDataModalOpen(false); }} initialData={authors} />

            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-indigo-600">SCIENTIFIC GEN 3.0</h1>
                        <p className="text-xs text-slate-500 font-medium">IA → LaTeX → PDF → ZENODO</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsPersonalDataModalOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Dados do Autor"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></button>
                        <button onClick={() => setIsApiModalOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Configurações"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg></button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                <div className="flex bg-white rounded-xl p-1 shadow-sm border border-slate-200 mb-8 max-w-2xl mx-auto">
                    <button 
                        onClick={() => setActiveTab('generator')}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'generator' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                    >
                        1. GERADOR DE LATEX
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab('publisher');
                            syncMetadata(latexToCompile);
                        }}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === 'publisher' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-indigo-600'}`}
                    >
                        2. COMPILADOR & ZENODO
                    </button>
                </div>

                {activeTab === 'generator' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
                        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-indigo-700">
                                <span className="bg-indigo-50 p-2 rounded-lg">⚙️</span> Geração por IA
                            </h2>
                            <div className="space-y-6">
                                <LanguageSelector languages={LANGUAGES} selectedLanguage={language} onSelect={setLanguage} />
                                <ModelSelector models={AVAILABLE_MODELS} selectedModel={generationModel} onSelect={setGenerationModel} label="Motor de IA:" />
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Área do Conhecimento:</label>
                                    <select value={selectedDiscipline} onChange={(e) => setSelectedDiscipline(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all">
                                        {getAllDisciplines().map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <ActionButton onClick={handleGenerate} disabled={isGenerating} isLoading={isGenerating} text="Gerar Código LaTeX" loadingText="Pesquisando e Escrevendo..." />
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 flex flex-col">
                            <h2 className="text-xl font-bold mb-6 text-indigo-700">Status & LaTeX</h2>
                            {isGenerating ? (
                                <div className="space-y-6 my-auto text-center">
                                    <ProgressBar progress={genProgress} isVisible={true} />
                                    <p className="text-indigo-600 font-bold animate-pulse">{genStatus}</p>
                                    <SourceDisplay sources={paperSources} />
                                </div>
                            ) : generatedLatex ? (
                                <div className="flex-1 flex flex-col space-y-4">
                                    <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-xs overflow-auto max-h-[400px] border border-slate-800">
                                        <pre>{generatedLatex}</pre>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setLatexToCompile(generatedLatex);
                                            syncMetadata(generatedLatex);
                                            setActiveTab('publisher');
                                        }}
                                        className="w-full py-4 bg-green-500 text-white font-black rounded-xl hover:bg-green-600 shadow-lg transform active:scale-95 transition-all"
                                    >
                                        COPIAR PARA O COMPILADOR →
                                    </button>
                                </div>
                            ) : (
                                <div className="my-auto text-center py-20 opacity-30">
                                    <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                                    <p className="font-medium">O LaTeX gerado aparecerá aqui.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                                <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-indigo-700">
                                    <span className="bg-indigo-50 p-2 rounded-lg">🖋️</span> Editor de LaTeX
                                </h2>
                                <LatexCompiler code={latexToCompile} onCodeChange={handleCodeChange} />
                                
                                <div className="mt-6 flex gap-4">
                                    <button 
                                        onClick={handleCompile} 
                                        disabled={isCompiling}
                                        className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md"
                                    >
                                        {isCompiling ? 'Compilando...' : '⚙️ Compilar para PDF'}
                                    </button>
                                    <button 
                                        onClick={() => uploaderRef.current?.submit()} 
                                        disabled={!pdfFile || uploadingToZenodo}
                                        className="flex-1 py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all shadow-md disabled:opacity-50"
                                    >
                                        {uploadingToZenodo ? 'Publicando...' : '🚀 Publicar no Zenodo'}
                                    </button>
                                </div>

                                {pdfUrl && (
                                    <div className="mt-8 border-t pt-8">
                                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9H7v2h2V9zm4 0h-2v2h2V9z"/></svg>
                                            Visualização do PDF Compilado
                                        </h3>
                                        <div className="h-[500px] w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                                            <iframe src={pdfUrl} className="w-full h-full" title="PDF Preview" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 border-l-4 border-l-green-500 h-fit sticky top-28">
                                <h2 className="text-xl font-bold mb-6 text-green-700">Metadados Zenodo</h2>
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
                                        setZenodoStatus(<div className="p-4 bg-green-50 text-green-700 font-bold rounded-xl border border-green-200 mt-4 text-center">✅ Publicado! DOI: {res.doi}</div>);
                                        setHistory(prev => [{ id: crypto.randomUUID(), title: metadata.title, date: new Date().toISOString(), status: 'published', link: res.zenodoLink, doi: res.doi }, ...prev]);
                                    }}
                                    onPublishError={(msg) => { setUploadingToZenodo(false); setZenodoStatus(<div className="p-4 bg-red-50 text-red-700 font-bold rounded-xl border border-red-200 mt-4 text-center">❌ {msg}</div>); }}
                                    extractedMetadata={metadata}
                                />
                                {zenodoStatus}
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">📚 Meus Artigos Publicados</h2>
                                <button onClick={() => setHistory([])} className="text-xs text-red-400 font-bold hover:underline">LIMPAR LOGS</button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black">
                                        <tr>
                                            <th className="px-6 py-3">Título do Artigo</th>
                                            <th className="px-6 py-3">Data</th>
                                            <th className="px-6 py-3">DOI / Link</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-sm">
                                        {history.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-bold text-slate-700">{item.title}</td>
                                                <td className="px-6 py-4 text-slate-400">{new Date(item.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4">
                                                    <a href={item.link} target="_blank" className="text-indigo-600 font-bold hover:underline">{item.doi || 'Ver Artigo'}</a>
                                                </td>
                                            </tr>
                                        ))}
                                        {history.length === 0 && (
                                            <tr><td colSpan={3} className="text-center py-10 text-slate-300 italic">Nenhum artigo publicado ainda.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
