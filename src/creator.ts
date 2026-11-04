import './creator.css';
import { STORAGE_API_URL } from './storage-config';
import { editPhoto } from './photo-editor';

const MAX_LEVEL = 10;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const OWNED_LINKS_KEY = 'playyuan:owned-game-links:v1';
const imageFiles = new Map<number, File>();
const processedImages = new Map<number, Blob>();
const objectUrls = new Map<number, string>();

const grid = document.querySelector<HTMLDivElement>('#level-images')!;
const form = document.querySelector<HTMLFormElement>('#creator-form')!;
const generateButton = document.querySelector<HTMLButtonElement>('#generate')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const resultBox = document.querySelector<HTMLDivElement>('#share-result')!;
const shareUrlInput = document.querySelector<HTMLInputElement>('#share-url')!;
const expiryNote = document.querySelector<HTMLParagraphElement>('#expiry-note')!;
const line1Input = document.querySelector<HTMLInputElement>('#line1')!;
const line2Input = document.querySelector<HTMLInputElement>('#line2')!;

function setStatus(message: string, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

function makeLevelCards() {
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const card = document.createElement('div');
    card.className = 'level-card';
    const preview = document.createElement('img');
    preview.className = 'level-preview';
    preview.alt = `第 ${level} 級圖片預覽`;

    const controls = document.createElement('div');
    const label = document.createElement('label');
    const input = document.createElement('input');
    const inputId = `level-${level}-image`;
    label.htmlFor = inputId;
    label.textContent = `第 ${level} 級`;
    input.id = inputId;
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.setAttribute('aria-label', `上傳第 ${level} 級圖片`);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        input.value = '';
        setStatus('請選擇 JPG、PNG 或 WebP 圖片。', true);
        return;
      }
      if (file.size > MAX_SOURCE_BYTES) {
        input.value = '';
        setStatus('單張原始圖片不可超過 20 MB。', true);
        return;
      }
      const previousUrl = objectUrls.get(level);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      const objectUrl = URL.createObjectURL(file);
      objectUrls.set(level, objectUrl);
      imageFiles.set(level, file);
      processedImages.set(level, file);
      preview.src = objectUrl;
      removeButton.hidden = false;
      setStatus('圖片只在目前瀏覽器預覽；按「生成網址」後才會加密上傳。');
      void openEditor();
    });

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'secondary-button edit-image';
    editButton.textContent = '裁切／拉伸預覽';
    editButton.hidden = true;
    editButton.addEventListener('click', () => void openEditor());

    async function openEditor() {
      const file = imageFiles.get(level);
      if (!file) return;
      const edited = await editPhoto(file, level, setStatus);
      if (!edited) return;
      processedImages.set(level, edited);
      const old = objectUrls.get(level);
      if (old) URL.revokeObjectURL(old);
      const url = URL.createObjectURL(edited);
      objectUrls.set(level, url);
      preview.src = url;
      setStatus(`第 ${level} 級圖片已套用裁切與氣球效果；生成前仍只保存在此瀏覽器。`);
    }

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'delete-button remove-image';
    removeButton.textContent = '移除圖片';
    removeButton.hidden = true;
    removeButton.addEventListener('click', () => {
      const previousUrl = objectUrls.get(level);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      objectUrls.delete(level);
      imageFiles.delete(level);
      processedImages.delete(level);
      preview.removeAttribute('src');
      input.value = '';
      removeButton.hidden = true;
      editButton.hidden = true;
    });

    input.addEventListener('change', () => { editButton.hidden = !input.files?.length; });
    controls.append(label, input, editButton, removeButton);
    card.append(preview, controls);
    grid.append(card);
  }
}

function updateResultPreview() {
  const line1 = document.querySelector<HTMLElement>('#preview-line1')!;
  const line2 = document.querySelector<HTMLElement>('#preview-line2')!;
  line1.textContent = line1Input.value || '你的第一行文字';
  line2.textContent = line2Input.value.includes('{{score}}')
    ? line2Input.value.replace(/\{\{score\}\}/g, '12,345')
    : `${line2Input.value}（請加入 {{score}}）`;
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取圖片失敗。'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('圖片格式轉換失敗。'));
    reader.readAsDataURL(blob);
  });
}

async function compressImage(file: Blob) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('無法處理圖片。');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('圖片壓縮失敗。')), 'image/webp', 0.82);
    });
    return await blobToDataUrl(blob);
  } finally {
    bitmap.close();
  }
}

function readOwnedLinks(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(OWNED_LINKS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function generateShare(event: SubmitEvent) {
  event.preventDefault();
  if (!STORAGE_API_URL) {
    setStatus('分享儲存服務尚未部署或設定；此頁目前可預覽編輯器，但還不能生成可分享網址。', true);
    return;
  }
  if (!line1Input.value.trim()) {
    setStatus('請填寫結算畫面的第一行文字。', true);
    return;
  }
  if (!line2Input.value.includes('{{score}}')) {
    setStatus('第二行請包含 {{score}}，遊戲才會在該處顯示分數。', true);
    return;
  }

  generateButton.disabled = true;
  resultBox.hidden = true;
  setStatus('正在處理圖片並於瀏覽器加密…');
  try {
    const images: Record<number, string> = {};
    for (const [level, image] of processedImages) images[level] = await compressImage(image);
    const payload = {
      version: 1,
      images,
      line1: line1Input.value.trim(),
      line2: line2Input.value.trim(),
    };
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    const rawKey = randomBytes(32);
    const iv = randomBytes(12);
    const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));
    if (ciphertext.byteLength > 7 * 1024 * 1024) {
      throw new Error('加密後資料超過 7 MB。請減少上傳圖片數量或改用較小圖片。');
    }
    const gameId = Array.from(randomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const deleteToken = bytesToBase64Url(randomBytes(32));
    const deleteTokenHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(deleteToken)));

    const response = await fetch(`${STORAGE_API_URL}/games/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        iv: bytesToBase64Url(iv),
        ciphertext: bytesToBase64Url(ciphertext),
        deleteTokenHash: bytesToBase64Url(deleteTokenHash),
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; expiresAt?: number };
    if (!response.ok) throw new Error(result.error || '無法保存客製化遊戲，請稍後再試。');

    const link = new URL('./', location.href);
    link.hash = new URLSearchParams({ id: gameId, key: bytesToBase64Url(rawKey) }).toString();
    shareUrlInput.value = link.href;
    expiryNote.textContent = `此版本將於 ${new Date(result.expiresAt || Date.now() + 30 * 86400000).toLocaleString()} 到期。刪除金鑰只保存在這個瀏覽器。`;
    const owned = readOwnedLinks();
    owned[gameId] = deleteToken;
    let canDelete = true;
    try { localStorage.setItem(OWNED_LINKS_KEY, JSON.stringify(owned)); }
    catch { canDelete = false; }
    resultBox.dataset.gameId = gameId;
    resultBox.hidden = false;
    setStatus(canDelete
      ? '網址已生成。加密資料已保存；圖片沒有寫入公開儲存庫。'
      : '網址已生成並加密保存。瀏覽器未允許本機儲存刪除金鑰，此版本會在 30 天後自動失效。');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '生成網址時發生錯誤。', true);
  } finally {
    generateButton.disabled = false;
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrlInput.value);
    setStatus('已複製客製化遊戲網址。');
  } catch {
    shareUrlInput.focus();
    shareUrlInput.select();
    setStatus('瀏覽器未允許直接複製，已選取網址，請手動複製。', true);
  }
}

async function deleteShare() {
  const gameId = resultBox.dataset.gameId;
  const token = gameId ? readOwnedLinks()[gameId] : undefined;
  if (!gameId || !token) {
    setStatus('找不到此版本的刪除金鑰；連結會在 30 天後自動失效。', true);
    return;
  }
  const button = document.querySelector<HTMLButtonElement>('#delete-link')!;
  button.disabled = true;
  try {
    const response = await fetch(`${STORAGE_API_URL}/games/${gameId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 404) throw new Error('刪除失敗，請稍後再試。');
    const owned = readOwnedLinks();
    delete owned[gameId];
    localStorage.setItem(OWNED_LINKS_KEY, JSON.stringify(owned));
    resultBox.hidden = true;
    setStatus('客製化版本已刪除，分享網址已失效。');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '刪除失敗。', true);
  } finally {
    button.disabled = false;
  }
}

makeLevelCards();
line1Input.addEventListener('input', updateResultPreview);
line2Input.addEventListener('input', updateResultPreview);
form.addEventListener('submit', (event) => void generateShare(event as SubmitEvent));
document.querySelector<HTMLButtonElement>('#copy-link')!.addEventListener('click', () => void copyLink());
document.querySelector<HTMLButtonElement>('#delete-link')!.addEventListener('click', () => void deleteShare());
updateResultPreview();
