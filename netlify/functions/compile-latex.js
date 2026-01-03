/**
 * Netlify serverless function to proxy LaTeX compilation requests to TeXLive.net.
 * This is necessary to bypass browser CORS (Cross-Origin Resource Sharing) restrictions.
 */
exports.handler = async function(event) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: 'Method Not Allowed'
        };
    }

    try {
        const { latex } = JSON.parse(event.body);

        if (!latex) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'LaTeX code is missing from the request body.' })
            };
        }

        const formData = new FormData();
        formData.append('filecontents[]', latex);
        formData.append('filename[]', 'document.tex');
        formData.append('engine', 'pdflatex');
        formData.append('return', 'pdf');
        
        const texliveResponse = await fetch('https://texlive.net/cgi-bin/latexcgi', {
            method: 'POST',
            body: formData,
        });

        const contentType = texliveResponse.headers.get('content-type');

        // A successful compilation returns a PDF. A failed one usually returns HTML with a log.
        if (!texliveResponse.ok || !contentType || !contentType.includes('application/pdf')) {
            const errorLogHtml = await texliveResponse.text();
            console.error(`TeXLive.net compilation failed. Status: ${texliveResponse.status}.`);

            const logMatch = errorLogHtml.match(/<pre>([\s\S]*?)<\/pre>/);
            let detailedError = "Compilation failed. The TeXLive.net server did not return a PDF. Please check the LaTeX code for errors.";
            if (logMatch && logMatch[1]) {
                const logText = logMatch[1];
                const errorLineMatch = logText.match(/^!.*$/m);
                if (errorLineMatch) {
                    detailedError = `TeX Error: ${errorLineMatch[0].trim().substring(0, 250)}`;
                }
            }
            
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: detailedError })
            };
        }

        const pdfArrayBuffer = await texliveResponse.arrayBuffer();
        const pdfBuffer = Buffer.from(pdfArrayBuffer);

        // Return the PDF content as a base64 encoded string.
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/plain',
            },
            body: pdfBuffer.toString('base64'),
        };

    } catch (error) {
        console.error('Proxy function error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message || 'An internal server error occurred in the proxy.' })
        };
    }    
};