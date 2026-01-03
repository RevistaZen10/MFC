
import React, { useEffect, useRef, useState } from 'react';

declare const ace: any; // Declara a variável global ace

interface LatexCompilerProps {
    code: string;
    onCodeChange: (newCode: string) => void;
}

const ACE_THEMES = [
    {
        group: 'Bright',
        themes: [
            { name: 'Chrome', value: 'chrome' },
            { name: 'Clouds', value: 'clouds' },
            { name: 'Crimson Editor', value: 'crimson_editor' },
            { name: 'Dawn', value: 'dawn' },
            { name: 'Dreamweaver', value: 'dreamweaver' },
            { name: 'Eclipse', value: 'eclipse' },
            { name: 'GitHub', value: 'github' },
            { name: 'IPlastic', value: 'iplastic' },
            { name: 'Solarized Light', value: 'solarized_light' },
            { name: 'TextMate', value: 'textmate' },
            { name: 'Tomorrow', value: 'tomorrow' },
            { name: 'Xcode', value: 'xcode' },
            { name: 'Kuroir', value: 'kuroir' },
            { name: 'KatzenMilch', value: 'katzenmilch' },
            { name: 'SQL Server', value: 'sqlserver' },
        ]
    },
    {
        group: 'Dark',
        themes: [
            { name: 'Ambiance', value: 'ambiance' },
            { name: 'Chaos', value: 'chaos' },
            { name: 'Clouds Midnight', value: 'clouds_midnight' },
            { name: 'Dracula', value: 'dracula' },
            { name: 'Cobalt', value: 'cobalt' },
            { name: 'Gruvbox', value: 'gruvbox' },
            { name: 'Green on Black', value: 'green_on_black' },
            { name: 'idle Fingers', value: 'idle_fingers' },
            { name: 'krTheme', value: 'kr_theme' },
            { name: 'Merbivore', value: 'merbivore' },
            { name: 'Merbivore Soft', value: 'merbivore_soft' },
            { name: 'Mono Industrial', value: 'mono_industrial' },
            { name: 'Monokai', value: 'monokai' },
            { name: 'Nord Dark', value: 'nord_dark' },
            { name: 'Pastel on dark', value: 'pastel_on_dark' },
            { name: 'Solarized Dark', value: 'solarized_dark' },
            { name: 'Terminal', value: 'terminal' },
            { name: 'Tomorrow Night', value: 'tomorrow_night' },
            { name: 'Tomorrow Night Blue', value: 'tomorrow_night_blue' },
            { name: 'Tomorrow Night Bright', value: 'tomorrow_night_bright' },
            { name: 'Tomorrow Night 80s', value: 'tomorrow_night_eighties' },
            { name: 'Twilight', value: 'twilight' },
            { name: 'Vibrant Ink', value: 'vibrant_ink' },
        ]
    }
];

const LatexCompiler: React.FC<LatexCompilerProps> = ({ code, onCodeChange }) => {
    const editorInstanceRef = useRef<any>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    const [currentTheme, setCurrentTheme] = useState('textmate');

    useEffect(() => {
        const initEditor = () => {
            if (typeof ace !== 'undefined' && editorContainerRef.current && !editorInstanceRef.current) {
                const editor = ace.edit(editorContainerRef.current);
                editorInstanceRef.current = editor;

                const themeFromUrl = new URLSearchParams(window.location.search).get('theme') || 'textmate';

                setCurrentTheme(themeFromUrl);
                editor.setTheme("ace/theme/" + themeFromUrl);
                editor.session.setMode("ace/mode/latex");
                editor.setOptions({
                    fontSize: "14px",
                    showPrintMargin: false,
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    wrap: true,
                    useWorker: false // Desabilita worker para evitar erros de domínio cruzado
                });
                
                editor.setValue(code, -1);
                
                editor.session.on('change', () => {
                    const newCode = editor.getValue();
                    if (newCode !== code) {
                        onCodeChange(newCode);
                    }
                });
            }
        };

        // Tenta inicializar. Se ace não estiver pronto, espera um pouco.
        if (typeof ace === 'undefined') {
            const checkAce = setInterval(() => {
                if (typeof ace !== 'undefined') {
                    initEditor();
                    clearInterval(checkAce);
                }
            }, 100);
            return () => clearInterval(checkAce);
        } else {
            initEditor();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    useEffect(() => {
        // Atualiza o editor se o código externo mudar (ex: botão "Copiar para Compilador")
        if (editorInstanceRef.current && editorInstanceRef.current.getValue() !== code) {
            const pos = editorInstanceRef.current.getCursorPosition();
            editorInstanceRef.current.setValue(code, -1);
            editorInstanceRef.current.moveCursorToPosition(pos);
        }
    }, [code]);

    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTheme = e.target.value;
        setCurrentTheme(newTheme);
        if (editorInstanceRef.current) {
            editorInstanceRef.current.setTheme("ace/theme/" + newTheme);
        }
    };

    const clearCode = () => {
        if (confirm('Deseja limpar todo o código do editor?')) {
            onCodeChange('');
        }
    };

    return (
        <div className="space-y-4">
             <div className="p-4 rounded-lg bg-indigo-50 border-l-4 border-indigo-500" role="complementary">
                <p className="font-bold text-indigo-900">💡 Instruções:</p>
                <p className="text-sm text-indigo-800">1. Cole seu código LaTeX gerado ou escreva manualmente no editor abaixo.</p>
                <p className="text-sm text-indigo-800">2. O sistema detectará automaticamente Título e Resumo para o Zenodo.</p>
                <p className="text-sm text-indigo-800">3. Clique em <strong>Compilar para PDF</strong> para gerar a pré-visualização.</p>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm" aria-label="LaTeX Code Editor">
                <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                    <h2 className="text-lg font-semibold text-gray-700">Editor LaTeX Profissional</h2>
                     <div className="controls flex items-center gap-4">
                        <button 
                            onClick={clearCode}
                            className="text-xs font-bold text-red-500 hover:underline px-2 py-1 bg-red-50 rounded"
                        >
                            LIMPAR EDITOR
                        </button>
                        <div className="flex items-center gap-2">
                            <label htmlFor="theme" className="text-sm font-medium text-gray-700">Tema:</label>
                            <select 
                                id="theme" 
                                value={currentTheme} 
                                onChange={handleThemeChange} 
                                className="bg-white border border-gray-300 rounded-md py-1 px-2 text-xs text-gray-700 focus:ring-indigo-500 focus:border-indigo-500"
                                aria-label="Select editor theme"
                            >
                                {ACE_THEMES.map(group => (
                                    <optgroup label={group.group} key={group.group}>
                                        {group.themes.map(theme => (
                                            <option key={theme.value} value={theme.value}>{theme.name}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div 
                    ref={editorContainerRef} 
                    className="w-full"
                    style={{ height: '500px', border: '1px solid #ddd', borderRadius: '8px' }} 
                    aria-label="LaTeX editor content"
                ></div>

                <div className="mt-2 text-[10px] text-gray-400 text-right">
                    Dica: Use Ctrl+V para colar o seu código LaTeX.
                </div>
            </div>
        </div>
    );
};

export default LatexCompiler;
