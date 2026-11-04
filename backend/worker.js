const MAX_RECORD_BYTES = 8 * 1024 * 1024;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[a-f0-9]{32}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim());
  return allowed.includes(origin) ? origin : '';
}

function headersFor(origin) {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
  });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Max-Age', '86400');
  }
  return headers;
}

function json(body, status, origin) {
  const headers = headersFor(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

function base64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value) {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function validRecord(record) {
  return record &&
    typeof record.iv === 'string' && BASE64URL_PATTERN.test(record.iv) && record.iv.length === 16 &&
    typeof record.ciphertext === 'string' && BASE64URL_PATTERN.test(record.ciphertext) &&
    typeof record.deleteTokenHash === 'string' && BASE64URL_PATTERN.test(record.deleteTokenHash) && record.deleteTokenHash.length === 43;
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (!origin) return new Response('Origin not allowed', { status: 403 });
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/games\/([a-f0-9]{32})$/i);
    if (!match) return json({ error: 'Not found' }, 404, origin);
    const id = match[1].toLowerCase();
    const key = `games/${id}`;

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(origin) });

    if (request.method === 'POST') {
      const announcedLength = Number(request.headers.get('Content-Length') || 0);
      if (announcedLength > MAX_RECORD_BYTES) return json({ error: 'Encrypted game is too large (8 MB maximum).' }, 413, origin);
      const bodyText = await request.text();
      if (new TextEncoder().encode(bodyText).byteLength > MAX_RECORD_BYTES) return json({ error: 'Encrypted game is too large (8 MB maximum).' }, 413, origin);
      let record;
      try { record = JSON.parse(bodyText); } catch { return json({ error: 'Invalid encrypted game data.' }, 400, origin); }
      if (!validRecord(record)) return json({ error: 'Invalid encrypted game data.' }, 400, origin);
      if (await env.GAMES.head(key)) return json({ error: 'This game link already exists. Please generate a new one.' }, 409, origin);
      const expiresAt = Date.now() + RETENTION_MS;
      const encryptedRecord = { version: 1, iv: record.iv, ciphertext: record.ciphertext };
      await env.GAMES.put(key, JSON.stringify(encryptedRecord), {
        httpMetadata: { contentType: 'application/json; charset=utf-8' },
        customMetadata: { deleteTokenHash: record.deleteTokenHash, expiresAt: String(expiresAt) },
      });
      return json({ expiresAt }, 201, origin);
    }

    if (request.method === 'GET') {
      const object = await env.GAMES.get(key);
      if (!object) return json({ error: 'Game not found.' }, 404, origin);
      if (Number(object.customMetadata?.expiresAt || 0) <= Date.now()) {
        await env.GAMES.delete(key);
        return json({ error: 'This game link has expired.' }, 410, origin);
      }
      const headers = headersFor(origin);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(object.body, { status: 200, headers });
    }

    if (request.method === 'DELETE') {
      const object = await env.GAMES.head(key);
      if (!object) return json({ error: 'Game not found.' }, 404, origin);
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!token || !object.customMetadata?.deleteTokenHash || !constantTimeEqual(await sha256(token), object.customMetadata.deleteTokenHash)) {
        return json({ error: 'Delete token is invalid.' }, 403, origin);
      }
      await env.GAMES.delete(key);
      return new Response(null, { status: 204, headers: headersFor(origin) });
    }

    return json({ error: 'Method not allowed.' }, 405, origin);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      let cursor;
      do {
        const page = await env.GAMES.list({ prefix: 'games/', limit: 1000, cursor });
        const expired = page.objects.filter((object) => Number(object.customMetadata?.expiresAt || 0) <= Date.now()).map((object) => object.key);
        if (expired.length) await env.GAMES.delete(expired);
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    })());
  },
};
