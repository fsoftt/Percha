/* Percha · interfaz de la herramienta */
(function () {
  'use strict';

  const { PRENDAS, MEDIDAS, tallaBase, generar } = window.Percha;
  const $ = (s) => document.querySelector(s);
  const STORE = 'percha:v1';
  const PX_CM = 96 / 2.54; // píxeles CSS por centímetro real

  const ICONOS = {
    falda: '<svg viewBox="0 0 48 48" fill="#FF4D2E" stroke="#14101F" stroke-width="2" stroke-linejoin="round"><path d="M15 8h18l6 32H9z"/><path d="M15 13h18" fill="none"/></svg>',
    cuerpo: '<svg viewBox="0 0 48 48" fill="#B9A6FF" stroke="#14101F" stroke-width="2" stroke-linejoin="round"><path d="M17 6c2 4 12 4 14 0l5 3-1 9c-2 2-2 6 0 8v14H13V26c2-2 2-6 0-8l-1-9z"/></svg>',
    pantalon: '<svg viewBox="0 0 48 48" fill="#D4FF3A" stroke="#14101F" stroke-width="2" stroke-linejoin="round"><path d="M14 6h20l3 36h-9l-4-24-4 24h-9z"/></svg>',
    camiseta: '<svg viewBox="0 0 48 48" fill="#6A3DF0" stroke="#14101F" stroke-width="2" stroke-linejoin="round"><path d="M17 6c2 4 12 4 14 0l11 6-4 9-5-2v23H15V19l-5 2-4-9z"/></svg>',
  };

  const PAPEL = {
    a4: { nombre: 'A4', w: 210, h: 297, fmt: 'a4' },
    carta: { nombre: 'Carta', w: 215.9, h: 279.4, fmt: 'letter' },
  };
  const MARGEN_PAG = 10; // mm
  const SOLAPE = 1; // cm

  // ---------- Estado ----------
  const state = {
    prenda: 'falda',
    talla: '38',
    medidas: tallaBase(38),
    margen: 1,
    papel: 'a4',
    zoom: null, // px por cm; null = ajustar
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved) {
      Object.assign(state.medidas, saved.medidas || {});
      for (const k of ['prenda', 'talla', 'margen', 'papel']) if (saved[k] !== undefined) state[k] = saved[k];
    }
  } catch (e) { /* almacenamiento no disponible */ }
  const fromHash = location.hash.replace('#', '');
  if (PRENDAS[fromHash]) state.prenda = fromHash;
  if (!PRENDAS[state.prenda]) state.prenda = 'falda';

  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ medidas: state.medidas, prenda: state.prenda, talla: state.talla, margen: state.margen, papel: state.papel }));
    } catch (e) { /* ignorar */ }
  }

  // ---------- Toast ----------
  let toastT;
  function toast(msg, ms = 3200) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ---------- Selector de prenda ----------
  function renderPicker() {
    const box = $('#picker');
    box.innerHTML = '';
    for (const [id, p] of Object.entries(PRENDAS)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.setAttribute('aria-pressed', String(id === state.prenda));
      b.innerHTML = `${ICONOS[id]}<b>${p.nombre}</b><small>${p.resumen}</small>`;
      b.addEventListener('click', () => {
        state.prenda = id;
        history.replaceState(null, '', '#' + id);
        state.zoom = null;
        renderPicker();
        renderFields();
        update();
      });
      box.appendChild(b);
    }
  }

  // ---------- Tallas ----------
  function renderTallas() {
    const sel = $('#talla');
    const opts = ['<option value="custom">Personalizada (mis medidas)</option>'];
    for (let t = 34; t <= 54; t += 2) opts.push(`<option value="${t}">Talla ${t}</option>`);
    sel.innerHTML = opts.join('');
    sel.value = state.talla;
    sel.addEventListener('change', () => {
      if (sel.value === 'custom') { state.talla = 'custom'; save(); return; }
      state.talla = sel.value;
      state.medidas = tallaBase(Number(sel.value));
      renderFields();
      update();
      toast(`Medidas de la talla ${sel.value} cargadas`);
    });
  }

  // ---------- Campos de medidas ----------
  const fmt = (n) => (Math.round(n * 10) / 10).toString();

  function renderFields() {
    const form = $('#fields');
    form.innerHTML = '';
    for (const k of PRENDAS[state.prenda].medidas) {
      const m = MEDIDAS[k];
      const wrap = document.createElement('div');
      wrap.className = 'field';
      wrap.innerHTML = `
        <label for="m-${k}">${m.label}
          <button type="button" class="help" aria-label="Cómo medir: ${m.label}" aria-expanded="false" aria-controls="a-${k}">?</button>
        </label>
        <div class="input">
          <input id="m-${k}" name="${k}" type="number" inputmode="decimal" step="0.5" min="${m.min}" max="${m.max}" value="${fmt(state.medidas[k])}" aria-describedby="e-${k}">
          <span>cm</span>
        </div>
        <div class="ayuda-box" id="a-${k}">${m.ayuda}</div>
        <span class="hint" id="e-${k}"></span>`;
      const input = wrap.querySelector('input');
      const help = wrap.querySelector('.help');
      help.addEventListener('click', () => {
        const open = wrap.classList.toggle('show-help');
        help.setAttribute('aria-expanded', String(open));
      });
      input.addEventListener('input', () => {
        const v = parseFloat(String(input.value).replace(',', '.'));
        if (validate(k, input, v)) {
          state.medidas[k] = v;
          if (state.talla !== 'custom') { state.talla = 'custom'; $('#talla').value = 'custom'; }
          schedule();
        }
      });
      form.appendChild(wrap);
    }
    form.onsubmit = (e) => e.preventDefault();
  }

  function validate(k, input, v) {
    const m = MEDIDAS[k];
    const err = document.getElementById('e-' + k);
    let msg = '';
    if (!Number.isFinite(v)) msg = 'Introduce un número.';
    else if (v < m.min || v > m.max) msg = `Entre ${m.min} y ${m.max} cm.`;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    err.textContent = msg;
    err.classList.toggle('err', !!msg);
    return !msg;
  }

  // Comprobaciones de coherencia entre medidas
  function coherence() {
    const md = state.medidas, keys = PRENDAS[state.prenda].medidas;
    const avisos = [];
    if (keys.includes('cadera') && keys.includes('cintura') && md.cintura > md.cadera) avisos.push('La cintura es mayor que la cadera: el patrón no tendrá pinzas.');
    if (state.prenda === 'cuerpo' && md.talleDel < md.talleEsp) avisos.push('El talle delantero suele ser mayor que el de espalda. Revisa ambas medidas.');
    if (state.prenda === 'cuerpo' && md.altBusto > md.talleDel - 6) avisos.push('La altura de busto parece demasiado cercana al talle delantero.');
    if (state.prenda === 'pantalon' && md.largoPantalon < md.tiro + 15) avisos.push('El largo es muy corto respecto al tiro.');
    return avisos;
  }

  // ---------- Opciones ----------
  function bindSeg(id, key, parse) {
    const box = document.getElementById(id);
    const sync = () => box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(parse(b.dataset.v) === state[key])));
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      state[key] = parse(b.dataset.v);
      sync();
      update();
    });
    sync();
  }

  // ---------- Vista previa ----------
  let current = null;
  let timer;
  function schedule() { clearTimeout(timer); timer = setTimeout(update, 120); }

  function tiles(width, height, papel) {
    const p = PAPEL[papel];
    let best = null;
    for (const orient of ['p', 'l']) {
      const pw = orient === 'p' ? p.w : p.h, ph = orient === 'p' ? p.h : p.w;
      const tw = (pw - MARGEN_PAG * 2) / 10, th = (ph - MARGEN_PAG * 2) / 10; // cm
      const cols = Math.max(1, Math.ceil((width - SOLAPE) / (tw - SOLAPE)));
      const rows = Math.max(1, Math.ceil((height - SOLAPE) / (th - SOLAPE)));
      const opt = { orient, pw, ph, tw, th, cols, rows, n: cols * rows };
      if (!best || opt.n < best.n) best = opt;
    }
    return best;
  }

  function update() {
    save();
    try {
      current = generar(state.prenda, state.medidas, { margen: state.margen });
    } catch (e) {
      console.error(e);
      toast('No se pudo trazar el patrón con estas medidas.');
      return;
    }
    const inner = $('#canvasInner');
    inner.innerHTML = current.svg;
    applyZoom();

    const info = [];
    info.push(`<span class="pill">${PRENDAS[state.prenda].nombre}</span>`);
    info.push(`<span class="pill">Tamaño <b>${Math.ceil(current.width)} × ${Math.ceil(current.height)} cm</b></span>`);
    if (state.papel === 'plotter') info.push('<span class="pill">PDF <b>1 hoja</b> de plóter</span>');
    else {
      const t = tiles(current.width, current.height, state.papel);
      info.push(`<span class="pill">PDF <b>${t.n} hojas</b> ${PAPEL[state.papel].nombre}</span>`);
    }
    $('#info').innerHTML = info.join('');

    const notas = [...coherence().map((a) => `⚠ ${a}`), ...current.notas];
    $('#notas').innerHTML = notas.map((n) => `<li>${n}</li>`).join('');
  }

  function fitZoom() {
    const c = $('#canvas');
    const w = c.clientWidth - 44, h = c.clientHeight - 44;
    return Math.max(1, Math.min(w / current.width, h / current.height));
  }

  function applyZoom() {
    if (!current) return;
    const z = state.zoom || fitZoom();
    const svg = $('#canvasInner svg');
    svg.setAttribute('width', Math.round(current.width * z));
    svg.setAttribute('height', Math.round(current.height * z));
    $('#zoomVal').textContent = Math.round((z / PX_CM) * 100) + '%';
  }

  function zoomBy(k) {
    const c = $('#canvas');
    const z0 = state.zoom || fitZoom();
    const z = Math.min(Math.max(z0 * k, 1), PX_CM * 2);
    // mantener el centro visible
    const cx = (c.scrollLeft + c.clientWidth / 2) / z0, cy = (c.scrollTop + c.clientHeight / 2) / z0;
    state.zoom = z;
    applyZoom();
    c.scrollLeft = cx * z - c.clientWidth / 2;
    c.scrollTop = cy * z - c.clientHeight / 2;
  }

  $('#zoomIn').addEventListener('click', () => zoomBy(1.3));
  $('#zoomOut').addEventListener('click', () => zoomBy(1 / 1.3));
  $('#zoomFit').addEventListener('click', () => { state.zoom = null; applyZoom(); });
  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (!state.zoom) applyZoom(); }, 100); });

  // ---------- Descargas ----------
  function nombreArchivo(ext) {
    const d = new Date().toISOString().slice(0, 10);
    return `percha-${state.prenda}-${d}.${ext}`;
  }

  function descargar(blob, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  $('#btnSvg').addEventListener('click', () => {
    if (!current) return;
    descargar(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + current.svg], { type: 'image/svg+xml' }), nombreArchivo('svg'));
    toast('SVG descargado a escala real (unidades en cm).');
  });

  function svgEl(markup) {
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    const el = document.importNode(doc.documentElement, true);
    $('#pdfStage').appendChild(el);
    return el;
  }

  function colLabel(i) { return String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : ''); }

  async function exportarPdf() {
    if (!current) return;
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('No se pudo cargar el generador de PDF.'); return; }
    const btn = $('#btnPdf');
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Generando…';
    const stage = $('#pdfStage');
    try {
      const { jsPDF } = window.jspdf;
      const W = current.width, H = current.height;
      const titulo = `Percha · ${PRENDAS[state.prenda].nombre}`;
      let doc;

      if (state.papel === 'plotter') {
        const wmm = W * 10, hmm = H * 10;
        doc = new jsPDF({ unit: 'mm', format: [wmm, hmm], orientation: wmm > hmm ? 'l' : 'p' });
        const el = svgEl(`<svg xmlns="http://www.w3.org/2000/svg" width="${wmm}mm" height="${hmm}mm" viewBox="0 0 ${W} ${H}">${current.inner}</svg>`);
        await doc.svg(el, { x: 0, y: 0, width: wmm, height: hmm });
      } else {
        const t = tiles(W, H, state.papel);
        const fmtName = PAPEL[state.papel].fmt;
        doc = new jsPDF({ unit: 'mm', format: fmtName, orientation: t.orient });
        const stepX = t.tw - SOLAPE, stepY = t.th - SOLAPE;

        // Hoja de montaje
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(26);
        doc.setTextColor(20, 16, 31);
        doc.text('percha', MARGEN_PAG, MARGEN_PAG + 10);
        doc.setTextColor(255, 77, 46);
        doc.text('.', MARGEN_PAG + doc.getTextWidth('percha'), MARGEN_PAG + 10);
        doc.setTextColor(20, 16, 31);
        doc.setFontSize(14);
        doc.text(titulo.replace('Percha · ', ''), MARGEN_PAG, MARGEN_PAG + 19);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const instr = [
          `${t.n} hojas ${PAPEL[state.papel].nombre} (${t.cols} columnas x ${t.rows} filas). Patrón de ${Math.ceil(W)} x ${Math.ceil(H)} cm.`,
          '1. Imprime a escala 100 % ("Tamaño real"), sin "Ajustar a la página".',
          '2. Mide el cuadro de control de la hoja A1: debe medir exactamente 10 x 10 cm.',
          '3. Recorta el margen derecho e inferior de cada hoja por la línea discontinua',
          '   y solápala 1 cm sobre la siguiente, haciendo coincidir las marcas.',
          '4. Une las hojas con cinta adhesiva siguiendo el mapa inferior.',
          state.margen > 0 ? `Margen de costura incluido: ${String(state.margen).replace('.', ',')} cm (zona coral). Corta por la línea exterior.` : 'El patrón no incluye margen de costura: añádelo al cortar la tela.',
        ];
        doc.text(instr, MARGEN_PAG, MARGEN_PAG + 29, { lineHeightFactor: 1.5 });

        // Mapa
        const mapTop = MARGEN_PAG + 82;
        const availW = t.pw - MARGEN_PAG * 2, availH = t.ph - mapTop - MARGEN_PAG;
        const sc = Math.min(availW / (t.cols * stepX + SOLAPE), availH / (t.rows * stepY + SOLAPE));
        const map = svgEl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${current.inner}</svg>`);
        await doc.svg(map, { x: MARGEN_PAG, y: mapTop, width: W * sc, height: H * sc });
        stage.innerHTML = '';
        doc.setLineWidth(0.3);
        doc.setDrawColor(106, 61, 240);
        doc.setFontSize(Math.max(6, Math.min(14, stepX * sc * 0.35)));
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(106, 61, 240);
        for (let r = 0; r < t.rows; r++) {
          for (let c = 0; c < t.cols; c++) {
            const x = MARGEN_PAG + c * stepX * sc, y = mapTop + r * stepY * sc;
            doc.rect(x, y, stepX * sc, stepY * sc);
            doc.text(`${colLabel(c)}${r + 1}`, x + (stepX * sc) / 2, y + (stepY * sc) / 2, { align: 'center', baseline: 'middle' });
          }
        }

        // Hojas
        for (let r = 0; r < t.rows; r++) {
          for (let c = 0; c < t.cols; c++) {
            doc.addPage(fmtName, t.orient);
            const vx = c * stepX, vy = r * stepY;
            const lbl = `${colLabel(c)}${r + 1}`;
            // Marcas de unión: línea de corte del solape y rombos de alineación
            const ox = vx + t.tw - SOLAPE, oy = vy + t.th - SOLAPE;
            const overlay = [
              `<rect x="${vx}" y="${vy}" width="${t.tw}" height="${t.th}" fill="none" stroke="#B9A6FF" stroke-width="0.04"/>`,
              c < t.cols - 1 ? `<path d="M${ox} ${vy} V${vy + t.th}" stroke="#6A3DF0" stroke-width="0.04" stroke-dasharray="0.4 0.3"/>` : '',
              r < t.rows - 1 ? `<path d="M${vx} ${oy} H${vx + t.tw}" stroke="#6A3DF0" stroke-width="0.04" stroke-dasharray="0.4 0.3"/>` : '',
              `<rect x="${vx + 0.3}" y="${vy + 0.3}" width="${lbl.length * 0.75 + 0.9}" height="1.6" rx="0.3" fill="#14101F"/>`,
              `<text x="${vx + 0.75}" y="${vy + 1.55}" font-size="1.1" font-weight="bold" fill="#D4FF3A" font-family="Helvetica, Arial, sans-serif">${lbl}</text>`,
              `<text x="${vx + t.tw - 0.3}" y="${vy + t.th - 0.3}" font-size="0.45" fill="#7A6FA6" text-anchor="end" font-family="Helvetica, Arial, sans-serif">${titulo} · hoja ${lbl} de ${colLabel(t.cols - 1)}${t.rows}</text>`,
            ];
            for (const fy of [0.33, 0.66]) {
              if (c < t.cols - 1) overlay.push(`<path d="M${ox} ${vy + t.th * fy - 0.5} l0.5 0.5 l-0.5 0.5 l-0.5 -0.5 z" fill="#6A3DF0"/>`);
              if (r < t.rows - 1) overlay.push(`<path d="M${vx + t.tw * fy - 0.5} ${oy} l0.5 -0.5 l0.5 0.5 l-0.5 0.5 z" fill="#6A3DF0"/>`);
            }
            const el = svgEl(`<svg xmlns="http://www.w3.org/2000/svg" width="${t.tw * 10}mm" height="${t.th * 10}mm" viewBox="${vx} ${vy} ${t.tw} ${t.th}">${current.inner}${overlay.join('')}</svg>`);
            await doc.svg(el, { x: MARGEN_PAG, y: MARGEN_PAG, width: t.tw * 10, height: t.th * 10 });
            stage.innerHTML = '';
            btn.textContent = `Generando… ${r * t.cols + c + 1}/${t.n}`;
            await new Promise((res) => setTimeout(res, 0));
          }
        }
      }
      doc.setProperties({ title: titulo, creator: 'Percha' });
      doc.save(nombreArchivo('pdf'));
      toast('PDF listo. Imprime al 100 % (tamaño real).', 4500);
    } catch (e) {
      console.error(e);
      toast('Error al generar el PDF. Prueba con el SVG.');
    } finally {
      stage.innerHTML = '';
      btn.disabled = false;
      btn.textContent = label;
    }
  }
  $('#btnPdf').addEventListener('click', exportarPdf);

  // ---------- Inicio ----------
  renderPicker();
  renderTallas();
  renderFields();
  bindSeg('margen', 'margen', parseFloat);
  bindSeg('papel', 'papel', String);
  update();
  window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#', '');
    if (PRENDAS[h] && h !== state.prenda) { state.prenda = h; state.zoom = null; renderPicker(); renderFields(); update(); }
  });
})();
