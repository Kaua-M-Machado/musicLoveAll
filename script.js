const audio = document.getElementById("musica");
const playBtn = document.getElementById("btn-play");
const playIcon = document.getElementById("play-icon");
const pauseIcon = document.getElementById("pause-icon");
const canvas = document.getElementById("waveform-canvas");
const ctx = canvas.getContext("2d");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const letraDiv = document.getElementById("letra");
const waveformContainer = document.querySelector(".waveform-container");

let tocando = false;
let letra = [];
let indexAtual = -1;
let rafId = null;

// ─── Waveform data ────────────────────────────────────────────────────────────
// Simulated waveform inspired by SoundCloud — bars with varying height
// representing energy/amplitude in different segments of the song.
// We generate pseudo-random but musically plausible data seeded by position.

const BAR_COUNT = 120;
const waveData = generateWaveData(BAR_COUNT);

function generateWaveData(count) {
  const data = [];
  // Seed: alternating energy sections to simulate verse/chorus dynamics
  for (let i = 0; i < count; i++) {
    const t = i / count;
    // Base envelope — quieter intro/outro
    const envelope = Math.sin(Math.PI * t);
    // "Musical" pseudo-random using multiple frequencies
    const noise =
      0.5 * Math.sin(i * 0.4) +
      0.25 * Math.sin(i * 1.3 + 1) +
      0.15 * Math.sin(i * 3.7 + 2) +
      0.1 * Math.sin(i * 8.2);
    // Normalize to 0..1
    const raw = (noise + 1) / 2;
    // Apply envelope and clamp with minimum height
    const val = Math.max(0.08, Math.min(1, raw * envelope * 1.4 + 0.15));
    data.push(val);
  }
  return data;
}

// ─── Canvas resize ────────────────────────────────────────────────────────────

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  drawWaveform(audio.currentTime / (audio.duration || 1));
}

window.addEventListener("resize", resizeCanvas);

// ─── Draw waveform (SoundCloud style) ────────────────────────────────────────

function drawWaveform(progress) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;

  ctx.clearRect(0, 0, W, H);

  const barW = (W / BAR_COUNT) * 0.55;
  const gap = (W / BAR_COUNT) * 0.45;
  const maxBarH = H * 0.88;
  const midY = H / 2;
  const progressPx = progress * W;

  for (let i = 0; i < BAR_COUNT; i++) {
    const x = i * (barW + gap);
    const barH = waveData[i] * maxBarH;
    const isPast = x + barW < progressPx;
    const isCurrent = x <= progressPx && progressPx <= x + barW;

    // Color
    let color;
    if (isPast || isCurrent) {
      // Violet gradient for played portion
      const grad = ctx.createLinearGradient(0, midY - barH / 2, 0, midY + barH / 2);
      grad.addColorStop(0, "rgba(192, 132, 252, 0.95)");
      grad.addColorStop(0.5, "rgba(155, 68, 245, 1)");
      grad.addColorStop(1, "rgba(107, 33, 232, 0.8)");
      color = grad;
    } else {
      // Unplayed — faint white
      color = "rgba(240, 234, 255, 0.18)";
    }

    ctx.fillStyle = color;

    // Top half
    const topH = barH * 0.6;
    ctx.beginPath();
    ctx.roundRect(x, midY - topH, barW, topH, [2, 2, 0, 0]);
    ctx.fill();

    // Bottom half (reflection — shorter, more transparent)
    const botH = barH * 0.3;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.roundRect(x, midY, barW, botH, [0, 0, 2, 2]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ─── Playback ────────────────────────────────────────────────────────────────

function setPlayState(playing) {
  tocando = playing;
  playIcon.style.display = playing ? "none" : "block";
  pauseIcon.style.display = playing ? "block" : "none";
}

playBtn.addEventListener("click", () => {
  if (tocando) {
    audio.pause();
    setPlayState(false);
  } else {
    audio.play();
    setPlayState(true);
  }
});

document.getElementById("btn-prev").addEventListener("click", () => {
  // If more than 3s in, restart. Otherwise could go to previous (here just restart)
  audio.currentTime = 0;
  sincronizarIndice();
  atualizarVisual();
  centralizar();
});

document.getElementById("btn-back10").addEventListener("click", () => {
  audio.currentTime = Math.max(0, audio.currentTime - 10);
});

document.getElementById("btn-fwd10").addEventListener("click", () => {
  audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
});

document.getElementById("btn-next").addEventListener("click", () => {
  // Single track: skip to near the end so user can experience the ending UI
  if (audio.duration) {
    audio.currentTime = Math.max(0, audio.duration - 8);
    if (!tocando) {
      audio.play();
      setPlayState(true);
    }
  }
});

audio.addEventListener("play", () => {
  cancelAnimationFrame(rafId);
  loopLetra();
});

audio.addEventListener("pause", () => {
  cancelAnimationFrame(rafId);
});

audio.addEventListener("ended", () => {
  setPlayState(false);
  cancelAnimationFrame(rafId);
});

// ─── Progress / waveform update ───────────────────────────────────────────────

audio.addEventListener("timeupdate", () => {
  const { duration, currentTime } = audio;
  if (!duration) return;

  const progress = currentTime / duration;
  drawWaveform(progress);
  formatarTempo(currentTime, currentTimeEl);
  formatarTempo(duration, durationEl);
});

waveformContainer.addEventListener("click", (e) => {
  const { left, width } = waveformContainer.getBoundingClientRect();
  const clickX = e.clientX - left;
  if (audio.duration) {
    audio.currentTime = (clickX / width) * audio.duration;
  }
});

audio.addEventListener("seeked", () => {
  sincronizarIndice();
  atualizarVisual();
  centralizar();
});

audio.addEventListener("loadedmetadata", () => {
  formatarTempo(audio.duration, durationEl);
  resizeCanvas();
});

function formatarTempo(t, el) {
  if (isNaN(t)) return;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  el.innerText = `${m}:${s}`;
}

// ─── LRC loader ───────────────────────────────────────────────────────────────

async function carregarLRC() {
  const res = await fetch("letra.lrc");
  const txt = await res.text();

  return txt.split("\n").map(l => {
    const m = l.match(/\[(\d+):(\d+\.\d+)\](.*)/);
    if (!m) return null;
    return {
      tempo: parseInt(m[1]) * 60 + parseFloat(m[2]),
      texto: m[3].trim()
    };
  }).filter(Boolean);
}

// ─── Lyric loop (rAF) ─────────────────────────────────────────────────────────

function loopLetra() {
  const tempo = audio.currentTime;
  let novoIndex = indexAtual;

  for (let i = letra.length - 1; i >= 0; i--) {
    if (tempo >= letra[i].tempo) {
      novoIndex = i;
      break;
    }
  }

  if (novoIndex !== indexAtual) {
    indexAtual = novoIndex;
    atualizarVisual();
    centralizar();
  }

  rafId = requestAnimationFrame(loopLetra);
}

function sincronizarIndice() {
  const tempo = audio.currentTime;
  indexAtual = -1;
  for (let i = letra.length - 1; i >= 0; i--) {
    if (tempo >= letra[i].tempo) {
      indexAtual = i;
      break;
    }
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderizar() {
  letraDiv.innerHTML = "";
  letra.forEach((l, i) => {
    const p = document.createElement("p");
    p.innerText = l.texto;
    p.classList.add("linha");
    p.dataset.index = i;
    letraDiv.appendChild(p);
  });
  resizeCanvas();
}

function atualizarVisual() {
  const linhas = document.querySelectorAll(".linha");
  linhas.forEach((el, i) => {
    el.classList.remove("ativa", "vizinha");
    if (i === indexAtual) {
      el.classList.add("ativa");
    } else if (i === indexAtual - 1 || i === indexAtual + 1) {
      el.classList.add("vizinha");
    }
  });
}

// ─── Centralização ────────────────────────────────────────────────────────────

function centralizar() {
  const linhas = document.querySelectorAll(".linha");
  const ativa = linhas[indexAtual];
  const wrapper = document.querySelector(".letra-wrapper");

  if (!ativa || !wrapper) return;

  const offsetTopo = ativa.offsetTop;
  const alturaAtiva = ativa.offsetHeight;
  const alturaVisivel = wrapper.clientHeight;

  const transY = offsetTopo + alturaAtiva / 2 - alturaVisivel / 2;
  letraDiv.style.transform = `translateY(-${Math.max(0, transY)}px)`;
}

// ─── Init ──────────────────────────────────────────────────────────────────────

// Draw empty waveform before audio loads
setTimeout(resizeCanvas, 100);

carregarLRC().then(dados => {
  letra = dados;
  renderizar();
});