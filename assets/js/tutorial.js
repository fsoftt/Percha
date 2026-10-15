/* Percha · reproductor de los tutoriales de costura */
(function () {
  'use strict';

  const { PRENDAS, tallaBase, tallaBaseHombre, tutorial, TUTORIALES } = window.Percha;
  const I18n = window.PerchaI18n;
  const t = I18n.t;
  I18n.init();

  const STORE = 'percha:v1';
  const IDS = Object.keys(TUTORIALES);

  function cargar() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      const base = s && s.sistema === 'hombre' ? tallaBaseHombre(50) : tallaBase(38);
      if (s && s.medidas) return { m: Object.assign(base, s.medidas), guardadas: true, prenda: s.prenda };
    } catch (e) { /* almacenamiento no disponible */ }
    return { m: tallaBase(38), guardadas: false, prenda: null };
  }

  const { m, guardadas, prenda: guardada } = cargar();
  const desdeHash = () => location.hash.replace('#', '');
  let prenda = IDS.includes(desdeHash()) ? desdeHash() : (IDS.includes(guardada) ? guardada : 'boxer');

  const stage = document.getElementById('tutStage');
  const tabsBox = document.getElementById('tutTabs');
  const dotsBox = document.getElementById('tutDots');
  const countEl = document.getElementById('tutCount');
  const titleEl = document.getElementById('tutStepT');
  const pairsEl = document.getElementById('tutPairs');
  const descEl = document.getElementById('tutStepD');
  const playBtn = document.getElementById('tutPlay');
  const srcEl = document.getElementById('tutSrc');
  const headT = document.getElementById('tutTitle');
  const headL = document.getElementById('tutLead');
  const mat1El = document.getElementById('tutMat1');
  const mat2El = document.getElementById('tutMat2');
  const cta = document.getElementById('tutCta');

  let data = null;
  let groups = [];
  let N = 0; // pasos de costura; el 0 presenta las piezas
  let dots = [];
  const k = (sufijo) => `tut.${prenda}.${sufijo}`;
  const v = () => I18n.num((data && data.datos.v) || 0);

  // Pestañas de prenda
  const tabs = IDS.map((id) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => { if (id !== prenda) { history.replaceState(null, '', `#${id}`); cambiar(id); } });
    tabsBox.appendChild(b);
    return { id, b };
  });

  // El SVG lleva los nombres de las piezas: se rehace al cambiar de idioma o de prenda
  function dibujar() {
    try {
      data = tutorial(prenda, m);
      stage.innerHTML = data.svg;
      groups = Array.from(stage.querySelectorAll('.tut-step'));
      N = data.steps.length;
    } catch (e) {
      console.error(e);
      data = null;
      N = 0;
    }
    dotsBox.innerHTML = '';
    dots = [];
    for (let i = 0; i <= N; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i === 0 ? '✂' : String(i);
      b.addEventListener('click', () => { ir(i); pausar(); });
      dotsBox.appendChild(b);
      dots.push(b);
    }
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
    txt.textContent = g.partes.map((p) => `${t(p.pieza)} · ${t(`tut.e.${p.borde.replace(/\d$/, '')}`)}`).join('  +  ');
    li.appendChild(txt);
    return li;
  }

  function pintar() {
    tabs.forEach(({ id, b }) => {
      b.textContent = PRENDAS[id].nombre;
      b.setAttribute('aria-selected', String(id === prenda));
    });
    headT.textContent = t(k('title'));
    headL.textContent = t(k('lead'));
    cta.href = `herramienta.html#${prenda}`;
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
    titleEl.textContent = paso === 0 ? t('tut.s0.t') : t(k(`s${paso}.t`));
    descEl.textContent = t(k(`s${paso}.d`), { v: v() });
    pairsEl.innerHTML = '';
    const st = data && paso > 0 ? data.steps[paso - 1] : null;
    pairsEl.hidden = !st;
    if (st) st.grupos.forEach((g) => pairsEl.appendChild(chip(g)));
    playBtn.textContent = sonando ? t('tut.pause') : t('tut.play');
    mat1El.textContent = t(k('mat1'));
    mat2El.textContent = t(k('mat2'), { v: v() });
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

  function cambiar(id) {
    prenda = id;
    sonando = false;
    clearInterval(temporizador);
    paso = 0;
    dibujar();
    pintar();
  }

  document.getElementById('tutPrev').addEventListener('click', () => { ir(paso - 1); pausar(); });
  document.getElementById('tutNext').addEventListener('click', () => { ir(paso + 1); pausar(); });
  playBtn.addEventListener('click', () => (sonando ? pausar() : sonar()));
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, select, textarea, button[role="tab"]')) return;
    if (e.key === 'ArrowRight') { ir(paso + 1); pausar(); }
    if (e.key === 'ArrowLeft') { ir(paso - 1); pausar(); }
  });
  window.addEventListener('hashchange', () => { if (IDS.includes(desdeHash()) && desdeHash() !== prenda) cambiar(desdeHash()); });

  dibujar();
  pintar();
  I18n.onChange(() => { const p = paso; dibujar(); ir(p); });
})();
