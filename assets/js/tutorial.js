/* Percha · reproductor del tutorial del bóxer */
(function () {
  'use strict';

  const { tallaBase, tallaBaseHombre, tutorialBoxer } = window.Percha;
  const I18n = window.PerchaI18n;
  const t = I18n.t;
  I18n.init();

  const STORE = 'percha:v1';
  const N = 6; // pasos de costura; el 0 presenta las piezas

  function cargarMedidas() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      const base = s && s.sistema === 'hombre' ? tallaBaseHombre(50) : tallaBase(38);
      if (s && s.medidas) return { m: Object.assign(base, s.medidas), guardadas: true };
    } catch (e) { /* almacenamiento no disponible */ }
    return { m: tallaBase(38), guardadas: false };
  }

  const { m, guardadas } = cargarMedidas();
  const elastico = Math.round(m.cintura);

  const stage = document.getElementById('tutStage');
  const dotsBox = document.getElementById('tutDots');
  const countEl = document.getElementById('tutCount');
  const titleEl = document.getElementById('tutStepT');
  const pairsEl = document.getElementById('tutPairs');
  const descEl = document.getElementById('tutStepD');
  const playBtn = document.getElementById('tutPlay');
  const srcEl = document.getElementById('tutSrc');
  const mat2El = document.getElementById('tutMat2');

  let data = null;
  let groups = [];

  // El SVG lleva los nombres de las piezas: se rehace al cambiar de idioma
  function dibujar() {
    try {
      data = tutorialBoxer(m);
      stage.innerHTML = data.svg;
      groups = Array.from(stage.querySelectorAll('.tut-step'));
    } catch (e) {
      console.error(e);
      data = null;
    }
  }

  const dots = [];
  for (let i = 0; i <= N; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = i === 0 ? '✂' : String(i);
    b.addEventListener('click', () => { ir(i); pausar(); });
    dotsBox.appendChild(b);
    dots.push(b);
  }

  const reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paso = 0;
  let sonando = false;
  let temporizador = null;

  function chip(g) {
    const li = document.createElement('li');
    const badge = document.createElement('b');
    badge.className = 'tut-letter';
    badge.style.background = g.color;
    badge.textContent = g.letra;
    li.appendChild(badge);
    const txt = document.createElement('span');
    txt.textContent = g.partes.map((p) => `${t(p.pieza)} · ${t(`tut.e.${p.borde}`)}`).join('  +  ');
    li.appendChild(txt);
    return li;
  }

  function pintar() {
    groups.forEach((g, i) => {
      g.classList.toggle('on', i + 1 === paso);
      g.classList.toggle('done', i + 1 < paso);
    });
    stage.classList.toggle('intro', paso === 0);
    dots.forEach((b, i) => {
      b.setAttribute('aria-current', String(i === paso));
      b.setAttribute('aria-label', i === 0 ? t('tut.s0.t') : t('tut.stepof', { a: i, b: N }));
    });
    countEl.textContent = paso === 0 ? t('tut.intro') : t('tut.stepof', { a: paso, b: N });
    titleEl.textContent = t(`tut.s${paso}.t`);
    descEl.textContent = t(`tut.s${paso}.d`, { v: I18n.num(elastico) });
    pairsEl.innerHTML = '';
    const st = data && paso > 0 ? data.steps[paso - 1] : null;
    pairsEl.hidden = !st;
    if (st) st.grupos.forEach((g) => pairsEl.appendChild(chip(g)));
    playBtn.textContent = sonando ? t('tut.pause') : t('tut.play');
    mat2El.textContent = t('tut.mat2', { v: I18n.num(elastico) });
    srcEl.textContent = t(guardadas ? 'tut.saved' : 'tut.default');
  }

  function ir(n) {
    paso = Math.min(N, Math.max(0, n));
    pintar();
  }

  function sonar() {
    if (reducido) { ir(N); return; }
    if (paso >= N) paso = -1;
    sonando = true;
    ir(paso + 1);
    clearInterval(temporizador);
    temporizador = setInterval(() => {
      if (paso >= N) { pausar(); return; }
      ir(paso + 1);
    }, 5000);
  }

  function pausar() {
    sonando = false;
    clearInterval(temporizador);
    pintar();
  }

  document.getElementById('tutPrev').addEventListener('click', () => { ir(paso - 1); pausar(); });
  document.getElementById('tutNext').addEventListener('click', () => { ir(paso + 1); pausar(); });
  playBtn.addEventListener('click', () => (sonando ? pausar() : sonar()));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') { ir(paso + 1); pausar(); }
    if (e.key === 'ArrowLeft') { ir(paso - 1); pausar(); }
  });

  dibujar();
  pintar();
  I18n.onChange(() => { dibujar(); pintar(); });
})();
