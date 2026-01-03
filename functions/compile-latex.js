
/**
 * Cloudflare Pages Function to proxy LaTeX compilation requests to TeXLive.net.
 * This is necessary to bypass browser CORS (Cross-Origin Resource Sharing) restrictions.
 */

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function onRequestPost(context) {
    try {
        const { request } = context;
        const body = await request.json();
        const { latex } = body;

        if (!latex) {
            return new Response(JSON.stringify({ error: 'LaTeX code is missing from the request body.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
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

        if (!texliveResponse.ok || !contentType || !contentType.includes('application/pdf')) {
            let errorLogText = await texliveResponse.text();
            
            // Limpar HTML se o retorno for uma página de erro
            errorLogText = errorLogText.replace(/<[^>]*>?/gm, ''); // Remove tags HTML
            
            // Tentar encontrar o erro real do LaTeX (começa com !)
            const errorMatch = errorLogText.match(/!(.*)/);
            const cleanError = errorMatch ? errorMatch[0] : errorLogText.substring(0, 500);

            const detailedError = `Compilation failed:\n${cleanError.trim()}`;
            
            return new Response(JSON.stringify({ error: detailedError }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const pdfArrayBuffer = await texliveResponse.arrayBuffer();
        const base64Pdf = arrayBufferToBase64(pdfArrayBuffer);

        return new Response(base64Pdf, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });

    } catch (error) {
        console.error('Cloudflare function error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return new Response(JSON.stringify({ error: `Proxy function error: ${errorMessage}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }    
}
