'use strict';

// ============== 工具 ==============
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error(`POST ${path} → ${r.status}`);
    return r.json();
  },
};

// ============== 全局状态 ==============
const state = {
  sessionId: null,
  npcs: {},          // class -> npc
  fallbackNpcs: [],
  clues: 0,
  hasCamera: false,
  hasModel: false,
  scanning: false,
  ended: false,
  bubbleOpen: false,
  /** 收到的线索 chip：{name, text} 数组 */
  collectedClues: [],
  /** 已经对话过的 NPC class 集合（避免重复加 chip） */
  visitedClasses: new Set(),
  /** 当前场景中的可点击物体 */
  objects: [],       // {id, class, npc, screenBbox, hitZoneEl}
  timerStart: 0,
  timerId: null,
};

// ============== 计时器 ==============
function startTimer() {
  state.timerStart = Date.now();
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    const t = Math.floor((Date.now() - state.timerStart) / 1000);
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    const el = $('timer-clock');
    if (el) el.textContent = `${m}:${s}`;
  }, 500);
}
function stopTimer() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
}

// ============== 背景装饰 ==============
function makeStars() {
  const stars = $('stars');
  for (let i = 0; i < 50; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() * 2 + 1;
    s.style.width = s.style.height = size + 'px';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = Math.random() * 100 + '%';
    s.style.animationDelay = (Math.random() * 3) + 's';
    stars.appendChild(s);
  }
}
function makeParticles() {
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 5 + 3;
    p.style.width = p.style.height = size + 'px';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = (Math.random() * 10) + 's';
    p.style.animationDuration = (7 + Math.random() * 5) + 's';
    document.body.appendChild(p);
  }
}

// ============== 摄像头 ==============
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showStatus('⚠ 浏览器不支持摄像头，使用梦幻背景模式'); showFallback(); return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    const video = $('video');
    video.srcObject = stream;
    await new Promise(res => {
      if (video.readyState >= 2 && video.videoWidth) return res();
      video.onloadedmetadata = () => res();
    });
    await video.play().catch(() => {});
    let waits = 0;
    while ((!video.videoWidth || !video.videoHeight) && waits < 20) {
      await sleep(100); waits++;
    }
    state.hasCamera = true;
    return true;
  } catch (e) {
    console.warn('摄像头不可用：', e);
    showStatus('⚠ 摄像头未授权，使用梦幻背景模式');
    showFallback();
    return false;
  }
}
function showFallback() {
  $('fallback-bg').style.display = 'block';
  $('video').style.display = 'none';
}

function showStatus(text, dur = 3500) {
  const bar = $('status-bar');
  bar.textContent = text;
  bar.style.display = 'block';
  clearTimeout(showStatus._t);
  if (dur > 0) showStatus._t = setTimeout(() => { bar.style.display = 'none'; }, dur);
}

// ============== 识别（COCO-SSD）==============
let cocoModel = null;

async function loadModel() {
  if (cocoModel) return true;
  if (typeof cocoSsd === 'undefined') {
    $('scan-text').innerHTML = '❌ 识别模型未加载<br><span style="font-size:12px">（CDN 不可达，将进入随机模式）</span>';
    await sleep(1500);
    return false;
  }
  try {
    $('scan-text').innerHTML = '正在召唤识别之灵...<br><span style="font-size:12px;opacity:.8">首次加载约 3–8 秒</span>';
    cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    state.hasModel = true;
    return true;
  } catch (e) {
    console.warn('模型加载失败：', e);
    $('scan-text').innerHTML = '❌ 模型加载失败<br><span style="font-size:12px">' + (e.message || '') + '</span>';
    await sleep(1500);
    return false;
  }
}

// video pixel → 屏幕 pixel（适配 object-fit: cover）
function getVideoMapper(video) {
  const W = window.innerWidth, H = window.innerHeight;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  const scale = Math.max(W / vw, H / vh);
  const dispW = vw * scale, dispH = vh * scale;
  const offX = (dispW - W) / 2, offY = (dispH - H) / 2;
  return {
    box: ([bx, by, bw, bh]) => ({
      x: bx * scale - offX,
      y: by * scale - offY,
      w: bw * scale,
      h: bh * scale,
    }),
  };
}

function drawDetections(canvas, ctx, dets, video) {
  const m = getVideoMapper(video);
  if (!m) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const d of dets) {
    if (d.score < 0.3) continue;
    const npc = state.npcs[d.class];
    const known = !!npc;
    const r = m.box(d.bbox);

    if (known) {
      ctx.shadowColor = 'rgba(255, 200, 230, 0.95)';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = 'rgba(255, 230, 250, 0.95)';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
    } else {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
    }
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    const label = known ? `${npc.mood} ${npc.name}` : d.class;
    ctx.font = '13px -apple-system, "PingFang SC", sans-serif';
    const padX = 8, lh = 22;
    const tw = ctx.measureText(label).width;
    const ly = Math.max(0, r.y - lh - 2);
    ctx.fillStyle = known ? 'rgba(120, 60, 160, 0.92)' : 'rgba(40, 25, 70, 0.75)';
    ctx.beginPath();
    ctx.roundRect(r.x, ly, tw + padX * 2, lh, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, r.x + padX, ly + lh - 7);

    const conf = Math.round(d.score * 100) + '%';
    ctx.font = '11px -apple-system, sans-serif';
    const cw = ctx.measureText(conf).width;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(r.x + r.w - cw - 8, r.y + 2, cw + 6, 16);
    ctx.fillStyle = '#ffe066';
    ctx.fillText(conf, r.x + r.w - cw - 5, r.y + 14);
  }
}

async function liveDetect(durationMs = 4500) {
  const video = $('video');
  const canvas = $('boxes');
  const ctx = canvas.getContext('2d');

  if (!ctx.roundRect) {
    ctx.roundRect = function (x, y, w, h, r) {
      this.moveTo(x + r, y); this.lineTo(x + w - r, y);
      this.quadraticCurveTo(x + w, y, x + w, y + r);
      this.lineTo(x + w, y + h - r);
      this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      this.lineTo(x + r, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - r);
      this.lineTo(x, y + r);
      this.quadraticCurveTo(x, y, x + r, y);
    };
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.opacity = '1';
  canvas.style.display = 'block';

  const agg = new Map();
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    let dets = [];
    try { dets = await cocoModel.detect(video, 20); } catch (e) { console.warn(e); }
    for (const d of dets) {
      if (d.score < 0.3) continue;
      if (!state.npcs[d.class]) continue;
      const prev = agg.get(d.class);
      if (!prev || d.score > prev.score) agg.set(d.class, d);
    }
    drawDetections(canvas, ctx, dets, video);

    const knownCount = agg.size;
    const totalCount = dets.filter(d => d.score >= 0.3).length;
    const names = [...agg.values()].sort((a, b) => b.score - a.score)
      .slice(0, 4).map(d => state.npcs[d.class].name).join('、');
    const sec = Math.max(0, ((durationMs - (Date.now() - start)) / 1000)).toFixed(1);
    $('scan-text').innerHTML = knownCount > 0
      ? `✦ 已识别 <b>${knownCount}</b> 个灵气物品<br><span style="font-size:13px;opacity:.85">${names}</span><br><span style="font-size:11px;opacity:.6">还有 ${sec}s</span>`
      : `扫描中... <span style="opacity:.7">画面里 ${totalCount} 个物体</span><br><span style="font-size:12px;opacity:.75">把镜头对准物品（电脑/水杯/书/盆栽…）</span><br><span style="font-size:11px;opacity:.6">还有 ${sec}s</span>`;

    await sleep(60);
  }
  for (let i = 0; i < 8; i++) { canvas.style.opacity = (1 - i / 8).toFixed(2); await sleep(40); }
  canvas.style.display = 'none';
  canvas.style.opacity = '1';

  return [...agg.values()].sort((a, b) => b.score - a.score);
}

// ============== 把识别结果转成可点击 hit-zone（表情贴脸）==============
function clearObjects() {
  state.objects.forEach(o => o.hitZoneEl && o.hitZoneEl.remove());
  state.objects = [];
}

function placeObjectFromDetection(detection, video) {
  const m = getVideoMapper(video);
  if (!m) return null;
  const npc = state.npcs[detection.class];
  if (!npc) return null;
  const r = m.box(detection.bbox);
  return createHitZone({
    class: detection.class,
    npc,
    bbox: r,
  });
}

function createHitZone({ class: cls, npc, bbox }) {
  const W = window.innerWidth, H = window.innerHeight;
  // 钳制到屏幕内（hud 区上方留 70px，底部留 40px）
  const minSize = 70;
  let { x, y, w, h } = bbox;
  if (w < minSize) { x -= (minSize - w) / 2; w = minSize; }
  if (h < minSize) { y -= (minSize - h) / 2; h = minSize; }
  x = Math.max(8, Math.min(W - w - 8, x));
  y = Math.max(70, Math.min(H - h - 40, y));

  const zone = document.createElement('div');
  zone.className = 'hit-zone';
  zone.style.left = x + 'px';
  zone.style.top  = y + 'px';
  zone.style.width  = w + 'px';
  zone.style.height = h + 'px';

  const faceSize = Math.max(38, Math.min(72, Math.min(w, h) * 0.5));
  const face = document.createElement('div');
  face.className = 'face';
  face.textContent = npc.mood;
  face.style.fontSize = faceSize + 'px';
  zone.appendChild(face);

  const tag = document.createElement('div');
  tag.className = 'name-tag';
  tag.textContent = `${npc.emoji} ${npc.name}`;
  zone.appendChild(tag);

  const obj = {
    id: cls + '_' + Math.random().toString(36).slice(2, 8),
    class: cls,
    npc,
    screenBbox: { x, y, w, h },
    hitZoneEl: zone,
  };
  zone.addEventListener('click', (e) => {
    e.stopPropagation();
    onObjectTap(obj);
  });
  document.body.appendChild(zone);
  return obj;
}

// 随机投放（识别失败 / 无摄像头）
function placeFallbackObjects() {
  const W = window.innerWidth, H = window.innerHeight;
  const fall = [...state.fallbackNpcs].sort(() => Math.random() - 0.5).slice(0, 5);
  const taken = [];
  for (const npc of fall) {
    let tries = 0, x, y;
    const w = 120, h = 120;
    do {
      x = 40 + Math.random() * (W - 80 - w);
      y = 100 + Math.random() * (H - 240 - h);
      tries++;
    } while (tries < 60 && taken.some(t => Math.hypot(t.x - x, t.y - y) < 130));
    taken.push({ x, y });
    const obj = createHitZone({ class: npc.class || npc.name, npc, bbox: { x, y, w, h } });
    state.objects.push(obj);
  }
}

// ============== 漫画式悬浮气泡 ==============
let currentBubble = null;

function closeBubble() {
  if (!currentBubble) return;
  const b = currentBubble; currentBubble = null;
  state.bubbleOpen = false;
  b.classList.add('closing');
  setTimeout(() => b.remove(), 240);
}

function openSpeechBubble(obj, lines, { onDone } = {}) {
  closeBubble();
  state.bubbleOpen = true;

  const bb = obj.screenBbox;
  const cx = bb.x + bb.w / 2;

  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  bubble.innerHTML = `
    <div class="bubble-header">
      <span class="ic">${obj.npc.mood}</span>
      <span class="nm">${obj.npc.name}</span>
    </div>
    <div class="bubble-text"><span class="typed"></span><span class="bubble-cursor"></span></div>
    <div class="bubble-next">▾ 点击继续</div>
  `;
  document.body.appendChild(bubble);

  // 测得尺寸后决定上/下放置
  const rect = bubble.getBoundingClientRect();
  const W = window.innerWidth, H = window.innerHeight;
  const spaceAbove = bb.y;
  const spaceBelow = H - (bb.y + bb.h);
  const margin = 22;

  let placeAbove;
  if (spaceAbove >= rect.height + margin + 20) placeAbove = true;
  else if (spaceBelow >= rect.height + margin + 20) placeAbove = false;
  else placeAbove = spaceAbove >= spaceBelow;

  bubble.classList.add(placeAbove ? 'tail-bottom' : 'tail-top');

  let by;
  if (placeAbove) by = bb.y - rect.height - margin;
  else            by = bb.y + bb.h + margin;
  by = Math.max(12, Math.min(H - rect.height - 12, by));

  let bx = cx - rect.width / 2;
  bx = Math.max(12, Math.min(W - rect.width - 12, bx));
  bubble.style.left = bx + 'px';
  bubble.style.top  = by + 'px';

  let tailX = cx - bx;
  tailX = Math.max(22, Math.min(rect.width - 22, tailX));
  bubble.style.setProperty('--tail-x', tailX + 'px');

  currentBubble = bubble;

  // 打字机
  const typedEl  = bubble.querySelector('.typed');
  const cursorEl = bubble.querySelector('.bubble-cursor');
  const nextEl   = bubble.querySelector('.bubble-next');

  let lineIdx = 0, charIdx = 0, typing = false, curLine = '', timer = null;
  function startLine() {
    if (lineIdx >= lines.length) {
      closeBubble();
      if (onDone) onDone();
      return;
    }
    curLine = lines[lineIdx];
    charIdx = 0;
    typedEl.textContent = '';
    cursorEl.style.display = 'inline-block';
    nextEl.style.display = 'none';
    typing = true;
    timer = setInterval(() => {
      charIdx++;
      typedEl.textContent = curLine.slice(0, charIdx);
      if (charIdx >= curLine.length) {
        clearInterval(timer); timer = null;
        typing = false;
        nextEl.style.display = 'block';
      }
    }, 42);
  }
  function advance() {
    if (typing) {
      if (timer) { clearInterval(timer); timer = null; }
      typedEl.textContent = curLine;
      typing = false;
      nextEl.style.display = 'block';
      return;
    }
    lineIdx++;
    startLine();
  }
  bubble.onclick = (e) => { e.stopPropagation(); advance(); };
  startLine();
}

// ============== 物体被点击 ==============
async function onObjectTap(obj) {
  if (state.bubbleOpen) return;
  if (state.ended) return;
  if (obj.hitZoneEl.classList.contains('collected')) return;

  // 优先用本地 NPC 数据（2 句独白）
  let lines = obj.npc?.lines;
  if (!lines) {
    try {
      const d = await api.get(`/api/dialog/${encodeURIComponent(obj.class)}`);
      lines = d.lines;
    } catch (_) {
      lines = ['（这里没有什么动静……）'];
    }
  }

  obj.hitZoneEl.classList.add('collected');

  const isNew = !state.visitedClasses.has(obj.class);
  if (isNew) {
    state.visitedClasses.add(obj.class);
    state.clues = state.visitedClasses.size;
    state.collectedClues.push({ name: obj.npc.name, text: obj.npc.clue });
    updateProgress();
    updateGuessButton();
    if (state.sessionId) {
      api.post(`/api/sessions/${state.sessionId}/collect`, { class: obj.class }).catch(() => {});
    }
  }

  openSpeechBubble(obj, lines, {
    onDone: () => {
      if (isNew) {
        showStatus(`✦ 获得线索：${obj.npc.clue}`, 3500);
      }
    },
  });
}

function updateProgress() {
  const got = Math.min(state.clues, 3);
  // 4 个爪印代表 4 个段：0/3 → 1 个 active，1/3 → 2 个 active... 满 3 → 全亮（含✨）
  const paws = document.querySelectorAll('#hud .paw-progress .paw');
  paws.forEach((p, i) => {
    if (i <= got) p.classList.add('active');
    else p.classList.remove('active');
  });
  const fill = $('paw-fill');
  if (fill) {
    const pct = (got / 3) * 100;
    fill.style.width = pct + '%';
  }
}

// ============== 阶段四：猜谜 ==============
function updateGuessButton() {
  const btn = $('guess-btn');
  if (!btn) return;
  btn.style.display = state.clues > 0 ? 'inline-flex' : 'none';
  btn.textContent = state.clues >= 3 ? '✦ 现在就来猜！' : `✦ 试着猜谜（${state.clues}/3）`;
}

function openGuessPanel() {
  if (state.bubbleOpen || state.ended) return;
  closeBubble();
  const panel = $('guess-panel');
  const ALL = [
    { name: '人灵', text: '与开心有关' },
    { name: '杯灵', text: '能带来好心情' },
    { name: '椅灵', text: '表达友善' },
  ];
  const list = $('guess-clues');
  list.innerHTML = '';
  ALL.forEach(c => {
    const has = state.collectedClues.some(x => x.text === c.text);
    const li = document.createElement('div');
    li.className = 'clue-item' + (has ? ' got' : ' missing');
    li.innerHTML = has
      ? `<span class="tick">✓</span><span class="ct"><b>${c.name}：</b>${c.text}</span>`
      : `<span class="tick">?</span><span class="ct missing-text">（未获得 — ${c.name}）</span>`;
    list.appendChild(li);
  });
  $('guess-input').value = '';
  $('guess-feedback').textContent = '';
  $('guess-feedback').className = 'guess-feedback';
  panel.classList.add('show');
  setTimeout(() => $('guess-input').focus(), 200);
}

function closeGuessPanel() {
  $('guess-panel').classList.remove('show');
}

async function submitGuess() {
  const raw = $('guess-input').value.trim();
  if (!raw) {
    $('guess-feedback').textContent = '写点什么再交答案吧～';
    $('guess-feedback').className = 'guess-feedback warn';
    return;
  }
  let correct = false;
  try {
    const r = await api.post('/api/guess', { answer: raw });
    correct = !!r.correct;
  } catch (_) {
    correct = /微笑|笑容|笑脸|笑/.test(raw);
  }
  if (correct) {
    $('guess-feedback').textContent = '✦ 答对啦——是「微笑」';
    $('guess-feedback').className = 'guess-feedback ok';
    setTimeout(() => {
      closeGuessPanel();
      triggerEnding();
    }, 900);
  } else {
    $('guess-feedback').textContent = '不太对哦，再想想？（可以继续找居民收集线索）';
    $('guess-feedback').className = 'guess-feedback warn';
  }
}

// ============== 结局：多角色对话 ==============
async function triggerEnding() {
  if (state.ended) return;
  state.ended = true;
  closeBubble();
  document.querySelectorAll('.hit-zone').forEach(z => z.remove());
  $('rescan-btn').style.display = 'none';
  $('guess-btn').style.display = 'none';
  $('pet-final').style.display = 'block';
  $('pet-final').textContent = '😊';

  let ending;
  try { ending = await api.get('/api/ending'); }
  catch (_) {
    ending = {
      dialog: { lines: [
        { who: 'pet', text: '你找到我啦！' },
        { who: 'player', text: '原来你在这里。' },
      ] },
      text: '愿你常常微笑。',
    };
  }

  if (state.sessionId) {
    api.post(`/api/sessions/${state.sessionId}/complete`, {}).catch(() => {});
  }

  await sleep(900);
  await playMultiSpeakerDialog(ending.dialog.lines);
  $('ending-text').innerHTML = ending.text;
  $('ending').style.display = 'flex';
}

/**
 * 多角色对话播放器：在屏幕中央生成一个气泡，按 who 切换 speaker
 * lines: [{ who: 'pet'|'player', text }]
 */
function playMultiSpeakerDialog(lines) {
  return new Promise((resolve) => {
    const W = window.innerWidth, H = window.innerHeight;
    let idx = 0;
    const SPEAKERS = {
      pet:    { emoji: '🐾', mood: '🐾', name: '灵宠' },
      player: { emoji: '🙂', mood: '🙂', name: '你' },
    };
    function nextLine() {
      if (idx >= lines.length) { resolve(); return; }
      const ln = lines[idx];
      const sp = SPEAKERS[ln.who] || SPEAKERS.pet;
      // 灵宠在屏幕上半，玩家在下半 — 视觉上区分
      const isPet = ln.who === 'pet';
      const fakeBbox = isPet
        ? { x: W/2 - 60, y: H * 0.30, w: 120, h: 120 }
        : { x: W/2 - 60, y: H * 0.62, w: 120, h: 120 };
      const fakeObj = {
        id: 'ending_' + idx, class: '__ending',
        npc: { emoji: sp.emoji, mood: sp.mood, name: sp.name },
        screenBbox: fakeBbox,
      };
      openSpeechBubble(fakeObj, [ln.text], {
        onDone: () => { idx++; nextLine(); },
      });
    }
    nextLine();
  });
}

// ============== 扫描 / 重扫 ==============
async function doScanAndSpawn(showIntro) {
  if (state.scanning) return;
  state.scanning = true;
  $('rescan-btn').style.display = 'none';

  // 清掉旧的（未收集）hit-zone
  state.objects = state.objects.filter(o => {
    if (o.hitZoneEl.classList.contains('collected') || o.class === '__final') return true;
    o.hitZoneEl.remove();
    return false;
  });

  $('scan-overlay').style.display = 'flex';

  let placed = 0;
  let detectedNames = [];

  if (state.hasCamera) {
    const ok = await loadModel();
    if (ok) {
      const video = $('video');
      if (!video.videoWidth) await sleep(500);
      const detections = await liveDetect(4500);
      const picked = detections.slice(0, 5);
      for (const d of picked) {
        const obj = placeObjectFromDetection(d, video);
        if (obj) {
          state.objects.push(obj);
          detectedNames.push(state.npcs[d.class].name);
          placed++;
        }
      }
    }
  }

  if (placed === 0) {
    $('scan-text').innerHTML = state.hasCamera
      ? '未识别到熟悉的物品<br><span style="font-size:12px;opacity:.8">将召唤随机灵气陪你</span>'
      : '使用梦幻背景模式';
    await sleep(900);
    placeFallbackObjects();
    detectedNames = state.objects.map(o => o.npc.name);
  }

  $('scan-overlay').style.display = 'none';
  $('hud').style.display = 'flex';

  if (placed > 0) showStatus(`✦ 识别到：${detectedNames.join('、')}`, 4500);
  else if (state.hasCamera) showStatus('✦ 随机模式（可按右下角「重扫」再试）', 4500);

  if (!state.ended) $('rescan-btn').style.display = 'block';

  state.scanning = false;

  if (showIntro) {
    await sleep(500);
    let intro;
    try { intro = await api.get('/api/intro'); }
    catch (_) {
      intro = {
        pet:    { name: '灵宠', icon: '🐾' },
        player: { name: '你',   icon: '🙂' },
        lines: [
          { who: 'pet',    text: '你好……' },
          { who: 'pet',    text: '我好像找不到回家的路了。' },
          { who: 'pet',    text: '我记得自己来过这里。' },
          { who: 'pet',    text: '可是很多事情都忘记了……' },
          { who: 'pet',    text: '你能帮我问问这里的居民吗？' },
          { who: 'player', text: '居民？' },
          { who: 'pet',    text: '就是你身边的这些物品。' },
          { who: 'pet',    text: '它们一直生活在这里。' },
          { who: 'pet',    text: '它们一定见过我。' },
        ],
        task: '帮助灵宠寻找回家的路',
      };
    }
    // 任务面板
    const taskEl = $('task-banner');
    if (taskEl) {
      $('task-text').textContent = intro.task || '帮助灵宠寻找回家的路';
      taskEl.classList.add('show');
    }
    await playMultiSpeakerDialog(intro.lines);
    showStatus('点击画面中亮起的物品，与它们交谈～', 4500);
  }
}

// ============== 主流程 ==============
async function preloadData() {
  try {
    const data = await api.get('/api/npcs');
    state.npcs = data.npcs || {};
    state.fallbackNpcs = data.fallback || [];
  } catch (e) {
    console.warn('加载 NPC 数据失败：', e);
  }
  try {
    const s = await api.post('/api/sessions');
    state.sessionId = s.id;
  } catch (e) {
    console.warn('开局会话失败：', e);
  }
}

async function begin() {
  $('start-screen').style.display = 'none';
  $('hint-card').style.display = 'block';
  startTimer();
  await preloadData();
  await startCamera();
  await doScanAndSpawn(true);
}

// ============== 事件绑定 ==============
makeStars();
makeParticles();
document.querySelectorAll('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode || 'hide';
    if (mode === 'emotion') {
      location.href = '/vent.html';
      return;
    }
    state.mode = mode;
    begin();
  });
});
$('ending-btn').addEventListener('click', () => location.reload());
$('rescan-btn').addEventListener('click', () => {
  if (state.bubbleOpen || state.scanning) return;
  doScanAndSpawn(false);
});
$('guess-btn').addEventListener('click', openGuessPanel);
$('guess-close').addEventListener('click', closeGuessPanel);
$('guess-submit').addEventListener('click', submitGuess);
$('guess-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitGuess();
});

// 帮助 / 主页 / 关闭帮助
$('help-btn').addEventListener('click', () => $('help-modal').classList.add('show'));
$('help-close').addEventListener('click', () => $('help-modal').classList.remove('show'));
$('help-modal').addEventListener('click', (e) => {
  if (e.target === $('help-modal')) $('help-modal').classList.remove('show');
});
$('home-btn').addEventListener('click', () => {
  if (confirm('回到主页将重新开始本次冒险，确认吗？')) location.reload();
});

// 点击空白处关闭气泡
document.addEventListener('click', (e) => {
  if (!currentBubble) return;
  if (currentBubble.contains(e.target)) return;
  if (e.target.closest('.hit-zone')) return;
  // 只关 intro / 普通气泡；这里宽松处理：什么都不做，让用户必须看完
});

window.addEventListener('resize', () => {
  const c = $('boxes');
  c.width = window.innerWidth; c.height = window.innerHeight;
});
