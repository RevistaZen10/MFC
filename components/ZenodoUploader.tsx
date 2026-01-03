
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { ZenodoAuthor, ExtractedMetadata } from '../types';

interface ZenodoUploaderProps {
    title: string;
    abstractText: string;
    keywords: string;
    authors: ZenodoAuthor[];
    compiledPdfFile: File | null;
    onFileSelect: (file: File | null) => void; // Keep for potential override or manual selection
    onPublishStart: () => void;
    onPublishSuccess: (result: { doi: string; zenodoLink: string; }) => void;
    onPublishError: (message: string) => void;
    extractedMetadata: ExtractedMetadata | null; // Used for displaying extracted data
}

export interface ZenodoUploaderRef {
    submit: () => void;
}

const ZenodoUploader = forwardRef<ZenodoUploaderRef, ZenodoUploaderProps>(({ 
    title, abstractText, keywords, authors, compiledPdfFile, onFileSelect, onPublishStart, onPublishSuccess, onPublishError,
    extractedMetadata
}, ref) => {
    const [useSandbox, setUseSandbox] = useState(true);
    const [zenodoToken, setZenodoToken] = useState(() => localStorage.getItem('zenodo_api_key') || ''); 
    const [publicationLog, setPublicationLog] = useState<string[]>([]);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Sincronizar token local com localStorage quando o componente for montado ou o localStorage mudar
    useEffect(() => {
        const stored = localStorage.getItem('zenodo_api_key');
        if (stored !== null && stored !== zenodoToken) {
            setZenodoToken(stored);
        }
    }, []);

    // Persistir token sempre que for alterado no campo
    const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setZenodoToken(val);
        localStorage.setItem('zenodo_api_key', val);
    };

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [publicationLog]);

    const log = (message: string) => {
        setPublicationLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };
    
    const submit = async () => {
        if (!compiledPdfFile) {
            const errorMsg = "Error: No PDF file has been provided for upload. Please compile or upload one in the previous step.";
            log(errorMsg);
            onPublishError(errorMsg);
            return;
        }

        if (!zenodoToken) {
            const errorMsg = "Error: Please enter your Zenodo access token!";
            log(errorMsg);
            onPublishError(errorMsg);
            return;
        }

        onPublishStart();
        setPublicationLog([]); // Clear previous logs
        log("Initiating publication to Zenodo...");

        const ZENODO_API_URL_BASE = useSandbox 
            ? 'https://sandbox.zenodo.org/api' 
            : 'https://zenodo.org/api';
        
        // Helper to wrap URL with proxy
        const proxied = (url: string) => `/zenodo-proxy?target=${encodeURIComponent(url)}`;

        try {
            // Step 1: Create a new deposition
            log("Step 1: Creating a new deposition...");
            const dep_res = await fetch(proxied(`${ZENODO_API_URL_BASE}/deposit/depositions`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${zenodoToken}` },
                body: JSON.stringify({})
            });

            if (!dep_res.ok) {
                const errorText = await dep_res.text();
                throw new Error(`Failed to create deposition: ${dep_res.status} - ${errorText}. Please check your token and permissions (deposit:write, deposit:actions).`);
            }
            const deposition = await dep_res.json();
            const depositionId = deposition.id;
            
            const bucketUrl = deposition.links.bucket;
            if (!bucketUrl) {
                throw new Error('Could not find the bucket upload URL in the Zenodo API response.');
            }
            log(`Deposition created successfully. ID: ${depositionId}`);

            // Step 2: Upload the file to the bucket URL
            log(`Step 2: Uploading file "${compiledPdfFile.name}" to bucket...`);
            const file_res = await fetch(proxied(`${bucketUrl}/${compiledPdfFile.name}`), {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${zenodoToken}`,
                    'Content-Type': 'application/octet-stream'
                },
                body: compiledPdfFile
            });

            if (!file_res.ok) {
                const errorText = await file_res.text();
                throw new Error(`Failed to upload file: ${file_res.status} - ${errorText}`);
            }
            log("File upload completed.");
            
            // Step 3: Add metadata
            log("Step 3: Adding metadata...");
            const metadata = {
                metadata: {
                    title: title,
                    upload_type: 'publication',
                    publication_type: 'article',
                    description: abstractText,
                    creators: authors.filter(a => a.name).map(author => ({
                        name: author.name,
                        // Affiliation is intentionally omitted as requested for the Zenodo submission.
                        orcid: author.orcid || undefined
                    })),
                    keywords: keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
                }
            };
            const meta_res = await fetch(proxied(`${ZENODO_API_URL_BASE}/deposit/depositions/${depositionId}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${zenodoToken}` },
                body: JSON.stringify(metadata)
            });
            if (!meta_res.ok) {
                const errorText = await meta_res.text();
                throw new Error(`Failed to add metadata: ${meta_res.status} - ${errorText}`);
            }
            log("Metadata added successfully.");

            // Step 4: Publish
            log("Step 4: Publishing the deposition...");
            const pub_res = await fetch(proxied(`${ZENODO_API_URL_BASE}/deposit/depositions/${depositionId}/actions/publish`), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${zenodoToken}` }
            });
            if (!pub_res.ok) {
                const errorText = await pub_res.text();
                throw new Error(`Failed to publish: ${pub_res.status} - ${errorText}`);
            }
            const finalResult = await pub_res.json();
            log("🎉 Publication completed successfully!");
            log(`DOI: ${finalResult.doi}`);
            log(`Link: ${finalResult.links.html}`);

            onPublishSuccess({
                doi: finalResult.doi,
                zenodoLink: finalResult.links.html
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            log(`❌ Error: ${errorMessage}`);
            onPublishError(errorMessage);
        }
    };

    useImperativeHandle(ref, () => ({
        submit
    }));
    
    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <div className="text-center p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg" aria-live="polite">
                {compiledPdfFile ? (
                    <div className="flex items-center justify-center text-green-600">
                        <svg className="h-8 w-8 mr-3 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        <div>
                            <span className="block text-sm font-semibold">PDF Loaded</span>
                            <span className="block text-xs text-gray-500">{compiledPdfFile.name}</span>
                            {/* Removed remove button here, as file handling is upstream */}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center text-gray-600">
                         <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm font-semibold block ml-3">No PDF file selected. Please compile or upload one in Step 3.</span>
                    </div>
                )}
            </div>

            {/* Metadados para o Zenodo */}
            {extractedMetadata && (
                <div className="space-y-4">
                    <div className="form-group">
                        <label htmlFor="zenodoTitle">📌 Title:</label>
                        <input type="text" id="zenodoTitle" value={title} readOnly className="block w-full p-2 border rounded" aria-label="Paper Title"/>
                    </div>

                    <div className="form-group">
                        <label htmlFor="zenodoAbstract">📄 Abstract:</label>
                        <textarea id="zenodoAbstract" rows={4} value={abstractText} readOnly className="block w-full p-2 border rounded" aria-label="Paper Abstract"></textarea>
                    </div>

                    <div className="form-group">
                        <label>👥 Authors:</label>
                        <div id="authorsList" className="space-y-2">
                            {authors.length > 0 ? (
                                authors.map((author, index) => (
                                    <div key={index} className="author-item p-2 border rounded bg-gray-50">
                                        <input type="text" value={author.name || 'Unknown Author'} readOnly style={{ marginBottom: '4px' }} className="block w-full p-1 text-sm bg-gray-50 border-none" aria-label={`Author ${index + 1} Name`}/>
                                        {/* Affiliation input removed as per user request */}
                                        {author.orcid && <input type="text" value={author.orcid} placeholder="ORCID (optional)" readOnly className="block w-full p-1 text-sm bg-gray-50 border-none" aria-label={`Author ${index + 1} ORCID`}/>}
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 text-sm p-2 bg-gray-50 rounded">No authors automatically extracted.</p>
                            )}
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="zenodoKeywords">🏷️ Keywords:</label>
                        <input type="text" id="zenodoKeywords" value={keywords} placeholder="keyword1, keyword2, keyword3" readOnly className="block w-full p-2 border rounded" aria-label="Paper Keywords"/>
                    </div>
                </div>
            )}


            {/* Log Panel */}
            {publicationLog.length > 0 && (
                 <div className="mt-4 p-4 bg-gray-900 text-white rounded-lg max-h-48 overflow-y-auto font-mono text-xs" ref={logContainerRef} aria-live="polite">
                    {publicationLog.map((log, index) => <p key={index} className="whitespace-pre-wrap">{log}</p>)}
                </div>
            )}

            {/* Sandbox Toggle */}
            <div className="flex items-center justify-center pt-4 border-t border-gray-200">
                <input
                    type="checkbox"
                    id="sandbox"
                    checked={useSandbox}
                    onChange={(e) => setUseSandbox(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    aria-checked={useSandbox}
                    aria-label="Use Zenodo Sandbox for testing"
                />
                <label htmlFor="sandbox" className="ml-2 block text-sm text-gray-900">
                    Use Zenodo Sandbox (for testing)
                </label>
            </div>
            {/* Zenodo Token Input */}
            <div className="form-group mt-4">
                <label htmlFor="zenodoToken">🔑 Zenodo Access Token:</label>
                <input 
                    type="password" 
                    id="zenodoToken" 
                    placeholder="Your Zenodo token" 
                    value={zenodoToken} 
                    onChange={handleTokenChange} 
                    className="block w-full p-2 border rounded"
                    aria-required="true"
                    aria-label="Zenodo Access Token"
                />
                <small style={{ color: '#6b7280', fontSize: '12px' }}>
                    Obtain from: <a href="https://sandbox.zenodo.org/account/settings/applications/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Zenodo Sandbox</a> or 
                    <a href="https://zenodo.org/account/settings/applications/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Zenodo Production</a>. Ensure permissions for `deposit:write` and `deposit:actions`.
                </small>
            </div>
        </div>
    );
});

export default ZenodoUploader;
