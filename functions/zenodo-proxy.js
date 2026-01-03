export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  const target = url.searchParams.get('target');
  
  if (!target) {
    return new Response('Missing target param', { status: 400 });
  }

  // Clone headers to forward, but remove those that conflict or betray the proxy
  const newHeaders = new Headers(request.headers);
  newHeaders.delete('Host');
  newHeaders.delete('Referer');
  newHeaders.delete('Origin');
  newHeaders.delete('cf-connecting-ip');
  newHeaders.delete('x-forwarded-for');
  
  try {
    const response = await fetch(target, {
      method: request.method,
      headers: newHeaders,
      body: request.body
    });

    // We get the raw buffer to support binary files (PDFs) and JSON responses equally
    const data = await response.arrayBuffer();

    // Forward response headers and add CORS
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    return new Response(data, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
        status: 500,
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' 
        }
    });
  }
}

// Handle CORS preflight requests
export async function onRequestOptions(context) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}