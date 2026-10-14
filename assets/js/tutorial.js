/* Percha · reproductor del tutorial del bóxer */
(function () {
  'use strict';

  const { tallaBase, tallaBaseHombre, tutorialBoxer } = window.Percha;
  const I18n = window.PerchaI18n;
  const t = I18n.t;
  I18n.init();

  const STORE = 'percha:v1';
  const N = 6;

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
  const descEl = document.getElementById('tutStepD');
  const playBtn = document.getElementById('tutPlay');
  const srcEl = document.getElementById('tutSrc');
  const mat2El = document.getElementById('tutMat2');

  let data;
  try {
    data = tutorialBoxer(m);
  } catch (e) {
    console.error(e);
    return;
  }
  stage.innerHTML = data.svg;
  const groups = Array.from(stage.querySelectorAll('.tut-step'));

  const dots = [];
  for (let i = 1; i <= N; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(i);
    b.addEventListener('click', () => { ir(i); pausar(); });
    dotsBox.appendChild(b);
    dots.push(b);
  }

  const reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paso = 1;
  let sonando = false;
  let temporizador = null;

  function pintar() {
    groups.forEach((g, i) => g.classList.toggle('on', i < paso));
    dots.forEach((b, i) => {
      b.setAttribute('aria-current', String(i + 1 === paso));
      b.setAttribute('aria-label', t('tut.stepof', { a: i + 1, b: N }));
    });
    countEl.textContent = t('tut.stepof', { a: paso, b: N });
    titleEl.textContent = t(`tut.s${paso}.t`);
    descEl.textContent = t(`tut.s${paso}.d`, { v: I18n.num(elastico) });
    playBtn.textContent = sonando ? t('tut.pause') : t('tut.play');
    mat2El.textContent = t('tut.mat2', { v: I18n.num(elastico) });
    srcEl.textContent = t(guardadas ? 'tut.saved' : 'tut.default');
  }

  function ir(n) {
    paso = Math.min(N, Math.max(1, n));
    pintar();
  }

  function sonar() {
    if (reducido) { ir(N); return; }
    if (paso >= N) paso = 0;
    sonando = true;
    pintar();
    clearInterval(temporizador);
    temporizador = setInterval(() => {
      if (paso >= N) { pausar(); return; }
      ir(paso + 1);
    }, 2600);
  }

  function pausar() {
    sonando = false;
    clearInterval(temporizador);
    pintar();
  }

  document.getElementById('tutPrev').addEventListener('click', () => { ir(paso - 1); pausar(); });
  document.getElementById('tutNext').addEventListener('click', () => { ir(paso + 1); pausar(); });
  playBtn.addEventListener('click', () => (sonando ? pausar() : sonar()));

  pintar();
  I18n.onChange(() => pintar());
  if (!reducido) sonar();
})();
