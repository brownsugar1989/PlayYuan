const MAX_RECORD_BYTES = 8 * 1024 * 1024;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[a-f0-9]{32}$/i;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

function leaderboardKeys(id) {
  // Include the pre-level key so any legacy record is cleaned up as well.
  return [`leaderboards/${id}`, ...Array.from({ length: 7 }, (_, index) => `leaderboards/${id}/${index + 4}`)];
}

function validMaxLevel(value) {
  return Number.isInteger(value) && value >= 4 && value <= 10;
}

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

async function activeGame(env, id) {
  const key = `games/${id}`;
  const object = await env.GAMES.head(key);
  if (!object) return 404;
  if (Number(object.customMetadata?.expiresAt || 0) <= Date.now()) {
    await env.GAMES.delete([key, ...leaderboardKeys(id)]);
    return 410;
  }
  return 0;
}

async function readBestScore(env, key) {
  const object = await env.GAMES.get(key);
  if (!object) return 0;
  try {
    const data = await object.json();
    return Number.isSafeInteger(data.bestScore) && data.bestScore >= 0 ? data.bestScore : 0;
  } catch {
    return 0;
  }
}

async function submitBestScore(env, key, score) {
  // Compare-and-swap prevents overlapping requests from replacing a higher score with a lower one.
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await env.GAMES.get(key);
    const bestScore = current ? await readBestScore(env, key) : 0;
    if (score <= bestScore) return bestScore;
    const options = current
      ? { onlyIf: { etagMatches: current.etag } }
      : { onlyIf: { etagDoesNotMatch: '*' } };
    const written = await env.GAMES.put(key, JSON.stringify({ bestScore: score }), {
      ...options,
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    });
    if (written) return score;
  }
  throw new Error('Leaderboard update contention.');
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (!origin) return new Response('Origin not allowed', { status: 403 });
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/games\/([a-f0-9]{32})(?:\/(leaderboard|score))?$/i);
    if (!match) return json({ error: 'Not found' }, 404, origin);
    const id = match[1].toLowerCase();
    const subroute = (match[2] || '').toLowerCase();
    const key = `games/${id}`;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(origin) });

    if (subroute === 'leaderboard') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, origin);
      const maxLevel = Number(url.searchParams.get('maxLevel'));
      if (!validMaxLevel(maxLevel)) return json({ error: 'Invalid max level.' }, 400, origin);
      const status = await activeGame(env, id);
      if (status === 404) return json({ error: 'Game not found.' }, 404, origin);
      if (status === 410) return json({ error: 'This game link has expired.' }, 410, origin);
      return json({ bestScore: await readBestScore(env, `leaderboards/${id}/${maxLevel}`) }, 200, origin);
    }

    if (subroute === 'score') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, origin);
      const announcedLength = Number(request.headers.get('Content-Length') || 0);
      if (announcedLength > 128) return json({ error: 'Score request is too large.' }, 413, origin);
      const bodyText = await request.text();
      if (new TextEncoder().encode(bodyText).byteLength > 128) return json({ error: 'Score request is too large.' }, 413, origin);
      let body;
      try { body = JSON.parse(bodyText); } catch { return json({ error: 'Invalid score.' }, 400, origin); }
      const score = body?.score;
      const maxLevel = body?.maxLevel;
      if (!Number.isSafeInteger(score) || score < 0) return json({ error: 'Invalid score.' }, 400, origin);
      if (!validMaxLevel(maxLevel)) return json({ error: 'Invalid max level.' }, 400, origin);
      const status = await activeGame(env, id);
      if (status === 404) return json({ error: 'Game not found.' }, 404, origin);
      if (status === 410) return json({ error: 'This game link has expired.' }, 410, origin);
      try {
        return json({ bestScore: await submitBestScore(env, `leaderboards/${id}/${maxLevel}`, score) }, 200, origin);
      } catch {
        return json({ error: 'Could not update the leaderboard. Please retry.' }, 503, origin);
      }
    }

    if (subroute) return json({ error: 'Not found' }, 404, origin);

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
        await env.GAMES.delete([key, ...leaderboardKeys(id)]);
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
      await env.GAMES.delete(leaderboardKeys(id));
      return new Response(null, { status: 204, headers: headersFor(origin) });
    }

    return json({ error: 'Method not allowed.' }, 405, origin);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      let cursor;
      do {
        const page = await env.GAMES.list({ prefix: 'games/', limit: 1000, cursor });
        const expiredIds = page.objects
          .filter((object) => Number(object.customMetadata?.expiresAt || 0) <= Date.now())
          .map((object) => object.key.slice('games/'.length));
        if (expiredIds.length) {
          const keys = expiredIds.flatMap((id) => [`games/${id}`, ...leaderboardKeys(id)]);
          await env.GAMES.delete(keys);
        }
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
    })());
  },
};
