
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Language, AnalysisResult, PaperSource, StyleGuide, SemanticScholarPaper, PersonalData } from '../types';
import { ANALYSIS_TOPICS, LANGUAGES, FIX_OPTIONS, STYLE_GUIDES, SEMANTIC_SCHOLAR_API_BASE_URL } from '../constants';
import { ARTICLE_TEMPLATE } from './articleTemplate'; 

const BABEL_LANG_MAP: Record<Language, string> = {
    en: 'english',
    pt: 'brazilian',
    es: 'spanish',
    fr: 'french',
};

// Internal Key Manager to track rotation state
const KeyManager = {
    keys: [] as string[],
    currentIndex: 0,
    initialized: false,

    loadKeys: function() {
        const storedKeys = localStorage.getItem('gemini_api_keys');
        const legacyKey = localStorage.getItem('gemini_api_key') || (process.env.API_KEY as string);
        
        let newKeys: string[] = [];

        if (storedKeys) {
            try {
                const parsed = JSON.parse(storedKeys);
                newKeys = Array.isArray(parsed) ? parsed.filter(k => k.trim() !== '') : [];
            } catch {
                newKeys = [];
            }
        }
        
        if (newKeys.length === 0 && legacyKey) {
            newKeys = [legacyKey];
        }

        if (newKeys.length === 0 && process.env.API_KEY) {
             newKeys = [process.env.API_KEY];
        }

        this.keys = newKeys;

        if (!this.initialized && this.keys.length > 0) {
            this.currentIndex = Math.floor(Math.random() * this.keys.length);
            this.initialized = true;
        } else if (this.keys.length > 0) {
            if (this.currentIndex >= this.keys.length) {
                this.currentIndex = 0;
            }
        }
    },

    getCurrentKey: function(): string {
        this.loadKeys(); 
        if (this.keys.length === 0) {
            throw new Error("Gemini API key not found. Please add keys in the settings modal (gear icon).");
        }
        return this.keys[this.currentIndex];
    },

    rotate: function(): boolean {
        if (this.keys.length <= 1) return false;
        const prevIndex = this.currentIndex;
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        return true;
    }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getAiClient(): GoogleGenAI {
    const apiKey = KeyManager.getCurrentKey();
    return new GoogleGenAI({ apiKey });
}

function isRotationTrigger(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (
        errorMessage.includes('429') || 
        errorMessage.includes('quota') || 
        errorMessage.includes('limit') || 
        errorMessage.includes('exhausted') ||
        errorMessage.includes('403') || 
        errorMessage.includes('permission denied') ||
        errorMessage.includes('suspended') ||
        errorMessage.includes('consumer')
    );
}

async function executeWithKeyRotation<T>(
    operation: (client: GoogleGenAI) => Promise<T>, 
    modelName: string
): Promise<T> {
    KeyManager.loadKeys(); 
    const maxAttempts = KeyManager.keys.length > 0 ? KeyManager.keys.length : 1;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const client = getAiClient();
            return await withRateLimitHandling(() => operation(client));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            const shouldRotate = isRotationTrigger(error);

            if (shouldRotate && KeyManager.keys.length > 1) {
                KeyManager.rotate();
                await delay(10000); 
                continue; 
            }

            if (attempt === maxAttempts - 1) {
                if (shouldRotate) {
                    throw new Error(`All Gemini API Keys exhausted (Quota/Suspended). Last error: ${errorMessage}`);
                }
                throw error;
            }
            throw error;
        }
    }
    throw new Error("All Gemini API Keys exhausted (Rotation loop ended without success).");
}

async function withRateLimitHandling<T>(apiCall: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 5; 
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            if (errorMessage.includes('limit: 0') || errorMessage.includes('quota exceeded for metric')) {
                 throw new Error(`API Quota Exceeded (Limit: 0) or Model Unavailable: ${errorMessage}`);
            }

            const shouldRotate = isRotationTrigger(error);
            const hasBackupKeys = KeyManager.keys.length > 1;

            if (shouldRotate && hasBackupKeys) {
                throw error;
            }

            if (attempt === MAX_RETRIES) {
                if (shouldRotate) {
                    throw new Error(`Quota Exceeded or Key Suspended: ${errorMessage}`);
                 }
                throw error;
            }

            let backoffTime = shouldRotate ? 8000 + Math.random() * 4000 : Math.pow(2, attempt) * 1000 + Math.random() * 500;
            await delay(backoffTime);
        }
    }
    throw new Error("API call failed after internal retries.");
}

async function callModel(
    model: string,
    systemInstruction: string,
    userPrompt: string,
    config: {
        jsonOutput?: boolean;
        responseSchema?: any;
        googleSearch?: boolean;
    } = {}
): Promise<GenerateContentResponse> {
    if (model.startsWith('gemini-')) {
        try {
            return await executeWithKeyRotation(async (aiClient) => {
                return aiClient.models.generateContent({
                    model: model,
                    contents: userPrompt,
                    config: {
                        systemInstruction: systemInstruction,
                        ...(config.jsonOutput && { responseMimeType: "application/json" }),
                        ...(config.responseSchema && { responseSchema: config.responseSchema }),
                        ...(config.googleSearch && { tools: [{ googleSearch: {} }] }),
                    },
                });
            }, model);
        } catch (error) {
            const errStr = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
            const isQuotaExhausted = errStr.includes('exhausted') || errStr.includes('quota') || errStr.includes('limit') || errStr.includes('429');
            if (isQuotaExhausted && model === 'gemini-2.5-flash') {
                const fallbackModel = 'gemini-2.0-flash';
                return await executeWithKeyRotation(async (aiClient) => {
                    return aiClient.models.generateContent({
                        model: fallbackModel,
                        contents: userPrompt,
                        config: {
                            systemInstruction: systemInstruction,
                            ...(config.jsonOutput && { responseMimeType: "application/json" }),
                            ...(config.responseSchema && { responseSchema: config.responseSchema }),
                            ...(config.googleSearch && { tools: [{ googleSearch: {} }] }),
                        },
                    });
                }, fallbackModel);
            }
            throw error;
        }
    } else {
        throw new Error(`Unsupported model: ${model}`);
    }
}

export async function generatePaperTitle(topic: string, language: Language, model: string, discipline: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const systemInstruction = `Act as an expert academic researcher. Generate a single, compelling, high-impact scientific paper title.`;
    const userPrompt = `Topic: "${topic}" in ${discipline}. Language: **${languageName}**. Return ONLY the title text. No quotes.`;
    const response = await callModel(model, systemInstruction, userPrompt);
    return response.text.trim().replace(/"/g, '');
}

function postProcessLatex(latexCode: string): string {
    let code = latexCode;
    code = code.replace(/\\begin\{figure\*?\}([\s\S]*?)\\end\{figure\*?\}/g, '');
    code = code.replace(/\\includegraphics\s*(\[.*?\])?\s*\{.*?\}/g, '');
    code = code.replace(/\\captionof\s*\{figure\}\s*\{.*?\}/g, '');
    code = code.replace(/,?\s+&\s+/g, ' and ');
    code = code.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '');
    const environments = ['itemize', 'enumerate', 'description'];
    environments.forEach(env => {
        const beginRegex = new RegExp(`\\\\begin\\{${env}\\}`, 'g');
        const endRegex = new RegExp(`\\\\end\\{${env}\\}`, 'g');
        const openCount = (code.match(beginRegex) || []).length;
        const closeCount = (code.match(endRegex) || []).length;
        if (openCount > closeCount) {
            const diff = openCount - closeCount;
            const closingTags = `\\end{${env}}`.repeat(diff);
            const docEndIdx = code.lastIndexOf('\\end{document}');
            if (docEndIdx !== -1) {
                code = code.substring(0, docEndIdx) + `\n${closingTags}\n` + code.substring(docEndIdx);
            } else {
                code += `\n${closingTags}`;
            }
        }
    });
    if (!code.includes('\\end{document}')) code += '\n\\end{document}';
    const docClassIdx = code.indexOf('\\documentclass');
    if (docClassIdx > 0) code = code.substring(docClassIdx);
    return code;
}

function extractLatexFromResponse(text: string): string {
    if (!text) return '';
    const match = text.match(/```latex\s*([\s\S]*?)\s*```/);
    if (match && match[1]) return match[1].trim();
    let cleaned = text.trim();
    if (cleaned.startsWith('```latex')) cleaned = cleaned.substring(8);
    else if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
    return cleaned.trim();
}

function stripLatexComments(text: string): string {
    return text.replace(/(^|[^\\])%.*$/gm, '$1').trim();
}

function extractStrategicContext(latex: string): { text: string, isTruncated: boolean } {
    let combined = "";
    const abstractMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/i);
    if (abstractMatch) combined += "\\section*{Abstract}\n" + abstractMatch[1].trim() + "\n\n";
    const introMatch = latex.match(/\\section\{(?:Introduction|Introdução)\}([\s\S]*?)(?=\\section\{)/i);
    if (introMatch) combined += "\\section{Introduction}\n" + introMatch[1].trim() + "\n\n";
    const conclusionMatch = latex.match(/\\section\{(?:Conclusion|Conclusão|Considerações Finais)\}([\s\S]*?)(?=\\section\{|\\end\{document\})/i);
    if (conclusionMatch) combined += "\\section{Conclusion}\n" + conclusionMatch[1].trim() + "\n\n";
    if (combined.length < 500) return { text: latex, isTruncated: false };
    return { text: combined, isTruncated: true };
}

async function fetchSemanticScholarPapers(query: string, limit: number = 5): Promise<SemanticScholarPaper[]> {
    try {
        const fields = 'paperId,title,authors,abstract,url';
        const response = await fetch(`/semantic-proxy?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        return [];
    }
}

export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string, authorDetails: PersonalData[]): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];
    const referenceCount = 10;
    const semanticScholarPapers = await fetchSemanticScholarPapers(title, referenceCount);
    
    const latexAuthorsBlock = authorDetails.map(author => {
        const name = author.name || 'Unknown Author';
        const affiliation = author.affiliation ? `\\\\ ${author.affiliation}` : '';
        const orcid = author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : '';
        return `${name}${affiliation}${orcid}`;
    }).join(' \\and\n');

    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');

    const systemInstruction = `Act as a world-class LaTeX scientific paper generator. Write a complete, rigorous paper in **${languageName}**.

**METADATA FORMATTING RULES (CRITICAL):**
1.  **Title**: Use exactly \`\\title{${title}}\`.
2.  **Abstract**: Content inside \`\\begin{abstract}...\` must be high-quality summary.
3.  **Keywords**: IMMEDIATELY after \`\\end{abstract}\`, use exactly \`\\keywords{key1, key2, key3}\`. DO NOT redefine the \\keywords command in the document.
4.  **No Figures**: Do NOT use \`\\includegraphics\` or \`\\begin{figure}\`.
5.  **Citations**: Generate ${referenceCount} academic citations. No \`\\bibitem\`.
6.  **Template Compatibility**: Use ONLY the packages and structure provided in the template. DO NOT add new \`\\newcommand\` definitions that require parameters unless you follow the template.`;

    let template = ARTICLE_TEMPLATE.replace('% Babel package will be added dynamically based on language', `\\usepackage[${babelLanguage}]{babel}`)
        .replace('[INSERT REFERENCE COUNT]', String(referenceCount))
        .replace('[INSERT NEW REFERENCE LIST HERE]', Array.from({ length: referenceCount }, (_, i) => `\\noindent [REFERENCE ${i + 1} CONTENT] \\par`).join('\n\n'))
        .replace('__ALL_AUTHORS_LATEX_BLOCK__', latexAuthorsBlock)
        .replace('pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__}', `pdfauthor={${pdfAuthorNames}}`);

    const userPrompt = `Generate the paper for title: "${title}". Use the template below.
\`\`\`latex
${template}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt, { googleSearch: true });
    let paper = extractLatexFromResponse(response.text);
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter(c => c.web).map(c => ({ uri: c.web.uri, title: c.web.title })) || [];

    return { paper: postProcessLatex(paper), sources };
}

export async function analyzePaper(paperContent: string, pageCount: number, model: string): Promise<AnalysisResult> {
    const systemInstruction = `Analyze the LaTeX paper against 28 criteria. Score 0-10. Return ONLY valid JSON: { "analysis": [ { "topicNum": number, "score": number, "improvement": string } ] }`;
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            analysis: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        topicNum: { type: Type.NUMBER },
                        score: { type: Type.NUMBER },
                        improvement: { type: Type.STRING },
                    },
                    required: ["topicNum", "score", "improvement"],
                },
            },
        },
        required: ["analysis"],
    };

    const cleanPaper = stripLatexComments(paperContent);
    const contextObj = extractStrategicContext(cleanPaper);
    
    const response = await callModel(model, systemInstruction, contextObj.text, { jsonOutput: true, responseSchema: responseSchema });
    return JSON.parse(response.text.trim().replace(/^```json/i, '').replace(/```$/, '')) as AnalysisResult;
}

export async function improvePaper(paperContent: string, analysis: AnalysisResult, language: Language, model: string): Promise<string> {
    const improvementPoints = analysis.analysis.filter(item => item.score < 8.5).map(item => `- Topic ${item.topicNum}: ${item.improvement}`).join('\n');
    const systemInstruction = `Refine the LaTeX paper body based on suggestions. Return ONLY the body content starting with \\begin{document}.`;
    const response = await callModel('gemini-2.5-flash', systemInstruction, `Feedback:\n${improvementPoints}\n\nContent:\n${paperContent}`);
    let improvedBody = extractLatexFromResponse(response.text);
    const docStartIndex = paperContent.indexOf('\\begin{document}');
    if (docStartIndex !== -1 && !improvedBody.includes('\\documentclass')) {
        return postProcessLatex(paperContent.substring(0, docStartIndex) + "\n" + improvedBody);
    }
    return postProcessLatex(improvedBody);
}
