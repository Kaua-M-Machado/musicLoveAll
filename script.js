const audio = document.getElementById("musica");
const playBtn = document.getElementById("play");
const progress = document.getElementById("progress");
const progressContainer = document.getElementById("progress-container");

const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const letraDiv = document.getElementById("letra");

let tocando = false;
let letra = [];
let indexAtual = 0;
let animando = false;

playBtn.addEventListener("click", () => {
  if (tocando) {
    audio.pause();
    playBtn.innerText = "▶";
  } else {
    audio.play();
    playBtn.innerText = "⏸";
  }
  tocando = !tocando;
});

audio.addEventListener("timeupdate", () => {
  const { duration, currentTime } = audio;

  const percent = (currentTime / duration) * 100;
  progress.style.width = `${percent}%`;

  formatarTempo(currentTime, currentTimeEl);
  formatarTempo(duration, durationEl);
});

progressContainer.addEventListener("click", (e) => {
  const width = progressContainer.clientWidth;
  const clickX = e.offsetX;
  audio.currentTime = (clickX / width) * audio.duration;
});

function formatarTempo(t, el) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  el.innerText = `${m}:${s}`;
}

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

function renderizar() {
  letraDiv.innerHTML = "";
  letra.forEach((l, i) => {
    const p = document.createElement("p");
    p.innerText = l.texto;
    p.classList.add("linha");
    if (i === indexAtual) p.classList.add("ativa");
    letraDiv.appendChild(p);
  });
}

function centralizar() {
  const linhas = document.querySelectorAll(".linha");
  const ativa = linhas[indexAtual];
  if (!ativa) return;

  const container = document.querySelector(".letra-wrapper");
  const offset = ativa.offsetTop - container.clientHeight / 2;

  letraDiv.style.transform = `translateY(-${offset}px)`;
}

function atualizarLetra() {
  if (!animando) return;

  const tempo = audio.currentTime;

  if (letra[indexAtual + 1] && tempo >= letra[indexAtual + 1].tempo) {
    indexAtual++;
    atualizarVisual();
  }

  requestAnimationFrame(atualizarLetra);
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

  centralizar3Linhas();
}

function centralizar3Linhas() {
  const linhas = document.querySelectorAll(".linha");
  const ativa = linhas[indexAtual];

  if (!ativa) return;

  const alturaLinha = ativa.offsetHeight + 12; 
  const offset = (indexAtual - 1) * alturaLinha;

  letraDiv.style.transform = `translateY(-${offset}px)`;
}

audio.addEventListener("play", () => {
  animando = true;
  atualizarLetra();
});

audio.addEventListener("pause", () => animando = false);

audio.addEventListener("seeked", () => {
  indexAtual = 0;
  atualizarVisual();
});

carregarLRC().then(dados => {
  letra = dados;
  renderizar();
  atualizarVisual();
});