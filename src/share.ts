import { STORAGE_API_URL } from './storage-config';
import type { ResultText } from './renderer';

export interface SharedGame {
  images: Record<number, string>;
  result: ResultText;
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
}

function parseSharedGame(value: unknown): SharedGame {
  if (!value || typeof value !== 'object') throw new Error('客製化設定格式錯誤。');
  const data = value as Record<string, unknown>;
  if (data.version !== 1 || !data.images || typeof data.images !== 'object') {
    throw new Error('客製化設定格式錯誤。');
  }
  const images: Record<number, string> = {};
  for (const [level, source] of Object.entries(data.images as Record<string, unknown>)) {
    const n = Number(level);
    if (!Number.isInteger(n) || n < 1 || n > 10 || typeof source !== 'string' || source.length > 1_500_000) {
      throw new Error('客製化圖片資料不正確。');
    }
    if (!/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(source)) {
      throw new Error('客製化圖片格式不支援。');
    }
    images[n] = source;
  }
  const line1 = typeof data.line1 === 'string' ? data.line1.slice(0, 80) : '';
  const line2 = typeof data.line2 === 'string' ? data.line2.slice(0, 100) : '';
  if (!line1 || !line2.includes('{{score}}')) throw new Error('結算文字設定不正確。');
  return { images, result: { line1, line2 } };
}

/** Load and decrypt a shared game; the AES key is in the URL fragment, never sent to the Worker. */
export async function loadSharedGame(): Promise<SharedGame | null> {
  const params = new URLSearchParams(location.hash.slice(1));
  const id = params.get('id');
  const encodedKey = params.get('key');
  if (!id && !encodedKey) return null;
  if (!id || !encodedKey || !/^[a-f0-9]{32}$/i.test(id)) throw new Error('分享網址無效。');
  if (!STORAGE_API_URL) throw new Error('客製化遊戲儲存服務尚未設定。');

  const response = await fetch(`${STORAGE_API_URL}/games/${id}`);
  if (response.status === 404 || response.status === 410) throw new Error('找不到這個客製化遊戲，或分享連結已過期。');
  if (!response.ok) throw new Error('目前無法讀取客製化遊戲，請稍後再試。');
  const record = await response.json() as { iv?: string; ciphertext?: string };
  if (!record.iv || !record.ciphertext) throw new Error('分享資料不完整。');

  const key = await crypto.subtle.importKey('raw', fromBase64Url(encodedKey), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(record.iv) },
    key,
    fromBase64Url(record.ciphertext),
  );
  return parseSharedGame(JSON.parse(new TextDecoder().decode(plaintext)));
}
