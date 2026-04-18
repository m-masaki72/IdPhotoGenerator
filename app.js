// ===== Template constants =====
const TEMPLATE_W = 1414;
const TEMPLATE_H = 2000;
const TEMPLATE_SLOTS = [
  {x: 197, y:  882, w: 282, h: 397},
  {x: 565, y:  881, w: 284, h: 400},
  {x: 933, y:  882, w: 287, h: 399},
  {x: 197, y: 1415, w: 284, h: 397},
  {x: 565, y: 1414, w: 284, h: 400},
  {x: 933, y: 1415, w: 287, h: 397},
];
const SLOT_LABELS = ['✖ 近すぎる', '✖ 遠すぎる', '✖ 寝ている', '✖ おしりを向ける', '✖ 食事中', '✖ 若い時の写真'];

// ===== Background presets =====
const BG_PRESETS = [
  { id: 'white',      label: '白',       stops: ['#ffffff', '#ffffff'] },
  { id: 'white-sky',  label: '白→水色',  stops: ['#f0f8ff', '#a8ccdf'] },
  { id: 'sky',        label: '水色',     stops: ['#b8d4e3', '#b8d4e3'] },
  { id: 'sky-white',  label: '水色→白',  stops: ['#a8ccdf', '#f0f8ff'] },
  { id: 'blue-sky',   label: '青→水色',  stops: ['#4aaee8', '#c0e0f8'] },
  { id: 'blue',       label: '青',       stops: ['#5b9fd6', '#2e75b0'] },
];
// お手本スロット座標
const SAMPLE_SLOT = {x: 772, y: 121, w: 484, h: 623};

// ===== State =====
const state = {
  slots: Array(6).fill(null).map(() => ({
    original: null,
    processed: null,
    objectUrl: null,
    transform: { scale: 100, x: 0, y: 0 },
  })),
  sampleSlot: { original: null, processed: null, objectUrl: null, transform: { scale: 100, x: 0, y: 0 } },
  bgRemoveEnabled: false,
  bgPreset: 'blue-sky',
  bgRemover: null,
  currentEditSlot: -1, // -1 = お手本スロット, 0-5 = 通常スロット
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
const bgPresetList = $('#bg-preset-list');
const editorOverlay = $('#editor-overlay');
const progressBar = $('#bg-progress');
const progressFill = $('#bg-progress-fill');

// ===== Template image cache =====
let templateImg = null;
function loadTemplateImg() {
  if (templateImg) return Promise.resolve(templateImg);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { templateImg = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = 'assets/template.jpg';
  });
}

// ===== Slot image cache =====
const _slotImgCache = new Map(); // objectUrl → HTMLImageElement

// URL.revokeObjectURL の代わりにこれを使う → キャッシュも同時に削除
function revokeSlotUrl(url) {
  if (!url) return;
  URL.revokeObjectURL(url);
  _slotImgCache.delete(url);
}

function loadSlotImg(objectUrl) {
  if (_slotImgCache.has(objectUrl)) {
    return Promise.resolve(_slotImgCache.get(objectUrl));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { _slotImgCache.set(objectUrl, img); resolve(img); };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

// ===== BG gradient helper =====
function applyBgGradient(ctx, x, y, w, h) {
  const preset = BG_PRESETS.find(p => p.id === state.bgPreset) || BG_PRESETS[2];
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, preset.stops[0]);
  grad.addColorStop(1, preset.stops[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

// ===== Composite helper (shared by renderPreview & generateResult) =====
// transform.x/y は仮想300x400座標系（スロット幅/高さを300/400とした場合のオフセット）
function compositeSlot(ctx, slotData, s, scale) {
  if (!slotData.objectUrl) return Promise.resolve();
  const sx = Math.round(s.x * scale);
  const sy = Math.round(s.y * scale);
  const sw = Math.round(s.w * scale);
  const sh = Math.round(s.h * scale);
  return loadSlotImg(slotData.objectUrl).then((img) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();
    applyBgGradient(ctx, sx, sy, sw, sh);
    const imgScale = slotData.transform.scale / 100;
    const fitScale = Math.max(sw / img.naturalWidth, sh / img.naturalHeight);
    const drawW = img.naturalWidth * fitScale * imgScale;
    const drawH = img.naturalHeight * fitScale * imgScale;
    const dx = sx + (sw - drawW) / 2 + slotData.transform.x * (sw / 300);
    const dy = sy + (sh - drawH) / 2 + slotData.transform.y * (sh / 400);
    ctx.drawImage(img, dx, dy, drawW, drawH);
    ctx.restore();
  }).catch(() => {});
}

// ===== Initialize upload slots =====
function initUploadSlots() {
  uploadGrid.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const slot = document.createElement('div');
    slot.className = 'upload-slot';
    slot.dataset.index = i;
    slot.innerHTML = `
      <span class="slot-label">${SLOT_LABELS[i]}</span>
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

// ===== Sample slot (お手本) =====
function initSampleSlot() {
  const slotEl = $('#sample-slot');
  const input = $('#sample-slot-input');
  slotEl.addEventListener('click', (e) => {
    if (e.target.closest('.remove-btn')) return;
    input.click();
  });
  input.addEventListener('change', (e) => handleSampleFileSelect(e.target.files[0]));
  slotEl.querySelector('.remove-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    removeSampleSlot();
  });
}

async function handleSampleFileSelect(file) {
  if (!file) return;
  const slot = state.sampleSlot;
  revokeSlotUrl(slot.objectUrl);
  slot.original = file;
  slot.transform = { scale: 100, x: 0, y: 0 };
  if (state.bgRemoveEnabled) {
    await processSampleBgRemoval(file);
  } else {
    slot.processed = file;
    slot.objectUrl = URL.createObjectURL(file);
    updateSampleSlotUI();
  }
}

async function processSampleBgRemoval(file) {
  const slotEl = $('#sample-slot');
  slotEl.classList.add('has-image');
  slotEl.querySelector('.placeholder').innerHTML = '<span class="spinner"></span><br><span style="font-size:.75rem">切り抜き中...</span>';
  slotEl.querySelector('.placeholder').style.display = '';
  try {
    const mod = await loadBgRemover();
    if (!mod) {
      state.sampleSlot.processed = file;
      state.sampleSlot.objectUrl = URL.createObjectURL(file);
      updateSampleSlotUI();
      return;
    }
    const blob = await mod.removeBackground(file, { model: 'isnet_fp16' });
    revokeSlotUrl(state.sampleSlot.objectUrl);
    state.sampleSlot.processed = blob;
    state.sampleSlot.objectUrl = URL.createObjectURL(blob);
    updateSampleSlotUI();
  } catch (err) {
    state.sampleSlot.processed = file;
    state.sampleSlot.objectUrl = URL.createObjectURL(file);
    updateSampleSlotUI();
    showToast('⚠️ 切り抜きできなかったので元の画像を使います');
  }
}

function removeSampleSlot() {
  const slot = state.sampleSlot;
  revokeSlotUrl(slot.objectUrl);
  slot.original = null;
  slot.processed = null;
  slot.objectUrl = null;
  slot.transform = { scale: 100, x: 0, y: 0 };
  updateSampleSlotUI();
}

function updateSampleSlotUI() {
  const el = $('#sample-slot');
  const slot = state.sampleSlot;
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

async function handleFileSelect(index, file) {
  if (!file) return;
  const slot = state.slots[index];

  revokeSlotUrl(slot.objectUrl);

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
  revokeSlotUrl(slot.objectUrl);
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
      model: 'isnet_fp16',
      progress: (key, current, total) => {
        if (total > 0) {
          progressFill.style.width = Math.round((current / total) * 100) + '%';
        }
      }
    });
    revokeSlotUrl(state.slots[index].objectUrl);
    state.slots[index].processed = blob;
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
  removeSampleSlot();
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
    if (state.sampleSlot.original && state.sampleSlot.processed === state.sampleSlot.original) {
      await processSampleBgRemoval(state.sampleSlot.original);
    }
  } else {
    // OFF: 元画像に戻す
    for (let i = 0; i < 6; i++) {
      const slot = state.slots[i];
      if (slot.original && slot.processed !== slot.original) {
        revokeSlotUrl(slot.objectUrl);
        slot.processed = slot.original;
        slot.objectUrl = URL.createObjectURL(slot.original);
        updateSlotUI(i);
      }
    }
    const s = state.sampleSlot;
    if (s.original && s.processed !== s.original) {
      revokeSlotUrl(s.objectUrl);
      s.processed = s.original;
      s.objectUrl = URL.createObjectURL(s.original);
      updateSampleSlotUI();
    }
  }
});

// ===== Settings =====
function initBgPresets() {
  BG_PRESETS.forEach(preset => {
    const btn = document.createElement('button');
    btn.className = 'bg-preset-btn' + (preset.id === state.bgPreset ? ' active' : '');
    btn.title = preset.label;
    btn.dataset.id = preset.id;
    btn.style.background = `linear-gradient(to bottom, ${preset.stops[0]}, ${preset.stops[1]})`;
    btn.addEventListener('click', () => {
      state.bgPreset = preset.id;
      document.querySelectorAll('.bg-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPreview();
    });
    bgPresetList.appendChild(btn);
  });
}

// ===== Preview (template-based) =====
async function renderPreview() {
  const canvas = $('#preview-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const area = $('#preview-area');

  const areaW = area.clientWidth - 32;
  const scale = areaW / TEMPLATE_W;
  canvas.width = areaW;
  canvas.height = Math.round(TEMPLATE_H * scale);
  canvas.style.width = '100%';

  const tmpl = await loadTemplateImg();
  if (tmpl) {
    ctx.drawImage(tmpl, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  await Promise.all([
    ...state.slots.map((slot, i) => compositeSlot(ctx, slot, TEMPLATE_SLOTS[i], scale)),
    compositeSlot(ctx, state.sampleSlot, SAMPLE_SLOT, scale),
  ]);
}

// ===== Editor =====
// エディタ画像キャッシュ（ちらつき防止）
let _editorImgCache = { src: null, img: null };

function openEditor(index) {
  const slot = index === -1 ? state.sampleSlot : state.slots[index];
  if (!slot.objectUrl) {
    showToast('まず画像をアップロードしてください');
    return;
  }

  state.currentEditSlot = index;
  $('#editor-slot-label').textContent = index === -1 ? '★ お手本' : SLOT_LABELS[index];
  $('#edit-scale').value = slot.transform.scale;
  $('#edit-scale-val').textContent = slot.transform.scale + '%';
  $('#edit-x').value = slot.transform.x;
  $('#edit-y').value = slot.transform.y;

  const tSlot = index === -1 ? SAMPLE_SLOT : TEMPLATE_SLOTS[index];
  const wrap = $('#editor-canvas-wrap');
  wrap.style.aspectRatio = `${tSlot.w} / ${tSlot.h}`;

  // 新しいスロットを開いたらキャッシュをクリア
  _editorImgCache = { src: null, img: null };

  editorOverlay.classList.add('show');
  renderEditorCanvas();
}

function renderEditorCanvas() {
  const index = state.currentEditSlot;
  const slot = index === -1 ? state.sampleSlot : state.slots[index];
  if (!slot.objectUrl) return;

  const canvas = $('#editor-canvas');
  const wrap = $('#editor-canvas-wrap');
  const ctx = canvas.getContext('2d');

  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  const dpr = window.devicePixelRatio || 1;

  // サイズが変わった時だけ canvas をリセット（これを毎回やるとちらつく）
  const newW = Math.round(w * dpr);
  const newH = Math.round(h * dpr);
  if (canvas.width !== newW || canvas.height !== newH) {
    canvas.width = newW;
    canvas.height = newH;
  }

  const drawFrame = (img) => {
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    applyBgGradient(ctx, 0, 0, w, h);

    const scale = slot.transform.scale / 100;
    const fitScale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const drawW = img.naturalWidth * fitScale * scale;
    const drawH = img.naturalHeight * fitScale * scale;
    // 仮想300x400座標系で統一
    const dx = (w - drawW) / 2 + slot.transform.x * (w / 300);
    const dy = (h - drawH) / 2 + slot.transform.y * (h / 400);
    ctx.drawImage(img, dx, dy, drawW, drawH);
    drawCropFrame(ctx, w, h);
    ctx.restore();
  };

  if (_editorImgCache.src === slot.objectUrl && _editorImgCache.img) {
    // キャッシュ済み → 同期描画でちらつきなし
    drawFrame(_editorImgCache.img);
  } else {
    const img = new Image();
    img.onload = () => {
      _editorImgCache = { src: slot.objectUrl, img };
      drawFrame(img);
    };
    img.src = slot.objectUrl;
  }
}

function drawCropFrame(ctx, w, h) {
  const edge = 4;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = edge * 2;
  ctx.setLineDash([]);
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#e84040';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.restore();

  const B = Math.min(24, w * 0.12);
  const lw = 3;
  ctx.save();
  ctx.strokeStyle = '#e84040';
  ctx.lineWidth = lw;
  ctx.setLineDash([]);
  ctx.lineCap = 'square';

  const corners = [
    [0, 0,  B, 0,  0, B],
    [w, 0,  w-B, 0,  w, B],
    [0, h,  B, h,  0, h-B],
    [w, h,  w-B, h,  w, h-B],
  ];
  corners.forEach(([px, py, ax, ay, bx, by]) => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(px, py);
    ctx.lineTo(bx, by);
    ctx.stroke();
  });
  ctx.restore();

  const label = '← この枠内に収まります →';
  ctx.save();
  ctx.font = `bold ${Math.max(10, Math.round(w * 0.04))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(w * 0.1, h - Math.round(h * 0.085), w * 0.8, Math.round(h * 0.075));
  ctx.fillStyle = '#fff';
  ctx.fillText(label, w / 2, h - Math.round(h * 0.022));
  ctx.restore();
}

function currentEditSlotData() {
  return state.currentEditSlot === -1 ? state.sampleSlot : state.slots[state.currentEditSlot];
}

$('#edit-scale').addEventListener('input', (e) => {
  const val = parseInt(e.target.value);
  currentEditSlotData().transform.scale = val;
  $('#edit-scale-val').textContent = val + '%';
  renderEditorCanvas();
});
$('#edit-x').addEventListener('input', (e) => {
  currentEditSlotData().transform.x = parseInt(e.target.value);
  renderEditorCanvas();
});
$('#edit-y').addEventListener('input', (e) => {
  currentEditSlotData().transform.y = parseInt(e.target.value);
  renderEditorCanvas();
});

// Drag support on editor canvas
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let dragStart = null;
const editorWrap = $('#editor-canvas-wrap');
editorWrap.addEventListener('pointerdown', (e) => {
  const t = currentEditSlotData().transform;
  dragStart = {
    x: e.clientX, y: e.clientY,
    origX: t.x, origY: t.y,
    w: editorWrap.clientWidth, h: editorWrap.clientHeight,
  };
  editorWrap.setPointerCapture(e.pointerId);
});
editorWrap.addEventListener('pointermove', (e) => {
  if (!dragStart) return;
  const t = currentEditSlotData().transform;
  // スクリーンピクセル → 仮想300x400座標系に変換してクランプ
  t.x = clamp(dragStart.origX + (e.clientX - dragStart.x) * (300 / dragStart.w), -300, 300);
  t.y = clamp(dragStart.origY + (e.clientY - dragStart.y) * (400 / dragStart.h), -300, 300);
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

// ===== Generate (template composite) =====
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

  canvas.width = TEMPLATE_W;
  canvas.height = TEMPLATE_H;

  const tmpl = await loadTemplateImg();
  if (tmpl) {
    ctx.drawImage(tmpl, 0, 0, TEMPLATE_W, TEMPLATE_H);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, TEMPLATE_W, TEMPLATE_H);
  }

  await Promise.all([
    ...state.slots.map((slot, i) => compositeSlot(ctx, slot, TEMPLATE_SLOTS[i], 1)),
    compositeSlot(ctx, state.sampleSlot, SAMPLE_SLOT, 1),
  ]);
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

// ===== Preview cell click wiring (delegated) =====
$('#preview-canvas').addEventListener('click', (e) => {
  const canvas = e.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) / rect.width * TEMPLATE_W;
  const cy = (e.clientY - rect.top) / rect.height * TEMPLATE_H;

  if (SAMPLE_SLOT.w > 0 && state.sampleSlot.objectUrl) {
    const s = SAMPLE_SLOT;
    if (cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h) {
      openEditor(-1);
      return;
    }
  }
  for (let i = 0; i < TEMPLATE_SLOTS.length; i++) {
    const s = TEMPLATE_SLOTS[i];
    if (cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h) {
      openEditor(i);
      return;
    }
  }
});

// ===== Resize: プレビューを再描画 =====
let _resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (!$('#step-edit').classList.contains('hidden')) renderPreview();
  }, 200);
});

// ===== Init =====
initUploadSlots();
initSampleSlot();
initBgPresets();
loadTemplateImg(); // preload
