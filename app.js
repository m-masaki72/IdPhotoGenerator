// ===== State =====
const state = {
  slots: Array(6).fill(null).map(() => ({
    original: null,   // original File/Blob
    processed: null,  // after bg removal (or same as original)
    objectUrl: null,
    transform: { scale: 100, x: 0, y: 0 },
  })),
  bgRemoveEnabled: false,
  bgColor: '#b8d4e3',
  layout: '3x2',
  borderStyle: 'thin',
  bgRemover: null,
  currentEditSlot: -1,
};

// ===== DOM refs =====
const $ = (sel) => document.querySelector(sel);

const uploadGrid = $('#upload-grid');
const btnToEdit = $('#btn-to-edit');
const btnBackUpload = $('#btn-back-upload');
const btnGenerate = $('#btn-generate');
const btnDownload = $('#btn-download');
const btnTwitter = $('#btn-twitter');
const btnRestart = $('#btn-restart');
const bgRemoveToggle = $('#bg-remove-toggle');
const bgColorInput = $('#bg-color');
const layoutSelect = $('#layout-select');
const borderSelect = $('#border-select');
const editorOverlay = $('#editor-overlay');
const progressBar = $('#bg-progress');
const progressFill = $('#bg-progress-fill');

// ===== Initialize upload slots =====
function initUploadSlots() {
  uploadGrid.innerHTML = '';
  const labels = ['😊 笑顔', '😎 キメ顔', '😤 怒り', '🥺 泣き', '😲 驚き', '😴 リラックス'];
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    slot.className = 'upload-slot';
    slot.dataset.index = i;
    slot.innerHTML = `
      <span class="slot-label">${labels[i]}</span>
      <div class="placeholder">
        <span class="icon">＋</span>
        <span>タップして追加</span>
      </div>
      <button class="remove-btn" title="削除">✕</button>
      <input type="file" accept="image/*">
    `;
    uploadGrid.appendChild(slot);

    const input = slot.querySelector('input');
    slot.addEventListener('click', (e) => {
      if (e.target.closest('.remove-btn')) return;
      input.click();
    });
    input.addEventListener('change', (e) => handleFileSelect(i, e.target.files[0]));
    slot.querySelector('.remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeSlot(i);
    });
  }
}

async function handleFileSelect(index, file) {
  if (!file) return;
  const slot = state.slots[index];

  if (slot.objectUrl) URL.revokeObjectURL(slot.objectUrl);

  slot.original = file;
  slot.transform = { scale: 100, x: 0, y: 0 };

  if (state.bgRemoveEnabled) {
    await processBackgroundRemoval(index, file);
  } else {
    slot.processed = file;
    slot.objectUrl = URL.createObjectURL(file);
    updateSlotUI(index);
  }
  updateNav();
}

function removeSlot(index) {
  const slot = state.slots[index];
  if (slot.objectUrl) URL.revokeObjectURL(slot.objectUrl);
  slot.original = null;
  slot.processed = null;
  slot.objectUrl = null;
  slot.transform = { scale: 100, x: 0, y: 0 };
  updateSlotUI(index);
  updateNav();
}

function updateSlotUI(index) {
  const el = uploadGrid.children[index];
  const slot = state.slots[index];
  const existing = el.querySelector('img');
  if (existing) existing.remove();

  if (slot.objectUrl) {
    el.classList.add('has-image');
    el.querySelector('.placeholder').style.display = 'none';
    const img = document.createElement('img');
    img.src = slot.objectUrl;
    el.appendChild(img);
  } else {
    el.classList.remove('has-image');
    el.querySelector('.placeholder').style.display = '';
  }
}

function updateNav() {
  const filled = state.slots.filter(s => s.processed).length;
  btnToEdit.disabled = filled < 1;
  btnToEdit.textContent = filled < 6
    ? `次へ（${filled}/6 枚）→`
    : '次へ：位置を調整 →';
}

// ===== Background Removal =====
async function loadBgRemover() {
  if (state.bgRemover) return state.bgRemover;
  showToast('準備しています…少々お待ちください');
  progressBar.classList.add('active');
  progressFill.style.width = '10%';

  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
    state.bgRemover = mod;
    progressFill.style.width = '100%';
    setTimeout(() => progressBar.classList.remove('active'), 600);
    showToast('準備できました！');
    return mod;
  } catch (err) {
    console.error('BG removal load failed:', err);
    progressBar.classList.remove('active');
    showToast('⚠️ 背景の切り抜きを準備できませんでした');
    return null;
  }
}

async function processBackgroundRemoval(index, file) {
  const slotEl = uploadGrid.children[index];
  slotEl.classList.add('has-image');
  slotEl.querySelector('.placeholder').innerHTML = '<span class="spinner"></span><br><span style="font-size:.75rem">切り抜き中...</span>';
  slotEl.querySelector('.placeholder').style.display = '';

  try {
    const mod = await loadBgRemover();
    if (!mod) {
      state.slots[index].processed = file;
      state.slots[index].objectUrl = URL.createObjectURL(file);
      updateSlotUI(index);
      return;
    }

    const blob = await mod.removeBackground(file, {
      progress: (key, current, total) => {
        if (total > 0) {
          progressFill.style.width = Math.round((current / total) * 100) + '%';
        }
      }
    });
    state.slots[index].processed = blob;
    if (state.slots[index].objectUrl) URL.revokeObjectURL(state.slots[index].objectUrl);
    state.slots[index].objectUrl = URL.createObjectURL(blob);
    updateSlotUI(index);
  } catch (err) {
    console.error('BG removal error for slot', index, err);
    state.slots[index].processed = file;
    state.slots[index].objectUrl = URL.createObjectURL(file);
    updateSlotUI(index);
    showToast('⚠️ 切り抜きできなかったので元の画像を使います');
  }
}

// ===== Navigation =====
function showStep(step) {
  ['step-upload', 'step-edit', 'step-result'].forEach((id, i) => {
    $(`#${id}`).classList.toggle('hidden', i + 1 !== step);
  });
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === step);
    dot.classList.toggle('done', i + 1 < step);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

btnToEdit.addEventListener('click', () => {
  showStep(2);
  renderPreview();
});
btnBackUpload.addEventListener('click', () => showStep(1));
btnRestart.addEventListener('click', () => {
  state.slots.forEach((_, i) => removeSlot(i));
  showStep(1);
});

// ===== BG remove toggle =====
bgRemoveToggle.addEventListener('change', async () => {
  state.bgRemoveEnabled = bgRemoveToggle.checked;
  if (state.bgRemoveEnabled) {
    for (let i = 0; i < 6; i++) {
      if (state.slots[i].original && state.slots[i].processed === state.slots[i].original) {
        await processBackgroundRemoval(i, state.slots[i].original);
      }
    }
  }
});

// ===== Settings =====
bgColorInput.addEventListener('input', () => {
  state.bgColor = bgColorInput.value;
  renderPreview();
});
layoutSelect.addEventListener('change', () => {
  state.layout = layoutSelect.value;
  renderPreview();
});
borderSelect.addEventListener('change', () => {
  state.borderStyle = borderSelect.value;
  renderPreview();
});

// ===== Preview =====
function renderPreview() {
  const grid = $('#preview-grid');
  const area = $('#preview-area');
  area.style.background = state.bgColor;

  const [cols] = state.layout === '3x2' ? [3, 2] : [2, 3];
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = '';

  const gap = state.borderStyle === 'none' ? '0' : state.borderStyle === 'thick' ? '6px' : '3px';
  grid.style.gap = gap;
  grid.style.padding = gap;

  for (let i = 0; i < 6; i++) {
    const cell = document.createElement('div');
    cell.className = 'preview-cell';
    cell.style.background = state.bgColor;
    cell.style.cursor = 'pointer';
    cell.dataset.index = i;

    const slot = state.slots[i];
    if (slot.objectUrl) {
      const img = document.createElement('img');
      img.src = slot.objectUrl;
      img.style.objectFit = 'none';
      img.style.objectPosition = `calc(50% + ${slot.transform.x}px) calc(50% + ${slot.transform.y}px)`;
      img.style.transform = `scale(${slot.transform.scale / 100})`;
      cell.appendChild(img);
    }

    cell.addEventListener('click', () => openEditor(i));
    grid.appendChild(cell);
  }
}

// ===== Editor =====
const SLOT_LABELS = ['😊 笑顔', '😎 キメ顔', '😤 怒り', '🥺 泣き', '😲 驚き', '😴 リラックス'];

function openEditor(index) {
  const slot = state.slots[index];
  if (!slot.objectUrl) return;

  state.currentEditSlot = index;
  $('#editor-slot-label').textContent = SLOT_LABELS[index];
  $('#edit-scale').value = slot.transform.scale;
  $('#edit-scale-val').textContent = slot.transform.scale + '%';
  $('#edit-x').value = slot.transform.x;
  $('#edit-y').value = slot.transform.y;

  editorOverlay.classList.add('show');
  renderEditorCanvas();
}

function renderEditorCanvas() {
  const index = state.currentEditSlot;
  const slot = state.slots[index];
  if (!slot.objectUrl) return;

  const canvas = $('#editor-canvas');
  const wrap = $('#editor-canvas-wrap');
  const ctx = canvas.getContext('2d');
  wrap.style.background = state.bgColor;

  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  canvas.width = w * 2;
  canvas.height = h * 2;
  ctx.scale(2, 2);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, w, h);

  const img = new Image();
  img.onload = () => {
    const scale = slot.transform.scale / 100;
    const fitScale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const drawW = img.naturalWidth * fitScale * scale;
    const drawH = img.naturalHeight * fitScale * scale;
    const dx = (w - drawW) / 2 + slot.transform.x;
    const dy = (h - drawH) / 2 + slot.transform.y;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  };
  img.src = slot.objectUrl;
}

$('#edit-scale').addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  state.slots[state.currentEditSlot].transform.scale = val;
  $('#edit-scale-val').textContent = val + '%';
  renderEditorCanvas();
});
$('#edit-x').addEventListener('input', (e) => {
  state.slots[state.currentEditSlot].transform.x = parseInt(e.target.value);
  renderEditorCanvas();
});
$('#edit-y').addEventListener('input', (e) => {
  state.slots[state.currentEditSlot].transform.y = parseInt(e.target.value);
  renderEditorCanvas();
});

// Drag support on editor canvas
let dragStart = null;
const editorWrap = $('#editor-canvas-wrap');
editorWrap.addEventListener('pointerdown', (e) => {
  const t = state.slots[state.currentEditSlot].transform;
  dragStart = { x: e.clientX, y: e.clientY, origX: t.x, origY: t.y };
  editorWrap.setPointerCapture(e.pointerId);
});
editorWrap.addEventListener('pointermove', (e) => {
  if (!dragStart) return;
  const t = state.slots[state.currentEditSlot].transform;
  t.x = dragStart.origX + (e.clientX - dragStart.x);
  t.y = dragStart.origY + (e.clientY - dragStart.y);
  $('#edit-x').value = t.x;
  $('#edit-y').value = t.y;
  renderEditorCanvas();
});
editorWrap.addEventListener('pointerup', () => { dragStart = null; });

$('#editor-apply').addEventListener('click', () => {
  editorOverlay.classList.remove('show');
  renderPreview();
});
$('#editor-cancel').addEventListener('click', () => {
  editorOverlay.classList.remove('show');
});

// ===== Generate =====
btnGenerate.addEventListener('click', async () => {
  btnGenerate.disabled = true;
  btnGenerate.innerHTML = '<span class="spinner"></span> 生成中...';

  try {
    await generateResult();
    showStep(3);
  } catch (err) {
    console.error(err);
    showToast('生成に失敗しました');
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = '🎉 証明写真を生成';
  }
});

async function generateResult() {
  const canvas = $('#result-canvas');
  const ctx = canvas.getContext('2d');

  const cellW = 400;
  const cellH = Math.round(cellW * 4 / 3);
  const [cols, rows] = state.layout === '3x2' ? [3, 2] : [2, 3];
  const gap = state.borderStyle === 'none' ? 0 : state.borderStyle === 'thick' ? 12 : 4;

  canvas.width = cols * cellW + (cols + 1) * gap;
  canvas.height = rows * cellH + (rows + 1) * gap;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const promises = state.slots.map((slot, i) => new Promise((resolve) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = gap + col * (cellW + gap);
    const cy = gap + row * (cellH + gap);

    ctx.fillStyle = state.bgColor;
    ctx.fillRect(cx, cy, cellW, cellH);

    if (!slot.objectUrl) { resolve(); return; }

    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx, cy, cellW, cellH);
      ctx.clip();

      const scale = slot.transform.scale / 100;
      const fitScale = Math.max(cellW / img.naturalWidth, cellH / img.naturalHeight);
      const drawW = img.naturalWidth * fitScale * scale;
      const drawH = img.naturalHeight * fitScale * scale;
      const dx = cx + (cellW - drawW) / 2 + slot.transform.x * (cellW / 300);
      const dy = cy + (cellH - drawH) / 2 + slot.transform.y * (cellH / 400);

      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
      resolve();
    };
    img.onerror = resolve;
    img.src = slot.objectUrl;
  }));

  await Promise.all(promises);
}

// ===== Download =====
btnDownload.addEventListener('click', () => {
  const canvas = $('#result-canvas');
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shomei-photo-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ダウンロードしました！ 📥');
  }, 'image/png');
});

// ===== Twitter Share =====
btnTwitter.addEventListener('click', () => {
  const text = encodeURIComponent('証明写真ジェネレーターで作ってみた！🐹📸\n#証明写真 #証明写真風 #証明写真ジェネレーター');
  const url = encodeURIComponent(window.location.href);
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
});

// ===== Toast =====
function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== Init =====
initUploadSlots();
