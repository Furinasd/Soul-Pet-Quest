const els = {
  camera: document.querySelector("#camera"),
  snapshot: document.querySelector("#snapshot"),
  fallbackFrame: document.querySelector("#fallbackFrame"),
  petNode: document.querySelector("#petNode"),
  pet: document.querySelector("#pet"),
  petSpeech: document.querySelector("#petSpeech"),
  startCamera: document.querySelector("#startCamera"),
  capture: document.querySelector("#capture"),
  upload: document.querySelector("#upload"),
  reset: document.querySelector("#reset"),
  backHome: document.querySelector("#backHome"),
  ventPanel: document.querySelector("#ventPanel"),
  ventInput: document.querySelector("#ventInput"),
  charCount: document.querySelector("#charCount"),
  feed: document.querySelector("#feed"),
  slingshotPanel: document.querySelector("#slingshotPanel"),
  paperBall: document.querySelector("#paperBall"),
  status: document.querySelector("#status"),
  digestion: document.querySelector("#digestion"),
  resultCopy: document.querySelector("#resultCopy"),
  analysis: document.querySelector("#analysis"),
  action: document.querySelector("#action"),
  polaroidDate: document.querySelector("#polaroidDate"),
  resultDivider: document.querySelector(".result-divider"),
  sourceMaterial: document.querySelector("#sourceMaterial"),
  receiptSection: document.querySelector(".receipt-section"),
  receipt: document.querySelector("#receipt"),
  download: document.querySelector("#download"),
  magicOverlay: document.querySelector("#magicOverlay"),
  magicText: document.querySelector("#magicText"),
};

let stream;
let capturedImage = "";
let currentVent = "";
let currentResult = null;
let isDragging = false;
let startY = 0;
let currentY = 0;
let isStyled = false;
let styledImageSrc = "";
let particleInterval;
let currentPersonality = "gentle";

const petImage = new Image();
petImage.src = "/characters/灵宠-九尾.png";

function setStatus(text) {
  els.status.textContent = text;
}

function showSnapshot(src) {
  capturedImage = src;
  els.snapshot.src = src;
  els.snapshot.style.display = "block";
  els.fallbackFrame.style.display = "none";
  els.snapshot.classList.remove("film-filter");

  triggerStyleTransfer();
}

function startMagicParticles() {
  const container = els.magicOverlay.querySelector(".magic-particles");
  if (!container) return;
  container.innerHTML = "";
  particleInterval = setInterval(() => {
    const particle = document.createElement("div");
    particle.className = "magic-particle";
    particle.style.left = `${Math.random() * 100}%`;
    const size = Math.random() * 8 + 4;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.setProperty("--drift", `${(Math.random() - 0.5) * 60}px`);
    particle.style.animationDuration = `${Math.random() * 2 + 3}s`;
    container.appendChild(particle);
    setTimeout(() => particle.remove(), 5000);
  }, 200);
}

function stopMagicParticles() {
  clearInterval(particleInterval);
  const container = els.magicOverlay.querySelector(".magic-particles");
  if (container) container.innerHTML = "";
}

function triggerStyleTransfer() {
  els.magicOverlay.classList.add("active");
  startMagicParticles();
  setStatus("灵瑞感知到了现实世界，正在施展魔法画卷...");

  const magicTexts = [
    "灵宠正在为你施展魔法，把现实世界变成画卷...",
    "正在收集身边的微光，装点你的精神现场...",
    "吉卜力风笔触渲染中，快要画好啦...",
    "小神兽把这幅画收进了怀里..."
  ];
  let textIdx = 0;
  els.magicText.textContent = magicTexts[0];
  const textInterval = setInterval(() => {
    textIdx = (textIdx + 1) % magicTexts.length;
    els.magicText.textContent = magicTexts[textIdx];
  }, 950);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  fetch("/api/style-transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: capturedImage }),
    signal: controller.signal
  })
    .then(res => res.json())
    .then(data => {
      clearTimeout(timeoutId);
      clearInterval(textInterval);
      stopMagicParticles();

      if (data.success && data.styledImageUrl) {
        isStyled = true;
        styledImageSrc = data.styledImageUrl;
        const img = new Image();
        img.onload = () => {
          els.snapshot.src = styledImageSrc;
          completeStyleTransfer(true, data.scene);
        };
        img.src = styledImageSrc;
      } else {
        completeStyleTransfer(false);
      }
    })
    .catch(err => {
      clearTimeout(timeoutId);
      clearInterval(textInterval);
      stopMagicParticles();
      console.warn("Style transfer failed, falling back to film filter.", err);
      completeStyleTransfer(false);
    });
}

function completeStyleTransfer(success, scene) {
  els.magicOverlay.classList.remove("active");

  const now = new Date();
  els.polaroidDate.textContent = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;

  if (success) {
    if (scene === "garden") {
      setStatus("哇！现实照片已完美改造为手绘吉卜力花园大图");
      els.petSpeech.textContent = "哇！四周开满了花草，我们回到了温馨的吉卜力花园！你今天的烦恼也可以揉成纸团丢给我，我帮你消化消化！";
    } else if (scene === "street") {
      setStatus("哇！现实照片已完美改造为手绘吉卜力街景大图");
      els.petSpeech.textContent = "哇！四周变成了阳光洒满的手绘街道！快把今天压抑你的烦心事揉成纸团丢给我，我帮你全部吃掉！";
    } else {
      setStatus("哇！现实照片已完美改造为手绘吉卜力卧室大图");
      els.petSpeech.textContent = "哇，这幅温馨的手绘卧室我很喜欢！今天不开心的事可以写下来揉成纸团丢给我，我帮你吃掉！";
    }
  } else {
    isStyled = false;
    els.snapshot.classList.add("film-filter");
    setStatus("魔法受到微弱扰动，已自动为你降级为暖色胶片滤镜");
    els.petSpeech.textContent = "魔法有点小波动，不过胶片感也很温馨！快把烦恼写下来，丢给我吧！";
  }
  els.petSpeech.style.display = "block";

  els.ventPanel.style.display = "block";
  els.ventPanel.classList.add("animate-slide-up");
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("当前浏览器不支持相机，请上传照片继续");
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    els.camera.srcObject = stream;
    els.fallbackFrame.style.display = "none";
    setStatus("相机已打开，对准今天的精神现场吧");
  } catch {
    setStatus("相机没有打开，上传照片也可以继续");
  }
}

function captureFrame() {
  if (!els.camera.videoWidth) {
    setStatus("还没有可定格的画面，请先打开相机或上传照片");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = els.camera.videoWidth;
  canvas.height = els.camera.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(els.camera, 0, 0, canvas.width, canvas.height);
  showSnapshot(canvas.toDataURL("image/jpeg", 0.92));
}

function uploadImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => showSnapshot(reader.result);
  reader.readAsDataURL(file);
}

function resetAll() {
  currentVent = "";
  currentResult = null;
  capturedImage = "";
  currentY = 0;
  isDragging = false;
  isStyled = false;
  styledImageSrc = "";
  stopMagicParticles();
  currentPersonality = "gentle";
  document.querySelectorAll(".personality-selector .option-btn").forEach(b => {
    b.classList.remove("active");
    if (b.dataset.personality === "gentle") b.classList.add("active");
  });

  els.magicOverlay.classList.remove("active");
  els.snapshot.removeAttribute("src");
  els.snapshot.style.display = "none";
  els.snapshot.classList.remove("film-filter");
  els.fallbackFrame.style.display = "grid";

  els.ventInput.value = "";
  els.ventInput.placeholder = "把今天不开心的事写下来，揉成纸团丢给小神兽吧~";
  els.charCount.textContent = "0/120";

  els.ventPanel.style.display = "none";
  els.ventPanel.classList.remove("animate-slide-up");
  els.slingshotPanel.classList.remove("is-active");
  els.slingshotPanel.classList.remove("animate-slide-up");

  resetPaperBall();
  els.petNode.classList.remove("eating");
  els.petSpeech.style.display = "none";
  els.petSpeech.textContent = "";
  els.digestion.classList.remove("active");
  els.resultCopy.classList.remove("visible");
  els.receiptSection.classList.remove("visible");
  els.download.removeAttribute("href");
  els.analysis.textContent = "还没有纸团可以诊断。";
  els.action.textContent = "等你投喂。";

  const now = new Date();
  els.polaroidDate.textContent = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  els.sourceMaterial.textContent = "";
  els.resultDivider.classList.remove("visible");

  setStatus("请先打开相机📷或上传照片📁来定格今天的精神现场");
}

function containsRisk(text) {
  return /自杀|自残|杀人|弄死|报复|炸|血|死给|轻生|不想活/.test(text);
}

function makeMockResult(text) {
  const samples = [
    {
      analysis: "检测到 99% 的离谱要求，这不是你的错，是世界今天有点发癫。",
      response: "这口烦恼味道像过期苦瓜！快吐掉，今晚必须给自己一点甜。",
      action: "处方：离开屏幕 5 分钟，喝水，顺便在心里把烦恼揉成这个纸团。",
    },
    {
      analysis: "检测到高浓度班味，伴随轻微自我怀疑，但你的求生本能还亮着。",
      response: "摸摸头，你今天已经做得很棒啦。剩下的破事交给我来吃，吧唧吧唧。",
      action: "处方：下班后吃顿热乎的，今天先别审判自己，你比工作重要一万倍。",
    },
    {
      analysis: "检测到委屈气泡正在咕嘟咕嘟冒出来，需要被认真接住。",
      response: "我宣布：这不是你太敏感，是这件事确实有点扎人。小神兽站你这边。",
      action: "处方：找一个可信的人说 10 分钟，或者写完就去洗个热水澡。",
    },
  ];

  const seed = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return samples[seed % samples.length];
}

function packVent() {
  const text = els.ventInput.value.trim();
  if (!text) {
    els.ventInput.placeholder = "要写点什么才能揉成纸团哦。";
    setStatus("纸条还是空的，小神兽咬不到空气");
    return;
  }

  currentVent = text;
  currentResult = containsRisk(text)
    ? {
        analysis: "检测到高风险情绪，小神兽先收起玩笑。",
        response: "这件事需要被认真对待。请先去到安全的地方，并联系你信任的人。",
        action: "如果你或他人正处于即时危险中，请立即联系当地紧急服务。",
      }
    : makeMockResult(text);

  els.ventPanel.classList.remove("animate-slide-up");
  els.ventPanel.style.display = "none";
  els.resultCopy.classList.remove("visible");
  els.receiptSection.classList.remove("visible");
  els.download.removeAttribute("href");
  els.petSpeech.style.display = "none";
  els.slingshotPanel.classList.add("is-active");
  els.slingshotPanel.classList.add("animate-slide-up");
  resetPaperBall();
  setStatus("纸团揉好了，向下拉拽再松手发射");
}

function resetPaperBall() {
  els.paperBall.style.transition = "none";
  els.paperBall.style.transform = "translateY(0) scale(1)";
  els.paperBall.style.opacity = "1";
}

function dragStart(event) {
  isDragging = true;
  startY = event.type.includes("touch") ? event.touches[0].clientY : event.clientY;
  els.paperBall.style.transition = "none";
}

function dragMove(event) {
  if (!isDragging) return;
  event.preventDefault();
  const y = event.type.includes("touch") ? event.touches[0].clientY : event.clientY;
  currentY = Math.max(0, y - startY);
  const scale = Math.max(0.82, 1 - currentY / 900);
  els.paperBall.style.transform = `translateY(${currentY}px) scale(${scale})`;
}

function dragEnd() {
  if (!isDragging) return;
  isDragging = false;

  if (currentY > 50) {
    els.paperBall.style.transition = "all 0.42s cubic-bezier(0.25, 1, 0.5, 1)";
    els.paperBall.style.transform = "translateY(-360px) scale(0.12)";
    els.paperBall.style.opacity = "0";

    if (navigator.vibrate) navigator.vibrate(50);
    window.setTimeout(triggerEatEvent, 420);
  } else {
    els.paperBall.style.transition = "transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)";
    els.paperBall.style.transform = "translateY(0) scale(1)";
    setStatus("再往下拉一点，小神兽才接得到");
  }

  currentY = 0;
}

async function triggerEatEvent() {
  els.slingshotPanel.classList.remove("is-active");
  els.digestion.classList.add("active");
  els.petNode.classList.add("eating");
  setStatus("小神兽正在吧唧吧唧消化中...");

  const analysisPromise = fetch("/api/vent-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image: capturedImage,
      text: currentVent,
      personality: currentPersonality
    })
  }).then(res => res.json());

  const [apiResult] = await Promise.all([
    analysisPromise.catch(err => {
      console.warn("VLM vent analysis request failed, falling back to mock.", err);
      return { success: false };
    }),
    new Promise((resolve) => window.setTimeout(resolve, 1500))
  ]);

  els.digestion.classList.remove("active");
  els.petNode.classList.remove("eating");

  if (apiResult && apiResult.success && apiResult.data) {
    currentResult = apiResult.data;
  } else {
    currentResult = containsRisk(currentVent)
      ? {
          analysis: "检测到高风险情绪，小神兽先收起玩笑。",
          response: "这件事需要被认真对待。请先去到安全的地方，并联系你信任的人。",
          action: "如果你或他人正处于即时危险中，请立即联系当地紧急服务。",
        }
      : makeMockResult(currentVent);
  }

  els.petSpeech.textContent = currentResult.response;
  els.petSpeech.style.display = "block";
  renderResult();
  await generateReceipt();
  setStatus("吃掉啦，解忧拍立得已经生成");
}

function renderResult() {
  els.analysis.textContent = currentResult.analysis;
  els.action.textContent = currentResult.action;
  els.sourceMaterial.textContent = `原料：${currentVent || "今天先放过自己。"}`;
  els.resultDivider.classList.add("visible");
  els.resultCopy.classList.add("visible");
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function generateReceipt() {
  if (!currentResult) {
    setStatus("先揉一个纸团给小神兽吧");
    return;
  }

  await drawReceipt();
  els.receiptSection.classList.add("visible");
  els.download.href = els.receipt.toDataURL("image/png");
}

async function drawReceipt() {
  const ctx = els.receipt.getContext("2d");
  const w = els.receipt.width;
  const h = els.receipt.height;
  const photo = await loadImage(isStyled ? styledImageSrc : capturedImage);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fdfbf7";
  ctx.fillRect(0, 0, w, h);

  drawDotPaper(ctx, w, h);

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(92, 64, 51, 0.14)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillRect(50, 50, 700, 800);
  ctx.restore();

  if (photo) {
    ctx.save();
    if (!isStyled) {
      ctx.filter = "sepia(0.38) contrast(1.12) brightness(1.04) saturate(1.22) hue-rotate(-8deg)";
    }
    coverImage(ctx, photo, 80, 80, 640, 640);
    ctx.restore();

    ctx.fillStyle = "rgba(255, 240, 220, 0.16)";
    ctx.fillRect(80, 80, 640, 640);
  } else {
    ctx.fillStyle = "#f0e8dc";
    ctx.fillRect(80, 80, 640, 640);
    ctx.fillStyle = "#a08c7f";
    ctx.font = "700 34px Microsoft YaHei, sans-serif";
    ctx.fillText("今日精神现场待上传", 235, 405);
  }

  if (petImage.complete && petImage.naturalWidth > 0) {
    ctx.save();
    ctx.drawImage(petImage, 250, 470, 300, 300);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 160, 122, 0.1)';
    ctx.fillRect(250, 470, 300, 300);
    ctx.restore();
  }

  ctx.fillStyle = "#5c4033";
  ctx.font = "900 40px Microsoft YaHei, sans-serif";
  ctx.fillText("今日份解忧拍立得", 80, 785);

  ctx.fillStyle = "#a08c7f";
  ctx.font = "700 26px Microsoft YaHei, sans-serif";
  const now = new Date();
  const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  ctx.fillText(dateStr, 560, 785);

  ctx.setLineDash([12, 10]);
  ctx.strokeStyle = "#e6daca";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(50, 900);
  ctx.lineTo(750, 900);
  ctx.stroke();
  ctx.setLineDash([]);

  let y = 958;
  y = drawTextBlock(ctx, "灵宠护短诊断：", currentResult.analysis, 50, y);
  y = drawTextBlock(ctx, "神兽治愈处方：", currentResult.action, 50, y + 20);

  ctx.fillStyle = "#a08c7f";
  ctx.font = "700 22px Microsoft YaHei, sans-serif";
  wrapText(ctx, `原料：${currentVent || "今天先放过自己。"}`, 50, y + 36, 700, 32, 2);
}

function drawDotPaper(ctx, width, height) {
  ctx.fillStyle = "#eadfce";
  for (let x = 12; x < width; x += 20) {
    for (let y = 12; y < height; y += 20) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTextBlock(ctx, title, body, x, y) {
  ctx.fillStyle = "#5c4033";
  ctx.font = "900 32px Microsoft YaHei, sans-serif";
  ctx.fillText(title, x, y);

  ctx.fillStyle = "#5c4033";
  ctx.font = "500 28px Microsoft YaHei, sans-serif";
  return wrapText(ctx, body, x, y + 48, 700, 40, 3);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 5) {
  const chars = Array.from(text);
  let line = "";
  const lines = [];

  for (const char of chars) {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = testLine;
    }
  }

  if (line) lines.push(line);

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1].slice(0, -1)}…`;
  }

  visibleLines.forEach((value, index) => {
    ctx.fillText(value, x, y + index * lineHeight);
  });

  return y + visibleLines.length * lineHeight;
}

function coverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (image.width - sw) / 2;
  const sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

els.startCamera.addEventListener("click", startCamera);
els.capture.addEventListener("click", captureFrame);
els.upload.addEventListener("change", uploadImage);
els.reset.addEventListener("click", resetAll);
els.backHome.addEventListener("click", () => { location.href = "/"; });
els.feed.addEventListener("click", packVent);
els.ventInput.addEventListener("input", () => {
  els.charCount.textContent = `${els.ventInput.value.length}/120`;
});
els.paperBall.addEventListener("touchstart", dragStart, { passive: false });
els.paperBall.addEventListener("mousedown", dragStart);
document.addEventListener("touchmove", dragMove, { passive: false });
document.addEventListener("mousemove", dragMove);
document.addEventListener("touchend", dragEnd);
document.addEventListener("mouseup", dragEnd);

document.querySelectorAll(".personality-selector .option-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".personality-selector .option-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentPersonality = btn.dataset.personality;
  });
});

resetAll();
