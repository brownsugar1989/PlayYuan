type ProgressInfo = { status?: string; progress?: number; file?: string };
type RemovedImage = { toBlob: () => Promise<Blob> };
type Segmenter = (input: string) => Promise<RemovedImage[]>;

let segmenterPromise: Promise<Segmenter> | undefined;

async function getSegmenter(onProgress: (message: string) => void): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = import('@huggingface/transformers').then(async ({ pipeline }) => {
      const makePipeline = pipeline as unknown as (
        task: 'background-removal', model: string, options: { progress_callback: (info: ProgressInfo) => void }
      ) => Promise<Segmenter>;
      return makePipeline('background-removal', 'Xenova/modnet', {
        progress_callback: (info) => {
          if (info.status === 'progress' && typeof info.progress === 'number') {
            onProgress(`正在下載去背模型 ${Math.round(info.progress)}%…`);
          } else if (info.status === 'download') {
            onProgress('正在下載去背模型，首次使用需要一些時間…');
          } else if (info.status === 'ready') {
            onProgress('模型已準備完成，正在本機去背…');
          }
        },
      });
    }).catch((error) => {
      segmenterPromise = undefined;
      throw error;
    });
  }
  onProgress('正在準備本機去背模型…');
  return segmenterPromise;
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('圖片輸出失敗。')), type, 0.92);
  });
}

export async function editPhoto(
  file: File,
  level: number,
  setStatus: (message: string, error?: boolean) => void,
): Promise<Blob | null> {
  const originalBitmap = await createImageBitmap(file);
  let bitmap = originalBitmap;
  let removedBitmap: ImageBitmap | null = null;
  let zoom = 1;
  let stretchX = 1;
  let stretchY = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let busy = false;
  let settled = false;

  const dialog = document.createElement('dialog');
  dialog.className = 'photo-editor-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="photo-editor">
      <header><p class="eyebrow">第 ${level} 級圖片</p><h2>裁切與氣球預覽</h2></header>
      <p class="section-help">拖曳照片調整位置，再用滑桿縮放或拉伸。圓形區域就是遊戲裡的球身。</p>
      <canvas class="photo-editor-canvas" width="360" height="360" aria-label="氣球圖片即時預覽"></canvas>
      <label class="photo-editor-check"><input class="remove-bg-toggle" type="checkbox"> 自動去背（在此瀏覽器本機處理）</label>
      <p class="photo-editor-status" role="status">照片不會送到去背服務；第一次使用會先下載模型。</p>
      <div class="photo-editor-controls">
        <label>縮放 <output data-value="zoom">1.00×</output><input data-slider="zoom" type="range" min="0.65" max="2.5" step="0.01" value="1"></label>
        <label>水平拉伸 <output data-value="stretchX">1.00×</output><input data-slider="stretchX" type="range" min="0.55" max="1.8" step="0.01" value="1"></label>
        <label>垂直拉伸 <output data-value="stretchY">1.00×</output><input data-slider="stretchY" type="range" min="0.55" max="1.8" step="0.01" value="1"></label>
      </div>
      <footer><button type="button" class="secondary-button photo-cancel">取消</button><button type="button" class="primary-button photo-save">套用照片</button></footer>
    </form>`;
  document.body.append(dialog);

  const canvas = dialog.querySelector<HTMLCanvasElement>('.photo-editor-canvas')!;
  const context = canvas.getContext('2d')!;
  const status = dialog.querySelector<HTMLElement>('.photo-editor-status')!;
  const removeToggle = dialog.querySelector<HTMLInputElement>('.remove-bg-toggle')!;
  const saveButton = dialog.querySelector<HTMLButtonElement>('.photo-save')!;
  const cancelButton = dialog.querySelector<HTMLButtonElement>('.photo-cancel')!;

  const paint = () => {
    const size = canvas.width;
    context.clearRect(0, 0, size, size);
    context.fillStyle = '#d77fa2';
    context.beginPath();
    context.arc(size / 2, size / 2, size * .47, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.beginPath();
    context.arc(size / 2, size / 2, size * .47, 0, Math.PI * 2);
    context.clip();
    const scale = Math.max(size / bitmap.width, size / bitmap.height) * zoom;
    const width = bitmap.width * scale * stretchX;
    const height = bitmap.height * scale * stretchY;
    const x = (size - width) / 2 + offsetX * Math.max(0, width - size) / 2;
    const y = (size - height) / 2 + offsetY * Math.max(0, height - size) / 2;
    context.drawImage(bitmap, x, y, width, height);
    const gloss = context.createRadialGradient(size * .33, size * .3, size * .04, size * .5, size * .5, size * .6);
    gloss.addColorStop(0, 'rgba(255,255,255,.28)');
    gloss.addColorStop(.55, 'rgba(255,255,255,0)');
    gloss.addColorStop(1, 'rgba(90,30,70,.18)');
    context.fillStyle = gloss;
    context.fillRect(0, 0, size, size);
    context.restore();
    context.strokeStyle = '#fff';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(size / 2, size / 2, size * .47, 0, Math.PI * 2);
    context.stroke();
  };

  const updateSliderLabels = () => {
    for (const key of ['zoom', 'stretchX', 'stretchY'] as const) {
      dialog.querySelector<HTMLOutputElement>(`output[data-value="${key}"]`)!.value = `${({ zoom, stretchX, stretchY })[key].toFixed(2)}×`;
    }
    paint();
  };
  for (const key of ['zoom', 'stretchX', 'stretchY'] as const) {
    dialog.querySelector<HTMLInputElement>(`input[data-slider="${key}"]`)!.addEventListener('input', (event) => {
      const value = Number((event.currentTarget as HTMLInputElement).value);
      if (key === 'zoom') zoom = value;
      else if (key === 'stretchX') stretchX = value;
      else stretchY = value;
      updateSliderLabels();
    });
  }

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height) * zoom;
    const width = bitmap.width * scale * stretchX;
    const height = bitmap.height * scale * stretchY;
    offsetX = Math.max(-1, Math.min(1, offsetX + (event.clientX - lastX) * 2 / Math.max(1, width - canvas.width)));
    offsetY = Math.max(-1, Math.min(1, offsetY + (event.clientY - lastY) * 2 / Math.max(1, height - canvas.height)));
    lastX = event.clientX;
    lastY = event.clientY;
    paint();
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  removeToggle.addEventListener('change', async () => {
    if (busy) return;
    if (!removeToggle.checked) {
      if (removedBitmap) removedBitmap.close();
      removedBitmap = null;
      bitmap = originalBitmap;
      status.textContent = '已關閉去背，使用原始照片。';
      paint();
      return;
    }
    busy = true;
    removeToggle.disabled = true;
    saveButton.disabled = true;
    status.textContent = '正在本機處理照片…';
    try {
      const segmenter = await getSegmenter((message) => { status.textContent = message; });
      const sourceUrl = URL.createObjectURL(file);
      try {
        const result = await segmenter(sourceUrl);
        if (!result[0]) throw new Error('去背沒有產生結果。');
        const transparent = await result[0].toBlob();
        removedBitmap?.close();
        removedBitmap = await createImageBitmap(transparent);
        bitmap = removedBitmap;
        status.textContent = '去背完成；請檢查預覽，白色與其他背景已變透明。';
        paint();
      } finally {
        URL.revokeObjectURL(sourceUrl);
      }
    } catch (error) {
      removeToggle.checked = false;
      status.textContent = error instanceof Error ? `去背失敗：${error.message}` : '去背失敗，請取消勾選後繼續使用原圖。';
      status.classList.add('error');
    } finally {
      busy = false;
      removeToggle.disabled = false;
      saveButton.disabled = false;
    }
  });

  return new Promise<Blob | null>((resolve) => {
    const finish = async (save: boolean) => {
      if (settled || busy) return;
      settled = true;
      if (!save) {
        dialog.close();
        resolve(null);
        return;
      }
      saveButton.disabled = true;
      try {
        const output = document.createElement('canvas');
        output.width = output.height = 512;
        const out = output.getContext('2d')!;
        const scale = Math.max(512 / bitmap.width, 512 / bitmap.height) * zoom;
        const width = bitmap.width * scale * stretchX;
        const height = bitmap.height * scale * stretchY;
        const x = (512 - width) / 2 + offsetX * Math.max(0, width - 512) / 2;
        const y = (512 - height) / 2 + offsetY * Math.max(0, height - 512) / 2;
        out.drawImage(bitmap, x, y, width, height);
        const image = await toBlob(output, removeToggle.checked || file.type === 'image/png' ? 'image/png' : 'image/webp');
        dialog.close();
        resolve(image);
      } catch (error) {
        settled = false;
        saveButton.disabled = false;
        status.textContent = error instanceof Error ? error.message : '圖片套用失敗。';
        status.classList.add('error');
      }
    };
    saveButton.addEventListener('click', () => void finish(true));
    cancelButton.addEventListener('click', () => void finish(false));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); void finish(false); });
    dialog.addEventListener('close', () => {
      originalBitmap.close();
      removedBitmap?.close();
      dialog.remove();
    }, { once: true });
    paint();
    dialog.showModal();
  });
}
