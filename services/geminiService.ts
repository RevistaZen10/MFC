import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Language, AnalysisResult, PaperSource, StyleGuide, SemanticScholarPaper, PersonalData } from '../types';
import { ANALYSIS_TOPICS, LANGUAGES, FIX_OPTIONS, STYLE_GUIDES, SEMANTIC_SCHOLAR_API_BASE_URL } from '../constants';
import { ARTICLE_TEMPLATE } from './articleTemplate'; // Import the single article template

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

        // Always check environment variable if keys list is still empty
        if (newKeys.length === 0 && process.env.API_KEY) {
             newKeys = [process.env.API_KEY];
        }

        this.keys = newKeys;

        // STRATEGY FOR MULTI-WINDOW SUPPORT:
        // If this is the first time loading in this window session,
        // pick a RANDOM starting index instead of 0. 
        // This ensures that if 10 tabs are opened, they statistically distribute 
        // themselves across the available keys rather than all hitting Key #1 simultaneously.
        if (!this.initialized && this.keys.length > 0) {
            this.currentIndex = Math.floor(Math.random() * this.keys.length);
            console.log(`[KeyManager] Window initialized. Randomly selected starting API Key Index: ${this.currentIndex + 1}/${this.keys.length}`);
            this.initialized = true;
        } else if (this.keys.length > 0) {
            // Ensure index is within bounds if keys were removed externally via settings
            if (this.currentIndex >= this.keys.length) {
                this.currentIndex = 0;
            }
        }
    },

    getCurrentKey: function(): string {
        // We load keys to ensure we have the latest list, but we rely on the random index set during initialization
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
        console.warn(`🔄 Rotating API Key: Switching from index ${prevIndex} to ${this.currentIndex}`);
        return true;
    }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Wrapper to create client with the CURRENT active key
function getAiClient(): GoogleGenAI {
    const apiKey = KeyManager.getCurrentKey();
    return new GoogleGenAI({ apiKey });
}

// Helper to identify errors that should trigger a key rotation (Quota, Rate Limit, Suspension)
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
        errorMessage.includes('consumer') // often appears in suspension messages
    );
}

// Executes an AI model call with automatic key rotation on Quota/429 errors
async function executeWithKeyRotation<T>(
    operation: (client: GoogleGenAI) => Promise<T>, 
    modelName: string
): Promise<T> {
    
    // Ensure keys are loaded. 
    // Note: loadKeys() will maintain the current randomized index for this window unless the list changed drastically.
    KeyManager.loadKeys(); 

    // We allow trying each key once before giving up entirely on this specific request.
    const maxAttempts = KeyManager.keys.length > 0 ? KeyManager.keys.length : 1;
    
    // However, if we only have 1 key, we still want to retry transient errors a few times.
    // The inner retry logic inside `withRateLimitHandling` handles transient 500s/429s.
    // This outer loop handles "Hard Quota" or "Persistent 429" by switching keys.
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const client = getAiClient();
            return await withRateLimitHandling(() => operation(client));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            // Check if error is related to quota or exhaustion
            const shouldRotate = isRotationTrigger(error);

            // If it's a quota/auth error and we have more keys, rotate and continue loop
            if (shouldRotate && KeyManager.keys.length > 1) {
                console.warn(`⚠️ API Key (Index ${KeyManager.currentIndex}) exhausted or suspended. Attempting to rotate... Error: ${errorMessage}`);
                KeyManager.rotate();
                
                // Add a SIGNIFICANT safety delay during rotation.
                // Google tracks RPM (requests per minute) across keys from the same IP often.
                // Hammering rotate too fast can suspend the next key immediately.
                console.log("Waiting 10 seconds before trying next key to clear IP rate limits...");
                await delay(10000); 
                
                continue; 
            }

            // If it's not a quota error, or we ran out of keys, throw the error up
            // Note: If we are on the last key and it fails on quota, the loop ends and we throw.
            if (attempt === maxAttempts - 1) {
                // If this was the last key, we modify the error message to ensure App.tsx detects it as exhaustion
                if (shouldRotate) {
                    throw new Error(`All Gemini API Keys exhausted (Quota/Suspended). Last error: ${errorMessage}`);
                }
                throw error;
            }
            
            throw error; // Non-quota errors (like 400 Bad Request) shouldn't rotate keys usually.
        }
    }
    
    throw new Error("All Gemini API Keys exhausted (Rotation loop ended without success).");
}

async function withRateLimitHandling<T>(apiCall: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 5; 
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall(); // Success!
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
            
            // Hard failure for model non-existence or strict 0 quota
            if (errorMessage.includes('limit: 0') || errorMessage.includes('quota exceeded for metric')) {
                 throw new Error(`API Quota Exceeded (Limit: 0) or Model Unavailable: ${errorMessage}`);
            }

            const shouldRotate = isRotationTrigger(error);
            const hasBackupKeys = KeyManager.keys.length > 1;

            // OPTIMIZATION: If we hit a quota/auth limit and have other keys available, 
            // throw immediately so `executeWithKeyRotation` can switch to the next key.
            // Do NOT waste time retrying on a dead key if we have backups.
            if (shouldRotate && hasBackupKeys) {
                throw error;
            }

            // If it's the last attempt, propagate error so rotation logic can catch it (if applicable) or fail
            if (attempt === MAX_RETRIES) {
                if (shouldRotate) {
                    throw new Error(`Quota Exceeded or Key Suspended: ${errorMessage}`);
                 }
                 if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
                    throw new Error("The AI model is temporarily overloaded. Please try again in a few moments.");
                 }
                throw error;
            }

            let backoffTime;
            if (shouldRotate) {
                // If we are here, we have only 1 key (or no backups loaded) and hit 429/403. We must wait.
                // Note: Waiting on 403 Suspended won't help, but logic dictates we try if no backups.
                // UPDATED: Increased backoff time significantly to prevent suspension cascades.
                backoffTime = 8000 + Math.random() * 4000;
            } else {
                // Transient error (503, etc). Exponential backoff.
                console.log("Transient error detected. Using exponential backoff...");
                backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
            }
            
            console.log(`Waiting for ${backoffTime.toFixed(0)}ms before retrying on same key...`);
            await delay(backoffTime);
        }
    }
    throw new Error("API call failed after internal retries.");
}

// Central dispatcher for different AI models
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
    console.log(`[Gemini Service] Calling model: ${model}`); // LOG FOR VERIFICATION

    if (model.startsWith('gemini-')) {
        // Wrap the generation logic in the rotation handler
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

            // Fallback Logic requested: If gemini-2.5-flash fails due to quota, switch to gemini-2.0-flash
            if (isQuotaExhausted && model === 'gemini-2.5-flash') {
                const fallbackModel = 'gemini-2.0-flash';
                console.warn(`[Gemini Service] Primary model ${model} quota exhausted. Falling back to ${fallbackModel} as requested.`);
                
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

    } else if (model.startsWith('grok-')) {
        // Grok logic remains unchanged (single key support)
        const apiKey = localStorage.getItem('xai_api_key');
        if (!apiKey) {
            throw new Error("x.ai API key not found. Please set it in the settings modal (gear icon).");
        }

        const messages = [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
        ];

        const apiCall = async () => {
            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: false,
                    temperature: 0,
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`x.ai API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';
            
            const reconstructedResponse = {
                candidates: [{
                    content: { parts: [{ text: text }], role: 'model' },
                    finishReason: 'STOP',
                    index: 0,
                    safetyRatings: [],
                    groundingMetadata: { groundingChunks: [] }
                }],
                functionCalls: [],
                get text() {
                    return this.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
                }
            };
            return reconstructedResponse as GenerateContentResponse;
        };

        return withRateLimitHandling(apiCall);
    } else {
        throw new Error(`Unsupported model: ${model}`);
    }
}


export async function generatePaperTitle(topic: string, language: Language, model: string, discipline: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';

    // OPTIMIZATION: Compressed system instruction for token saving
    const systemInstruction = `Act as an expert academic researcher in ${discipline}. Generate a single, compelling, high-impact scientific paper title.`;
    
    // Updated user prompt to remove hardcoded "mathematical" bias
    const userPrompt = `Topic: "${topic}" in ${discipline}.
    Task: Generate a single, novel, specific, high-impact research title.
    Language: **${languageName}**.
    Constraint: Return ONLY the title text. No quotes.`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates for title. Prompt likely blocked by safety filters.");
    }
    
    // Safety check for empty response
    if (!response.text) {
         throw new Error("AI returned an empty response text for the title generation.");
    }
    
    return response.text.trim().replace(/"/g, ''); // Clean up any accidental quotes
}


// Programmatic post-processing to fix common LaTeX issues
function postProcessLatex(latexCode: string): string {
    let code = latexCode;

    // 1. ROBUSTLY STRIP IMAGES (Fix for "File not found" errors)
    // AI often hallucinates \includegraphics despite instructions. We must surgically remove them.
    // Removes \begin{figure}...\end{figure} and \begin{figure*}...\end{figure*} blocks
    code = code.replace(/\\begin\{figure\*?\}([\s\S]*?)\\end\{figure\*?\}/g, '');
    
    // Removes \includegraphics[...]{...} and \includegraphics{...} with potential whitespace
    code = code.replace(/\\includegraphics\s*(\[.*?\])?\s*\{.*?\}/g, '');
    
    // Removes \captionof{figure}{...} if present, tolerant to spaces
    code = code.replace(/\\captionof\s*\{figure\}\s*\{.*?\}/g, '');

    // 2. Fix Authors Ampersand
    code = code.replace(/,?\s+&\s+/g, ' and ');
    
    // 3. Strip CJK characters (Compilation Fix)
    code = code.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g, '');

    // 4. AUTO-CLOSE ENVIRONMENTS (Fix for "\begin{itemize} ended by \end{document}")
    // If the AI output is truncated, lists might be left open. We check and close them.
    // We only check for the most common ones: itemize, enumerate, description.
    
    const environments = ['itemize', 'enumerate', 'description'];
    
    environments.forEach(env => {
        const beginRegex = new RegExp(`\\\\begin\\{${env}\\}`, 'g');
        const endRegex = new RegExp(`\\\\end\\{${env}\\}`, 'g');
        const openCount = (code.match(beginRegex) || []).length;
        const closeCount = (code.match(endRegex) || []).length;
        
        if (openCount > closeCount) {
            const diff = openCount - closeCount;
            const closingTags = `\\end{${env}}`.repeat(diff);
            
            // Append missing end tags before \end{document} or at end of string
            const docEndIdx = code.lastIndexOf('\\end{document}');
            if (docEndIdx !== -1) {
                code = code.substring(0, docEndIdx) + `\n${closingTags}\n` + code.substring(docEndIdx);
            } else {
                code += `\n${closingTags}`;
            }
        }
    });

    // 5. Ensure Document Ends
    if (!code.includes('\\end{document}')) {
        code += '\n\\end{document}';
    }

    // 6. Ensure Clean Start (Remove AI chatter before \documentclass)
    const docClassIdx = code.indexOf('\\documentclass');
    if (docClassIdx > 0) {
        code = code.substring(docClassIdx);
    }

    return code;
}

// Helper to robustly extract LaTeX code from AI response
function extractLatexFromResponse(text: string): string {
    if (!text) return '';
    
    // First, try to capture content inside ```latex ... ``` blocks
    const match = text.match(/```latex\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // Fallback: strip markdown delimiters if they are just at start/end
    let cleaned = text.trim();
    if (cleaned.startsWith('```latex')) cleaned = cleaned.substring(8);
    else if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
    
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
    
    return cleaned.trim();
}

/**
 * Strips comments from LaTeX code to save tokens.
 * Matches '%' that are at the start of a line OR not preceded by a backslash.
 */
function stripLatexComments(text: string): string {
    return text.replace(/(^|[^\\])%.*$/gm, '$1').trim();
}

/**
 * Extracts only the body content between \begin{document} and \end{document}
 * to save tokens during analysis.
 */
function extractDocumentBody(latex: string): string {
    const beginTag = '\\begin{document}';
    const endTag = '\\end{document}';
    const startIndex = latex.indexOf(beginTag);
    const endIndex = latex.lastIndexOf(endTag);
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        // Return content inside document environment, trimmed
        return latex.substring(startIndex + beginTag.length, endIndex).trim();
    }
    // Fallback: if tags are not found or malformed, return the full (stripped) latex
    return latex;
}

/**
 * STRATEGIC OPTIMIZATION:
 * Extracts only the Abstract, Introduction, and Conclusion.
 * This reduces input tokens for analysis by ~60-70% while keeping the critical
 * "promise" (Intro) and "delivery" (Conclusion) context.
 */
function extractStrategicContext(latex: string): { text: string, isTruncated: boolean } {
    let combined = "";
    
    // 1. Extract Abstract
    const abstractMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/i);
    if (abstractMatch) {
        combined += "\\section*{Abstract}\n" + abstractMatch[1].trim() + "\n\n";
    }

    // 2. Extract Introduction
    // Matches content starting at \section{Introduction} until the next \section
    const introMatch = latex.match(/\\section\{(?:Introduction|Introdução)\}([\s\S]*?)(?=\\section\{)/i);
    if (introMatch) {
        combined += "\\section{Introduction}\n" + introMatch[1].trim() + "\n\n";
        combined += "\n% ... [MIDDLE SECTIONS (Literature, Methodology, Results, Discussion) OMITTED FOR AI ANALYSIS EFFICIENCY] ...\n\n";
    }

    // 3. Extract Conclusion
    // Matches content starting at \section{Conclusion} until the next \section or end of doc
    const conclusionMatch = latex.match(/\\section\{(?:Conclusion|Conclusão|Considerações Finais)\}([\s\S]*?)(?=\\section\{|\\end\{document\})/i);
    if (conclusionMatch) {
        combined += "\\section{Conclusion}\n" + conclusionMatch[1].trim() + "\n\n";
    }

    // Safety Fallback: If regex failed (e.g. customized section names) or result is too short,
    // revert to full body extraction to ensure the AI has something to analyze.
    if (combined.length < 500) {
        return { text: extractDocumentBody(latex), isTruncated: false };
    }

    return { text: combined, isTruncated: true };
}

/**
 * Fetches papers from the Semantic Scholar API based on a query.
 * PROXIED to avoid CORS issues in the browser.
 * @param query The search query string (e.g., paper title).
 * @param limit The maximum number of papers to fetch.
 * @returns A promise that resolves to an array of SemanticScholarPaper objects.
 */
async function fetchSemanticScholarPapers(query: string, limit: number = 5): Promise<SemanticScholarPaper[]> {
    try {
        const fields = 'paperId,title,authors,abstract,url'; // Requesting specific fields
        
        // Use the local proxy instead of direct call
        const response = await fetch(`/semantic-proxy?query=${encodeURIComponent(query)}&limit=${limit}&fields=${fields}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Semantic Scholar API error (via Proxy): ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        // Semantic Scholar API returns data.data for the list of papers
        return data.data || [];
    } catch (error) {
        console.error("Error fetching from Semantic Scholar:", error);
        return [];
    }
}


export async function generateInitialPaper(title: string, language: Language, pageCount: number, model: string, authorDetails: PersonalData[]): Promise<{ paper: string, sources: PaperSource[] }> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const babelLanguage = BABEL_LANG_MAP[language];

    // Reduced from 20 to 10 to save tokens as requested by user
    const referenceCount = 10;

    const referencePlaceholders = Array.from(
        { length: referenceCount },
        (_, i) => `[INSERT REFERENCE ${i + 1} HERE]`
    ).join('\n\n');

    // Fetch Semantic Scholar papers, matching the number of references needed
    const semanticScholarPapers = await fetchSemanticScholarPapers(title, referenceCount);
    const semanticScholarContext = semanticScholarPapers.length > 0
        ? "\n\n**Additional Academic Sources from Semantic Scholar (prioritize these):**\n" +
          semanticScholarPapers.map(p => 
              `- Title: ${p.title}\n  Authors: ${p.authors.map(a => a.name).join(', ')}\n  Abstract: ${p.abstract || 'N/A'}\n  URL: ${p.url}`
          ).join('\n---\n')
        : "";

    // Generate LaTeX author block for multiple authors
    const latexAuthorsBlock = authorDetails.map((author, index) => {
        const name = author.name || 'Unknown Author';
        const affiliation = author.affiliation ? `\\\\ ${author.affiliation}` : '';
        const orcid = author.orcid ? `\\\\ \\small ORCID: \\url{https://orcid.org/${author.orcid}}` : '';
        return `${name}${affiliation}${orcid}`;
    }).join(' \\and\n'); // Use \and for multiple authors in LaTeX

    const pdfAuthorNames = authorDetails.map(a => a.name).filter(Boolean).join(', ');

    // OPTIMIZATION: Compressed System Instruction
    const systemInstruction = `Act as a world-class AI specialized in generating LaTeX scientific papers. Write a complete, rigorous paper based on the title, strictly following the provided LaTeX template.

**Rules:**
1.  **Use Template:** Fill all placeholders [INSERT...] with relevant content.
2.  **References:** Generate ${referenceCount} unique, **strictly academic citations** from peer-reviewed journals, scholarly books, and conference papers. **You MUST AVOID citing general websites, blogs, or news articles.** Format as plain paragraphs (\\noindent ... \\par). NO \\bibitem. NO URLs.
3.  **Language:** Write in **${languageName}**.
4.  **Format:** Return valid LaTeX. NO ampersands (&) in text (use 'and'). NO CJK characters. Escape special chars (%, _, $).
5.  **Structure:** Do NOT change commands. PRESERVE \\author/\\date verbatim.
6.  **Content:** Generate detailed content for each section to meet ~${pageCount} pages.
7.  **CRITICAL - NO IMAGES:** Do NOT use \\includegraphics, \\begin{figure}, or \\caption. Text only.
`;

    // Dynamically insert the babel package and reference placeholders into the template for the prompt
    let templateWithBabelAndAuthor = ARTICLE_TEMPLATE.replace(
        '% Babel package will be added dynamically based on language',
        `\\usepackage[${babelLanguage}]{babel}`
    ).replace(
        '[INSERT REFERENCE COUNT]',
        String(referenceCount)
    ).replace(
        '[INSERT NEW REFERENCE LIST HERE]',
        referencePlaceholders
    );

    // Replace dynamic author information using new, client-side generated block
    templateWithBabelAndAuthor = templateWithBabelAndAuthor.replace(
        '__ALL_AUTHORS_LATEX_BLOCK__', // This placeholder now represents the entire \author block
        latexAuthorsBlock
    );
    templateWithBabelAndAuthor = templateWithBabelAndAuthor.replace(
        'pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__}', // Placeholder for pdfauthor in hypersetup
        `pdfauthor={${pdfAuthorNames}}`
    );

    const userPrompt = `Title: "${title}".
${semanticScholarContext}
**Template:**
\`\`\`latex
${templateWithBabelAndAuthor}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt, { googleSearch: true });
    
    // Detailed error reporting for empty responses
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates. This usually means the model refused the prompt (safety/policy).");
    }
    
    if (!response.text) {
        const candidate = response.candidates[0];
        const reason = candidate.finishReason || 'UNKNOWN';
        const safetyRatings = candidate.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || 'None';
        throw new Error(`AI returned an empty text response. Finish Reason: ${reason}. Safety Ratings: [${safetyRatings}].`);
    }

    let paper = extractLatexFromResponse(response.text);
    
    // Ensure the paper ends with \end{document}
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }
    
    const sources: PaperSource[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter(chunk => chunk.web)
        .map(chunk => ({
            uri: chunk.web.uri,
            title: chunk.web.title,
        })) || [];

    return { paper: postProcessLatex(paper), sources };
}

// Robust JSON cleaner to handle AI hallucinations
function cleanJsonOutput(text: string): string {
    let cleaned = text.trim();
    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '');
    
    // Check for repetition loops like "\nobreak\nobreak"
    if (cleaned.includes("nobreak\nobreak") || cleaned.includes("nobreaknobreak")) {
        throw new Error("Model output contained a repetition loop (nobreak).");
    }
    
    return cleaned.trim();
}

export async function analyzePaper(paperContent: string, pageCount: number, model: string): Promise<AnalysisResult> {
    const analysisTopicsList = ANALYSIS_TOPICS.map(t => `- Topic ${t.num} (${t.name}): ${t.desc}`).join('\n');
    
    // OPTIMIZATION: Compressed System Instruction
    const systemInstruction = `Act as an expert academic reviewer. Perform a rigorous, objective analysis of the LaTeX paper.

    **Task:**
    1.  Analyze paper against criteria.
    2.  Score each 0.0-10.0 (10=perfect).
    3.  Provide ONE concise, critical improvement suggestion per topic.
    4.  Topic 28 (Page Count): Score based on target ${pageCount} pages.

    **Output:**
    -   Return ONLY valid JSON.
    -   Schema: { "analysis": [ { "topicNum": number, "score": number, "improvement": string } ] }
    -   No markdown, no text explanations.

    **Criteria:**
    ${analysisTopicsList}
    `;
    
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

    // Calculate rough page estimate from the FULL content before stripping (approx 3000 chars per page in LaTeX)
    const estimatedPagesFromChars = Math.max(1, Math.round(paperContent.length / 3000));

    // Strip comments to reduce token usage
    let cleanPaper = stripLatexComments(paperContent);
    
    // OPTIMIZATION: Strip References section for ANALYSIS ONLY.
    // The references consume a lot of tokens but aren't strictly necessary for the AI to judge structure/flow/argumentation.
    // This saves ~10-15% input tokens.
    // Regex matches \section{References} or \section{Referências} and everything following it until the end of the string.
    cleanPaper = cleanPaper.replace(/\\section\{(?:References|Referências)\}[\s\S]*$/, '');

    // CRITICAL FIX: Detect ungenerated placeholders in the FULL content BEFORE stripping context.
    // If the strategic extraction removes the middle sections (where the placeholders usually are),
    // the AI won't see them and will give a high score, ending the loop prematurely.
    const hasUnfilledPlaceholders = cleanPaper.includes('[INSERT NEW CONTENT');

    // OPTIMIZATION: Context Stripping / Strategic Extraction
    // We only send the Abstract, Introduction and Conclusion for analysis to save massive tokens.
    // The middleware is assumed good if the "bookends" (Intro/Conclusion) are solid.
    const contextObj = extractStrategicContext(cleanPaper);
    const paperToAnalyze = contextObj.text;

    // Modify prompt to inform AI about the truncation if it happened
    const truncationNote = contextObj.isTruncated 
        ? `\n\n**NOTE:** Text is a **STRATEGIC EXTRACT** (Abstract+Intro+Conclusion) of a ${estimatedPagesFromChars}-page doc. References are omitted. Assume missing sections exist for structure/page-count scores.`
        : "";

    const finalSystemInstruction = systemInstruction + truncationNote;

    // Retry logic for JSON parsing failures
    const MAX_PARSE_RETRIES = 3;
    
    for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
        try {
            // Use strategic paper context instead of full body
            const response = await callModel(model, finalSystemInstruction, paperToAnalyze, {
                jsonOutput: true,
                responseSchema: responseSchema
            });

            if (!response.candidates || response.candidates.length === 0) {
                 throw new Error("AI returned no candidates for analysis.");
            }

            if (!response.text) {
                throw new Error("AI returned an empty response for the analysis.");
            }

            const jsonText = cleanJsonOutput(response.text);
            const result = JSON.parse(jsonText) as AnalysisResult;

            // POST-ANALYSIS OVERRIDE
            // If we detected placeholders in the full text, we MUST force the "Improvement" step.
            // We overwrite the score for Topic 13 (Structure) to ensure the Editor AI fixes it.
            if (hasUnfilledPlaceholders) {
                console.warn("⚠️ Placeholder detected in content. Forcing score downgrade.");
                const structureTopicIndex = result.analysis.findIndex(a => a.topicNum === 13);
                const placeholderCritique = {
                    topicNum: 13,
                    score: 2.0,
                    improvement: "CRITICAL: The document contains unfinished template placeholders (e.g., [INSERT NEW CONTENT...]). You MUST generate the missing content for these sections immediately."
                };

                if (structureTopicIndex !== -1) {
                    result.analysis[structureTopicIndex] = placeholderCritique;
                } else {
                    result.analysis.push(placeholderCritique);
                }
            }

            return result;

        } catch (error) {
            console.warn(`Attempt ${attempt} to analyze paper failed (JSON Parse/Validation):`, error);
            
            // If it's the last attempt, fail loudly so the automation can handle it (or skip to next)
            if (attempt === MAX_PARSE_RETRIES) {
                throw new Error(`The analysis returned an invalid format after ${MAX_PARSE_RETRIES} attempts. Last error: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // Short delay before retry to let potential hiccups settle
            await delay(2000);
        }
    }
    
    throw new Error("Unexpected error in analysis loop.");
}


export async function improvePaper(paperContent: string, analysis: AnalysisResult, language: Language, model: string): Promise<string> {
    const languageName = LANGUAGES.find(l => l.code === language)?.name || 'English';
    const improvementPoints = analysis.analysis
        .filter(item => item.score < 8.5)
        .map(item => {
            // FIX: Corrected property access from 'item.num' to 'item.topicNum'
            const topic = ANALYSIS_TOPICS.find(t => t.num === item.topicNum);
            const topicName = topic ? topic.name : `UNKNOWN TOPIC (${item.topicNum})`;
            return `- **${topicName}**: ${item.improvement}`;
        })
        .join('\n');

    // OPTIMIZATION: Compressed System Instruction
    const systemInstruction = `Act as an expert LaTeX editor. Refine the provided paper body based on suggestions.

    **Rules:**
    1.  **Scope:** Improve ONLY the provided body content.
    2.  **Output:** Return valid LaTeX body (from \\begin{document} to \\end{document}). NO Preamble.
    3.  **Language:** **${languageName}**.
    4.  **Formatting:** NO \\bibitem. NO URLs. Use 'and' instead of '&'. NO CJK chars.
    5.  **Placeholders:** Fill any remaining placeholders like [INSERT NEW CONTENT...].
    6.  **Safety:** Do not add \\newpage. NO IMAGES (\\includegraphics).
    `;

    // Strip comments to reduce input token usage, AI will rewrite content anyway
    const cleanPaper = stripLatexComments(paperContent);
    
    // OPTIMIZATION: PREAMBLE SURGERY
    // We split the Preamble (static) from the Body (dynamic).
    // We send ONLY the body to the AI to be rewritten, saving massive Output tokens.
    // We send the Preamble only as context.
    const docStartIndex = cleanPaper.indexOf('\\begin{document}');
    let preamble = "";
    let bodyToImprove = cleanPaper;

    if (docStartIndex !== -1) {
        preamble = cleanPaper.substring(0, docStartIndex);
        bodyToImprove = cleanPaper.substring(docStartIndex);
    } else {
        // Fallback if document structure is weird: Send full text
        console.warn("Could not find \\begin{document} for splitting. Sending full text.");
    }

    const userPrompt = `Context (Preamble - DO NOT EDIT/OUTPUT THIS):
${preamble}

Body to Improve:
${bodyToImprove}

Feedback to Apply:
${improvementPoints}

Task: Return the COMPLETE, IMPROVED body starting with \\begin{document}.`;

    // FORCED OPTIMIZATION: Use flash model to save quota/tokens during improvement loop
    const response = await callModel('gemini-2.5-flash', systemInstruction, userPrompt);
    
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("AI returned no candidates for improvement.");
    }
    
    if (!response.text) {
        throw new Error("AI returned an empty response for the improvement step.");
    }

    let improvedBody = extractLatexFromResponse(response.text);

    // STITCHING: If we successfully split, we must re-attach the preamble.
    // We check if the AI followed instructions and returned only the body (starts with \begin{document} or similar)
    // or if it returned a full document (contains \documentclass).
    if (docStartIndex !== -1 && !improvedBody.includes('\\documentclass')) {
        // AI behaved: It returned the body. Stitch it.
        return postProcessLatex(preamble + "\n" + improvedBody);
    } 
    
    // AI misbehaved or we didn't split: It returned a full doc. Return as is.
    // Ensure the paper ends with \end{document}
    if (!improvedBody.includes('\\end{document}')) {
        improvedBody += '\n\\end{document}';
    }

    return postProcessLatex(improvedBody);
}

export async function fixLatexPaper(paperContent: string, compilationError: string, model: string): Promise<string> {
    // OPTIMIZATION: Compressed System Instruction
    const systemInstruction = `Act as an expert LaTeX debugger. Fix compilation errors.

    **Rules:**
    1.  **Precision:** Fix ONLY the error. Do not refactor.
    2.  **Output:** Full valid LaTeX document.
    3.  **Specific Fixes:**
        -   Error "&": Replace with 'and'.
        -   Error "Unicode": Remove CJK chars (Chinese/Japanese).
        -   Error "File not found": REMOVE \\includegraphics.
    4.  **Prohibited:** NO \\bibitem, NO \\cite, NO URLs, NO IMAGES.
    `;

    const userPrompt = `Error:
\`\`\`
${compilationError}
\`\`\`

Code:
\`\`\`latex
${paperContent}
\`\`\`
`;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    // Safety check
    if (!response.text) {
        throw new Error("AI returned an empty response for the fix step.");
    }
    
    let paper = extractLatexFromResponse(response.text);
    
    // Ensure the paper ends with \end{document}
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}

export async function reformatPaperWithStyleGuide(paperContent: string, styleGuide: StyleGuide, model: string): Promise<string> {
    const styleGuideInfo = STYLE_GUIDES.find(g => g.key === styleGuide);
    if (!styleGuideInfo) {
        throw new Error(`Unknown style guide: ${styleGuide}`);
    }

    // OPTIMIZATION: Compressed System Instruction
    const systemInstruction = `Act as academic editor. Reformat ONLY the References section.

    **Rules:**
    1.  **Style:** ${styleGuideInfo.name}.
    2.  **Scope:** Edit ONLY content in \\section{References}. Keep preamble/body exact.
    3.  **Format:** Plain list. NO \\bibitem. NO URLs.
    4.  **Output:** Full LaTeX document.
    `;

    const userPrompt = `Reformat references to ${styleGuideInfo.name}.

    **Document:**
    \`\`\`latex
    ${paperContent}
    \`\`\`
    `;

    const response = await callModel(model, systemInstruction, userPrompt);
    
    // Safety check
    if (!response.text) {
        throw new Error("AI returned an empty response for the reformat step.");
    }

    let paper = extractLatexFromResponse(response.text);

    // Ensure the paper ends with \end{document}
    if (!paper.includes('\\end{document}')) {
        paper += '\n\\end{document}';
    }

    return postProcessLatex(paper);
}