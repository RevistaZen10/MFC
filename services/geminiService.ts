
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Language, AnalysisResult, PaperSource, PersonalData } from '../types';
import { ANALYSIS_TOPICS, LANGUAGES } from '../constants';
import { ARTICLE_TEMPLATE } from './articleTemplate';

const BABEL_LANG_MAP: Record<Language, string> = {
    en: 'english',
    pt: 'brazilian',
    es: 'spanish',
    fr: 'french',
};

// Inicialização única seguindo as diretrizes do SDK
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    // Escolha automática de modelo baseado no tipo de tarefa se for genérico
    const modelToUse = model.includes('pro') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    return await ai.models.generateContent({
        model: modelToUse,
        contents: userPrompt,
        config: {
            systemInstruction: systemInstruction,
            ...(config.jsonOutput && { responseMimeType: "application/json" }),
            ...(config.responseSchema && { responseSchema: config.responseSchema }),
            ...(config.googleSearch && { tools: [{ googleSearch: {} }] }),
        },
    });
}

function postProcessLatex(latexCode: string): string {
    let code = latexCode;

    // 1. Remove redefinições de comando duplicadas
    code = code.replace(/\\(?:new|renew)command\{\\keywords\}/g, '');
    
    // 2. Remove blocos de imagem (o compilador falha se não houver arquivo real)
    code = code.replace(/\\begin\{figure\*?\}([\s\S]*?)\\end\{figure\*?\}/g, '');
    code = code.replace(/\\includegraphics\s*(\[.*?\])?\s*\{.*?\}/g, '');
    
    // 3. Corrige caracteres especiais em texto comum
    code = code.replace(/,?\s+&\s+/g, ' and ');
    
    // 4. Garante encerramento do documento
    if (!code.includes('\\end{document}')) code += '\n\\end{document}';

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

export async function generatePaperTitle(topic: string, language: Language, model: string, discipline: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const systemInstruction = `Atue como um pesquisador acadêmico expert em ${discipline}. Gere um título científico de alto impacto.`;
    const userPrompt = `Tópico: "${topic}". Idioma: **${languageName}**. Retorne apenas o texto do título.`;
    const response = await callModel(model, systemInstruction, userPrompt);
    return response.text.trim().replace(/"/g, '');
}

export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string, authorDetails: PersonalData[]): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];
    
    const latexAuthorsBlock = authorDetails.map(author => {
        const name = author.name || 'Unknown Author';
        const affiliation = author.affiliation ? `\\\\ ${author.affiliation}` : '';
        const orcid = author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : '';
        return `${name}${affiliation}${orcid}`;
    }).join(' \\and\n');

    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');

    const systemInstruction = `Atue como um gerador de artigos científicos em LaTeX. Escreva o artigo completo em **${languageName}**. 
    Não use \\includegraphics. Use o template fornecido. 
    REGRAS: 
    1. Use exatamente \\keywords{...} para palavras-chave.
    2. Não forneça o preâmbulo ou pacotes. 
    3. Retorne apenas o conteúdo entre \\begin{document} e \\end{document}.`;

    let template = ARTICLE_TEMPLATE.replace('% Babel package will be added dynamically based on language', `\\usepackage[${babelLanguage}]{babel}`)
        .replace('__ALL_AUTHORS_LATEX_BLOCK__', latexAuthorsBlock)
        .replace('pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__}', `pdfauthor={${pdfAuthorNames}}`);

    const userPrompt = `Gere o artigo científico para o título: "${title}". 
    Use esta base de código:
    ${template}`;

    const response = await callModel(model, systemInstruction, userPrompt, { googleSearch: true });
    let paper = extractLatexFromResponse(response.text);
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter(c => c.web).map(c => ({ uri: c.web.uri, title: c.web.title })) || [];

    return { paper: postProcessLatex(paper), sources };
}

export async function analyzePaper(paperContent: string, pageCount: number, model: string): Promise<AnalysisResult> {
    const systemInstruction = `Analise o artigo LaTeX contra critérios acadêmicos. Retorne apenas JSON: { "analysis": [ { "topicNum": number, "score": number, "improvement": string } ] }`;
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

    const response = await callModel(model, systemInstruction, paperContent, { jsonOutput: true, responseSchema: responseSchema });
    return JSON.parse(response.text.trim());
}

export async function improvePaper(paperContent: string, analysis: AnalysisResult, language: Language, model: string): Promise<string> {
    const improvementPoints = analysis.analysis.filter(item => item.score < 8.5).map(item => `- ${item.improvement}`).join('\n');
    const systemInstruction = `Melhore o artigo LaTeX com base no feedback. Retorne apenas o código LaTeX completo.`;
    const response = await callModel(model, systemInstruction, `Feedback:\n${improvementPoints}\n\nConteúdo:\n${paperContent}`);
    return postProcessLatex(extractLatexFromResponse(response.text));
}

export async function fixLatexPaper(paperContent: string, compilationError: string, model: string): Promise<string> {
    const systemInstruction = `Corrija erros de sintaxe LaTeX. Retorne o código completo.`;
    const response = await callModel(model, systemInstruction, `Erro:\n${compilationError}\n\nCódigo:\n${paperContent}`);
    return postProcessLatex(extractLatexFromResponse(response.text));
}
