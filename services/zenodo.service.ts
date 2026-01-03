
// services/zenodo.service.ts
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';
import https from 'https';

const ZENODO_API_URL = 'https://zenodo.org/api/deposit/depositions';

interface ZenodoDeposition {
    id: number;
    links: {
        bucket: string;
        latest_draft_html: string;
    };
    metadata: {
        prereserve_doi: {
            doi: string;
        }
    }
}

async function apiRequest<T>(url: string, method: string, token: string, body?: string | Buffer, headers?: Record<string, string>): Promise<T> {
    const options: https.RequestOptions = {
        method,
        headers: {
            'Authorization': `Bearer ${token}`,
            ...headers,
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(data as any); }
                } else {
                    reject(new Error(`API failed with status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (body) req.write(body);
        req.end();
    });
}

export async function uploadToZenodo(pdfPath: string, title: string, token: string): Promise<string> {
    const depositionData = {
        metadata: {
            title: title,
            upload_type: 'publication',
            publication_type: 'article',
            description: `This scientific article was automatically generated and refined using an advanced AI system.`,
            creators: [
                {
                    name: 'Revista, Zen',
                    affiliation: 'Editorial Center',
                    orcid: '0009-0007-6299-2008'
                },
                {
                    name: 'MATH, 10',
                    affiliation: 'Scientific Department',
                    orcid: '0009-0007-6299-2008'
                }
            ]
        }
    };
    const deposition = await apiRequest<ZenodoDeposition>(
        ZENODO_API_URL,
        'POST',
        token,
        JSON.stringify(depositionData),
        { 'Content-Type': 'application/json' }
    );

    const fileName = path.basename(pdfPath);
    const bucketUrl = deposition.links.bucket;
    const fileStream = fs.readFileSync(pdfPath);
    
    await apiRequest(
        `${bucketUrl}/${fileName}`,
        'PUT',
        token,
        fileStream,
        {
            'Content-Type': 'application/pdf',
            'Content-Length': Buffer.byteLength(fileStream).toString()
        }
    );

    await apiRequest(
        `${ZENODO_API_URL}/${deposition.id}/actions/publish`,
        'POST',
        token
    );

    return deposition.links.latest_draft_html;
}
