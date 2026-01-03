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

// Fix: Initialize GoogleGenAI exclusively with process.env.API_KEY as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRateLimitHandling<T>(apiCall: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 5; 
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall();
        } catch (error: any) {
            const errorMessage = error.message?.toLowerCase() || '';
            // Exponential backoff for rate limits (429/Quota)
            if (errorMessage.includes('429') || errorMessage.includes('quota')) {
                if (attempt === MAX_RETRIES) throw error;
                let backoffTime = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
                await delay(backoffTime);
                continue;
            }
            throw error;
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
    // Fix: Directly call ai.models.generateContent with both model name and prompt as per guidelines.
    // Recommended model for complex text tasks (scientific papers) is 'gemini-3-pro-preview'.
    const targetModel = model.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    return await withRateLimitHandling(() => ai.models.generateContent({
        model: targetModel,
        contents: userPrompt,
        config: {
            systemInstruction: systemInstruction,
            ...(config.jsonOutput && { responseMimeType: "application/json" }),
            ...(config.responseSchema && { responseSchema: config.responseSchema }),
            ...(config.googleSearch && { tools: [{ googleSearch: {} }] }),
        },
    }));
}

function postProcessLatex(latexCode: string): string {
    let code = latexCode;
    
    // Limpeza de redefinições redundantes que causam erros de compilação
    code = code.replace(/\\(?:new|renew)command\{\\keywords\}(?:\[.*?\])?\{.*?\}/g, '');
    
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

export async function generatePaperTitle(topic: string, language: Language, model: string, discipline: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const systemInstruction = `Act as an expert academic researcher. Generate a single, compelling, high-impact scientific paper title.`;
    const userPrompt = `Topic: "${topic}" in ${discipline}. Language: **${languageName}**. Return ONLY the title text. No quotes.`;
    const response = await callModel(model, systemInstruction, userPrompt);
    return response.text.trim().replace(/"/g, '');
}

export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string, authorDetails: PersonalData[]): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];
    const referenceCount = 10;
    
    const latexAuthorsBlock = authorDetails.map(author => {
        const name = author.name || 'Unknown Author';
        const affiliation = author.affiliation ? `\\\\ ${author.affiliation}` : '';
        const orcid = author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : '';
        return `${name}${affiliation}${orcid}`;
    }).join(' \\and\n');

    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');

    const systemInstruction = `Act as a world-class LaTeX scientific paper generator. Write a complete, rigorous paper in **${languageName}**.

**METADATA FORMATTING RULES (STRICT):**
1.  **Title**: Use exactly \`\\title{${title}}\`.
2.  **Keywords**: Use exactly \`\\keywords{key1, key2, key3}\`.
3.  **PROHIBITION**: NEVER include \`\\newcommand{\\keywords}\` or \`\\renewcommand{\\keywords}\` in the document. This command is already provided by the system.
4.  **PROHIBITION**: NEVER include the preamble (packages, documentclass). Provide ONLY the content between \\begin{document} and \\end{document}.
5.  **Citations**: Generate ${referenceCount} academic citations. Use plain text paragraphs for references.`;

    let template = ARTICLE_TEMPLATE.replace('% Babel package will be added dynamically based on language', `\\usepackage[${babelLanguage}]{babel}`)
        .replace('[INSERT REFERENCE COUNT]', String(referenceCount))
        .replace('[INSERT NEW REFERENCE LIST HERE]', Array.from({ length: referenceCount }, (_, i) => `\\noindent [REFERENCE ${i + 1} CONTENT] \\par`).join('\n\n'))
        .replace('__ALL_AUTHORS_LATEX_BLOCK__', latexAuthorsBlock)
        .replace('pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__}', `pdfauthor={${pdfAuthorNames}}`);

    const userPrompt = `Generate the paper content for title: "${title}". Follow the template structure but DO NOT redefine system commands.
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
    // Fix: Using 'gemini-3-flash-preview' for refinement tasks as it is efficient and follows text instructions well.
    const response = await callModel('gemini-3-flash-preview', systemInstruction, `Feedback:\n${improvementPoints}\n\nContent:\n${paperContent}`);
    let improvedBody = extractLatexFromResponse(response.text);
    const docStartIndex = paperContent.indexOf('\\begin{document}');
    if (docStartIndex !== -1 && !improvedBody.includes('\\documentclass')) {
        return postProcessLatex(paperContent.substring(0, docStartIndex) + "\n" + improvedBody);
    }
    return postProcessLatex(improvedBody);
}