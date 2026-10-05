/*
 * Percha · motor de patronaje
 * Todas las coordenadas están en centímetros. El eje Y crece hacia abajo.
 * Cada función de trazado recibe un objeto de medidas y devuelve una lista de piezas.
 */
(function (global) {
  'use strict';

  // ---------- Geometría básica ----------
  const P = (x, y) => ({ x, y });
  const f = (n) => (Math.round(n * 1000) / 1000).toString();
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const lerp = (a, b, t) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  function cubicAt(p0, c1, c2, p1, t) {
    const u = 1 - t;
    return P(
      u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
      u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y
    );
  }

  function cubicLen(p0, c1, c2, p1, steps = 60) {
    let len = 0, prev = p0;
    for (let i = 1; i <= steps; i++) {
      const p = cubicAt(p0, c1, c2, p1, i / steps);
      len += dist(prev, p);
      prev = p;
    }
    return len;
  }

  // Punto sobre la recta a→b con la coordenada y indicada
  function onLineAtY(a, b, y) {
    const t = (y - a.y) / (b.y - a.y || 1e-9);
    return lerp(a, b, t);
  }

  class Path {
    constructor() { this.d = []; this.pts = []; this.cur = null; this.len = 0; }
    M(p) { this.d.push(`M${f(p.x)} ${f(p.y)}`); this.pts.push(p); this.cur = p; return this; }
    L(p) { this.d.push(`L${f(p.x)} ${f(p.y)}`); this.pts.push(p); this.len += dist(this.cur, p); this.cur = p; return this; }
    C(c1, c2, p) {
      this.d.push(`C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p.x)} ${f(p.y)}`);
      for (let i = 1; i <= 12; i++) this.pts.push(cubicAt(this.cur, c1, c2, p, i / 12));
      this.len += cubicLen(this.cur, c1, c2, p);
      this.cur = p;
      return this;
    }
    Z() { this.d.push('Z'); return this; }
    toString() { return this.d.join(' '); }
  }

  const seg = (a, b) => `M${f(a.x)} ${f(a.y)} L${f(b.x)} ${f(b.y)}`;

  // Pinza: dos piernas desde la boca hasta el vértice
  function dart(a, tip, b) {
    return { d: `M${f(a.x)} ${f(a.y)} L${f(tip.x)} ${f(tip.y)} L${f(b.x)} ${f(b.y)}`, tipo: 'pinza' };
  }

  function guide(a, b, texto) {
    return { d: seg(a, b), tipo: 'guia', texto, at: lerp(a, b, 0.5) };
  }

  function notch(p, dir) {
    // pequeño piquete perpendicular al borde
    const n = Math.hypot(dir.x, dir.y) || 1;
    const q = P(p.x + (dir.x / n) * 0.6, p.y + (dir.y / n) * 0.6);
    return { d: seg(p, q), tipo: 'piquete' };
  }

  function bbox(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  // ---------- Falda recta ----------
  function falda(m) {
    const W = m.cintura, H = m.cadera, hh = m.altCadera, L = m.largoFalda;
    const piezas = [];
    const notas = [];

    for (const lado of ['del', 'esp']) {
      const isF = lado === 'del';
      const w = (H + 4) / 4 + (isF ? 0.5 : -0.5);
      const wt = (W + 1) / 4 + (isF ? 0.5 : -0.5);
      const exc = Math.max(w - wt, 0);
      let side, pz;
      if (exc <= 2.5) { side = exc; pz = 0; }
      else { side = Math.min(2.5 + (exc - 2.5) * 0.3, 4); pz = exc - side; }
      const n = pz === 0 ? 0 : (pz > (isF ? 3.5 : 3) ? 2 : 1);
      const cbY = isF ? 0 : 1;
      const st = P(w - side, -1);
      const top = P(0, cbY);

      const path = new Path()
        .M(top)
        .C(P(st.x * 0.5, cbY), P(st.x * 0.85, st.y + 0.2), st)
        .C(P(st.x + side * 0.6, hh * 0.3), P(w, hh * 0.6), P(w, hh))
        .L(P(w, L))
        .L(P(0, L))
        .Z();

      const lineas = [guide(P(0, hh), P(w, hh), 'Línea de cadera')];
      const waistY = (x) => cbY + (st.y - cbY) * Math.pow(x / st.x, 2);
      for (let i = 1; i <= n; i++) {
        const x = (st.x * i) / (n + 1);
        const half = pz / n / 2;
        const len = (isF ? 9 : 13) - (i - 1) * 1.5;
        lineas.push(dart(P(x - half, waistY(x - half)), P(x, cbY + len), P(x + half, waistY(x + half))));
      }
      if (!isF) {
        lineas.push(notch(P(0, 20), P(1, 0)));
        lineas.push({ d: seg(P(0.8, 20), P(3.5, 20)), tipo: 'guia', texto: 'Fin cremallera', at: P(2.2, 19.4) });
      }
      piezas.push({
        nombre: isF ? 'Falda · Delantero' : 'Falda · Espalda',
        corte: isF ? 'Cortar 1 al doblez' : 'Cortar 2',
        doblez: isF,
        outline: path,
        lineas,
        hilo: { x: w * 0.55, y1: hh + 4, y2: L - 6 },
        etiqueta: P(w * 0.5, hh + (L - hh) * 0.35),
      });
      if (pz > 0) notas.push(`${isF ? 'Delantero' : 'Espalda'}: ${n} pinza(s) de ${(pz / n).toFixed(1)} cm`);
    }

    const cl = W + 1 + 3;
    const cint = new Path().M(P(0, 0)).L(P(cl, 0)).L(P(cl, 8)).L(P(0, 8)).Z();
    piezas.push({
      nombre: 'Cinturilla',
      corte: 'Cortar 1',
      doblez: false,
      outline: cint,
      lineas: [guide(P(0, 4), P(cl, 4), 'Doblar aquí'), { d: seg(P(cl - 3, 0), P(cl - 3, 8)), tipo: 'guia', texto: 'Cruce 3 cm', at: P(cl - 1.5, 2) }],
      hilo: { x: null, y: 6, x1: 4, x2: Math.min(cl - 6, 30) },
      etiqueta: P(Math.min(cl / 2, 22), 2),
      compacta: true,
    });

    return {
      piezas,
      notas: [
        'Holgura: 4 cm en cadera, 1 cm en cintura.',
        ...notas,
        'Cremallera invisible de 20 cm en centro espalda.',
      ],
    };
  }

  // ---------- Cuerpo básico (delantero y espalda) ----------
  function cuerpo(m) {
    const B = m.pecho, W = m.cintura, te = m.talleEsp, td = m.talleDel, ae = m.anchoEsp,
      sh = m.hombro, N = m.cuello, ab = m.altBusto, sb = m.sepBusto;
    const sisa = B / 6 + 6;
    const nw = N / 6 + 0.5;
    const notas = [];

    // Espalda
    const bw = (B + 8) / 4 - 1;
    const snpB = P(nw, -2);
    const dropB = Math.min(4, sh - 1);
    const spB = P(nw + Math.sqrt(sh * sh - dropB * dropB), -2 + dropB);
    const uaB = P(bw, sisa);
    const bwp = P(Math.min(ae / 2, bw - 1.5), (spB.y + sisa) / 2 + 1);
    const excB = Math.max(bw - ((W + 4) / 4 - 1), 0);
    let sideB = Math.min(excB * 0.4, 2.5), pzB = excB - sideB;
    if (pzB > 4) { sideB += pzB - 4; pzB = 4; }
    const wsB = P(bw - sideB, te);

    const back = new Path()
      .M(P(0, 0))
      .C(P(nw * 0.55, 0), P(nw, -0.8), snpB)
      .L(spB)
      .C(P(spB.x - 0.3, spB.y + 3), P(bwp.x, bwp.y - 3), bwp)
      .C(P(bwp.x, bwp.y + (sisa - bwp.y) * 0.6), P(bwp.x + (bw - bwp.x) * 0.3, sisa), uaB)
      .L(wsB)
      .L(P(0, te))
      .Z();
    const dxB = ae / 4 + 1;
    const linB = [guide(P(0, sisa), P(bw, sisa), 'Línea de sisa')];
    if (pzB > 0.3) linB.push(dart(P(dxB - pzB / 2, te), P(dxB, sisa + 2), P(dxB + pzB / 2, te)));

    // Delantero
    const fw = (B + 8) / 4 + 1;
    const snpF = P(nw, 0);
    const nd = nw + 1;
    const dropF = Math.min(5, sh - 1);
    const spF = P(nw + Math.sqrt(sh * sh - dropF * dropF), dropF);
    const uaY = sisa + 2;
    const uaF = P(fw, uaY);
    const fwp = P(Math.min(ae / 2 - 1.5, fw - 1.5), (spF.y + uaY) / 2 + 2);
    const excF = Math.max(fw - ((W + 4) / 4 + 1), 0);
    let sideF = Math.min(excF * 0.35, 2), pzF = excF - sideF;
    if (pzF > 4.5) { sideF += pzF - 4.5; pzF = 4.5; }
    const wsF = P(fw - sideF, td);
    const bp = P(sb / 2, ab);

    const front = new Path()
      .M(P(0, nd))
      .C(P(nw * 0.55, nd), P(nw, nd * 0.55), snpF)
      .L(spF)
      .C(P(spF.x - 0.5, spF.y + 3), P(fwp.x, fwp.y - 3), fwp)
      .C(P(fwp.x, fwp.y + (uaY - fwp.y) * 0.55), P(fwp.x + (fw - fwp.x) * 0.35, uaY), uaF)
      .L(wsF)
      .L(P(0, td))
      .Z();

    const linF = [guide(P(0, uaY), P(fw, uaY), 'Línea de sisa')];
    // Pinza de costado: absorbe la diferencia de largo por el busto
    const dSide = clamp(td - (te + 2), 0, 6);
    if (dSide >= 0.5) {
      const a = onLineAtY(uaF, wsF, uaY + 5);
      const b = onLineAtY(uaF, wsF, uaY + 5 + dSide);
      const mid = lerp(a, b, 0.5);
      const v = P(mid.x - bp.x, mid.y - bp.y), n = Math.hypot(v.x, v.y) || 1;
      const tip = P(bp.x + (v.x / n) * 2.5, bp.y + (v.y / n) * 2.5);
      linF.push(dart(a, tip, b));
      notas.push(`Pinza de costado de ${dSide.toFixed(1)} cm (diferencia de talles).`);
    }
    if (pzF > 0.3) linF.push(dart(P(bp.x - pzF / 2, td), P(bp.x, bp.y + 2.5), P(bp.x + pzF / 2, td)));
    linF.push({ d: `M${f(bp.x - 0.4)} ${f(bp.y)} L${f(bp.x + 0.4)} ${f(bp.y)} M${f(bp.x)} ${f(bp.y - 0.4)} L${f(bp.x)} ${f(bp.y + 0.4)}`, tipo: 'piquete', texto: 'Punto de busto', at: P(bp.x + 2.2, bp.y - 0.6) });

    return {
      piezas: [
        {
          nombre: 'Cuerpo · Espalda', corte: 'Cortar 1 al doblez', doblez: true, outline: back, lineas: linB,
          hilo: { x: bw * 0.6, y1: sisa + 3, y2: te - 4 }, etiqueta: P(bw * 0.45, sisa - 5),
        },
        {
          nombre: 'Cuerpo · Delantero', corte: 'Cortar 1 al doblez', doblez: true, outline: front, lineas: linF,
          hilo: { x: fw * 0.72, y1: uaY + 9, y2: td - 3 }, etiqueta: P(fw * 0.45, uaY - 5),
        },
      ],
      notas: [
        'Holgura: 8 cm en pecho, 4 cm en cintura.',
        `Profundidad de sisa: ${sisa.toFixed(1)} cm desde la nuca.`,
        ...notas,
        pzF > 0.3 ? `Pinza de cintura delantera: ${pzF.toFixed(1)} cm.` : 'Sin pinza de cintura delantera.',
        pzB > 0.3 ? `Pinza de cintura espalda: ${pzB.toFixed(1)} cm.` : 'Sin pinza de cintura en espalda.',
      ],
    };
  }

  // ---------- Pantalón básico ----------
  function pantalon(m) {
    const W = m.cintura, H = m.cadera, T = m.tiro, L = m.largoPantalon, hem = m.bajo;
    const yh = (T * 2) / 3;
    const yk = T + (L - T) / 2 - 5;
    const piezas = [];
    const notas = [];

    // Delantero (costado en x=0, centro delantero a la derecha)
    {
      const fw = (H + 4) / 4 - 1;
      const ext = H / 20;
      const xc = (fw + ext) / 2;
      const hemF = hem / 2 - 2, kneeF = hemF + 2;
      const cf = P(fw - 1, 0);
      const wf = (W + 2) / 4;
      const exc = cf.x - wf;
      let pz = exc > 2 ? Math.min(exc - 2, 2.5) : 0;
      const s = Math.max(cf.x - (wf + pz), 0);
      const st = P(s, 0);
      const tip = P(fw + ext, T);
      const kIn = P(xc + kneeF / 2, yk), kOut = P(xc - kneeF / 2, yk);
      const hIn = P(xc + hemF / 2, L), hOut = P(xc - hemF / 2, L);
      const path = new Path()
        .M(st).L(cf).L(P(fw, yh))
        .C(P(fw, yh + (T - yh) * 0.6), P(fw + ext * 0.35, T), tip)
        .C(P(tip.x - 0.6, T + 3), P(kIn.x + 0.3, yk - 8), kIn)
        .L(hIn).L(hOut).L(kOut)
        .C(P(kOut.x - 0.3, yk - 12), P(0, T + 3), P(0, yh))
        .C(P(0, yh * 0.45), P(s * 0.6, yh * 0.12), st)
        .Z();
      const lineas = [
        guide(P(0, yh), P(fw, yh), 'Cadera'),
        guide(P(0, T), P(tip.x, T), 'Tiro'),
        guide(kOut, kIn, 'Rodilla'),
      ];
      if (pz > 0.3) lineas.push(dart(P(xc - pz / 2, 0), P(xc, 9), P(xc + pz / 2, 0)));
      piezas.push({
        nombre: 'Pantalón · Delantero', corte: 'Cortar 2', doblez: false, outline: path, lineas,
        hilo: { x: xc, y1: T + 12, y2: L - 6 }, etiqueta: P(xc, T + 6),
      });
      notas.push(`Delantero: ancho de cadera ${fw.toFixed(1)} cm + cruce ${ext.toFixed(1)} cm.`);
    }

    // Trasero
    {
      const bw = (H + 4) / 4 + 1;
      const ext = H / 10;
      const xc = (bw + ext) / 2 - 1;
      const hemB = hem / 2 + 2, kneeB = hemB + 2;
      const cb = P(bw - 3.5, -3);
      const wb = (W + 2) / 4;
      const exc0 = dist(P(0, 0), cb) - wb;
      let pz = exc0 > 2 ? Math.min(exc0 - 2, 4) : 0;
      const target = wb + pz;
      const dx = Math.sqrt(Math.max(target * target - 9, 0));
      const s = Math.max(cb.x - dx, 0);
      const st = P(s, 0);
      const tip = P(bw + ext, T + 1);
      const kIn = P(xc + kneeB / 2, yk), kOut = P(xc - kneeB / 2, yk);
      const hIn = P(xc + hemB / 2, L), hOut = P(xc - hemB / 2, L);
      const path = new Path()
        .M(st).L(cb).L(P(bw, yh))
        .C(P(bw + 0.3, yh + (T + 1 - yh) * 0.65), P(bw + ext * 0.45, T + 1), tip)
        .C(P(tip.x - 1, T + 4), P(kIn.x + 0.3, yk - 8), kIn)
        .L(hIn).L(hOut).L(kOut)
        .C(P(kOut.x - 0.3, yk - 12), P(0, T + 3), P(0, yh))
        .C(P(0, yh * 0.45), P(s * 0.6, yh * 0.12), st)
        .Z();
      const lineas = [
        guide(P(0, yh), P(bw, yh), 'Cadera'),
        guide(P(0, T), P(tip.x, T), 'Tiro'),
        guide(kOut, kIn, 'Rodilla'),
      ];
      if (pz > 0.3) {
        const n = pz > 3 ? 2 : 1;
        const wv = P(cb.x - st.x, cb.y - st.y), wl = Math.hypot(wv.x, wv.y);
        const u = P(wv.x / wl, wv.y / wl);
        const nrm = P(-u.y, u.x); // perpendicular hacia abajo
        for (let i = 1; i <= n; i++) {
          const c = lerp(st, cb, i / (n + 1));
          const h = pz / n / 2;
          const len = 12 - (i - 1) * 2;
          lineas.push(dart(
            P(c.x - u.x * h, c.y - u.y * h),
            P(c.x + nrm.x * len, c.y + nrm.y * len),
            P(c.x + u.x * h, c.y + u.y * h)
          ));
        }
        notas.push(`Trasero: ${n} pinza(s) de ${(pz / n).toFixed(1)} cm.`);
      }
      piezas.push({
        nombre: 'Pantalón · Trasero', corte: 'Cortar 2', doblez: false, outline: path, lineas,
        hilo: { x: xc, y1: T + 12, y2: L - 6 }, etiqueta: P(xc, T + 6.5),
      });
    }

    const cl = W + 2 + 3;
    piezas.push({
      nombre: 'Cinturilla', corte: 'Cortar 1', doblez: false,
      outline: new Path().M(P(0, 0)).L(P(cl, 0)).L(P(cl, 8)).L(P(0, 8)).Z(),
      lineas: [guide(P(0, 4), P(cl, 4), 'Doblar aquí')],
      hilo: { x: null, y: 6, x1: 4, x2: Math.min(cl - 6, 30) },
      etiqueta: P(Math.min(cl / 2, 22), 2), compacta: true,
    });

    return {
      piezas,
      notas: ['Holgura: 4 cm en cadera, 2 cm en cintura.', ...notas, 'El hilo coincide con la raya del pantalón.'],
    };
  }

  // ---------- Camiseta básica ----------
  function camiseta(m) {
    const B = m.pecho, Lt = m.largoCamiseta, AH = m.hombros, N = m.cuello, Lm = m.largoManga, Bi = m.brazo;
    const w = (B + 10) / 4;
    const sisa = B / 6 + 8;
    const nw = N / 6 + 1;
    const sp = P(clamp(AH / 2, nw + 4, w - 0.5), 4);
    const ua = P(w, sisa);
    const ap = P(Math.min(sp.x - 1, w - 1.5), sisa * 0.62);
    const piezas = [];
    let arm = 0;

    for (const lado of ['esp', 'del']) {
      const nd = lado === 'esp' ? 2.5 : N / 6 + 2;
      const path = new Path()
        .M(P(0, nd))
        .C(P(nw * 0.55, nd), P(nw, nd * 0.5), P(nw, 0))
        .L(sp);
      const before = path.len;
      path
        .C(P(sp.x - 0.4, sp.y + 4), P(ap.x, ap.y - 4), ap)
        .C(P(ap.x, ap.y + (sisa - ap.y) * 0.6), P(ap.x + (w - ap.x) * 0.35, sisa), ua);
      arm += path.len - before;
      path.L(P(w, Lt)).L(P(0, Lt)).Z();
      piezas.push({
        nombre: lado === 'esp' ? 'Camiseta · Espalda' : 'Camiseta · Delantero',
        corte: 'Cortar 1 al doblez', doblez: true, outline: path,
        lineas: [guide(P(0, sisa), P(w, sisa), 'Línea de sisa')],
        hilo: { x: w * 0.6, y1: sisa + 4, y2: Lt - 6 }, etiqueta: P(w * 0.45, sisa + (Lt - sisa) * 0.3),
      });
    }

    // Manga: se ajusta la altura de copa para que su contorno iguale la sisa (+1 cm de embebido)
    const sw = (Bi + 6) / 2;
    const target = arm + 1;
    const capLen = (h) => 2 * cubicLen(P(0, h), P(sw * 0.3, h), P(sw * 0.6, 0), P(sw, 0));
    let lo = 2, hi = 25;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (capLen(mid) < target) lo = mid; else hi = mid;
    }
    const h = (lo + hi) / 2;
    const hemY = Math.max(Lm, h + 3);
    const sleeve = new Path()
      .M(P(0, h))
      .C(P(sw * 0.3, h), P(sw * 0.6, 0), P(sw, 0))
      .C(P(sw * 1.4, 0), P(sw * 1.7, h), P(2 * sw, h))
      .L(P(2 * sw - 2, hemY))
      .L(P(2, hemY))
      .Z();
    piezas.push({
      nombre: 'Camiseta · Manga', corte: 'Cortar 2', doblez: false, outline: sleeve,
      lineas: [guide(P(0, h), P(2 * sw, h), 'Línea de bíceps'), notch(P(sw, 0), P(0, 1))],
      hilo: { x: sw, y1: h + 1.5, y2: hemY - 1.5 }, etiqueta: P(sw, h - 3.5),
    });

    return {
      piezas,
      notas: [
        'Holgura: 10 cm en pecho, 6 cm en bíceps.',
        `Contorno de sisa (delantero + espalda): ${arm.toFixed(1)} cm.`,
        `Altura de copa de manga calculada: ${h.toFixed(1)} cm.`,
        'Pensada para tejido de punto.',
      ],
    };
  }

  // ---------- Catálogo de prendas y medidas ----------
  const MEDIDAS = {
    pecho: { label: 'Contorno de pecho', ayuda: 'Por la parte más saliente del busto, cinta horizontal.', min: 60, max: 160 },
    cintura: { label: 'Contorno de cintura', ayuda: 'En la parte más estrecha del torso, sin apretar.', min: 45, max: 150 },
    cadera: { label: 'Contorno de cadera', ayuda: 'Por la parte más ancha de las nalgas.', min: 60, max: 170 },
    altCadera: { label: 'Altura de cadera', ayuda: 'Desde la cintura hasta la línea de cadera, por el costado.', min: 12, max: 30 },
    largoFalda: { label: 'Largo de falda', ayuda: 'Desde la cintura hasta donde quieres el bajo.', min: 30, max: 110 },
    talleEsp: { label: 'Talle espalda', ayuda: 'Desde la nuca (vértebra prominente) hasta la cintura.', min: 30, max: 55 },
    talleDel: { label: 'Talle delantero', ayuda: 'Desde el cuello en el hombro, pasando por el busto, hasta la cintura.', min: 32, max: 62 },
    anchoEsp: { label: 'Ancho de espalda', ayuda: 'De axila a axila por la espalda, a media altura del omóplato.', min: 25, max: 55 },
    hombro: { label: 'Largo de hombro', ayuda: 'Desde la base del cuello hasta el hueso del hombro.', min: 8, max: 20 },
    cuello: { label: 'Contorno de cuello', ayuda: 'Por la base del cuello.', min: 28, max: 55 },
    altBusto: { label: 'Altura de busto', ayuda: 'Desde el cuello en el hombro hasta el pezón.', min: 18, max: 40 },
    sepBusto: { label: 'Separación de busto', ayuda: 'Distancia entre ambos pezones.', min: 12, max: 28 },
    tiro: { label: 'Tiro', ayuda: 'Sentada en una silla dura: desde la cintura hasta el asiento, por el costado.', min: 18, max: 40 },
    largoPantalon: { label: 'Largo de pantalón', ayuda: 'Desde la cintura hasta el suelo por el costado (o donde quieras el bajo).', min: 50, max: 130 },
    bajo: { label: 'Contorno de bajo', ayuda: 'Ancho total deseado en el bajo de cada pierna.', min: 30, max: 70 },
    largoCamiseta: { label: 'Largo de camiseta', ayuda: 'Desde el cuello en el hombro hasta el bajo deseado.', min: 40, max: 95 },
    hombros: { label: 'Ancho de hombros', ayuda: 'De hueso a hueso de los hombros, por la espalda.', min: 28, max: 60 },
    largoManga: { label: 'Largo de manga', ayuda: 'Desde el hueso del hombro hasta el bajo de la manga.', min: 10, max: 70 },
    brazo: { label: 'Contorno de brazo', ayuda: 'Por la parte más ancha del brazo (bíceps).', min: 18, max: 55 },
  };

  const PRENDAS = {
    falda: { nombre: 'Falda recta', resumen: 'Delantero, espalda y cinturilla', medidas: ['cintura', 'cadera', 'altCadera', 'largoFalda'], trazar: falda },
    cuerpo: { nombre: 'Cuerpo básico', resumen: 'Patrón base con pinzas de busto y cintura', medidas: ['pecho', 'cintura', 'talleEsp', 'talleDel', 'anchoEsp', 'hombro', 'cuello', 'altBusto', 'sepBusto'], trazar: cuerpo },
    pantalon: { nombre: 'Pantalón básico', resumen: 'Delantero, trasero y cinturilla', medidas: ['cintura', 'cadera', 'tiro', 'largoPantalon', 'bajo'], trazar: pantalon },
    camiseta: { nombre: 'Camiseta', resumen: 'Delantero, espalda y manga corta o larga', medidas: ['pecho', 'hombros', 'cuello', 'largoCamiseta', 'largoManga', 'brazo'], trazar: camiseta },
  };

  // Tallas de referencia (aproximadas, tabla española de mujer)
  function tallaBase(t) {
    const k = (t - 38) / 2;
    return {
      pecho: 88 + 4 * k, cintura: 68 + 4 * k, cadera: 94 + 4 * k, altCadera: 20 + 0.25 * k,
      largoFalda: 60, talleEsp: 40 + 0.5 * k, talleDel: 43 + 0.75 * k, anchoEsp: 35 + 1 * k,
      hombro: 12 + 0.25 * k, cuello: 36 + 1 * k, altBusto: 26 + 0.5 * k, sepBusto: 18 + 0.5 * k,
      tiro: 26 + 0.5 * k, largoPantalon: 102, bajo: 40 + 1 * k, largoCamiseta: 62 + 0.5 * k,
      hombros: 38 + 1 * k, largoManga: 20, brazo: 27 + 1.5 * k,
    };
  }

  // ---------- Renderizado SVG ----------
  const COL = { linea: '#14101F', margen: '#FFD9CF', corte: '#FF4D2E', guia: '#7A6FA6', pinza: '#14101F', texto: '#14101F', doblez: '#6A3DF0' };

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function renderPieza(pz, i, sa, info) {
    const o = [];
    const id = `pz${i}`;
    const bb = pz._bb;
    if (pz.doblez) {
      o.push(`<clipPath id="${id}c" clipPathUnits="userSpaceOnUse"><rect x="0" y="${f(bb.minY - sa - 2)}" width="${f(bb.w + sa * 2 + 4)}" height="${f(bb.h + sa * 2 + 4)}"/></clipPath>`);
    }
    const clip = pz.doblez ? ` clip-path="url(#${id}c)"` : '';
    if (sa > 0) {
      o.push(`<path d="${pz.outline}" fill="${COL.corte}" stroke="${COL.corte}" stroke-width="${f(sa * 2 + 0.08)}" stroke-linejoin="round"${clip}/>`);
      o.push(`<path d="${pz.outline}" fill="${COL.margen}" stroke="${COL.margen}" stroke-width="${f(sa * 2)}" stroke-linejoin="round"${clip}/>`);
    }
    o.push(`<path d="${pz.outline}" fill="#FFFFFF" stroke="${COL.linea}" stroke-width="0.07" stroke-linejoin="round"/>`);

    for (const l of pz.lineas) {
      if (l.tipo === 'guia') {
        o.push(`<path d="${l.d}" fill="none" stroke="${COL.guia}" stroke-width="0.04" stroke-dasharray="0.6 0.4"/>`);
        if (l.texto) o.push(`<text x="${f(l.at.x)}" y="${f(l.at.y - 0.35)}" font-size="0.75" fill="${COL.guia}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${esc(l.texto)}</text>`);
      } else if (l.tipo === 'pinza') {
        o.push(`<path d="${l.d}" fill="none" stroke="${COL.pinza}" stroke-width="0.05" stroke-linejoin="miter"/>`);
      } else {
        o.push(`<path d="${l.d}" fill="none" stroke="${COL.linea}" stroke-width="0.06"/>`);
        if (l.texto) o.push(`<text x="${f(l.at.x)}" y="${f(l.at.y)}" font-size="0.7" fill="${COL.guia}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${esc(l.texto)}</text>`);
      }
    }

    if (pz.doblez) {
      o.push(`<path d="M0 ${f(bb.minY)} L0 ${f(bb.maxY)}" stroke="${COL.doblez}" stroke-width="0.1" stroke-dasharray="1.2 0.4 0.2 0.4"/>`);
      const my = (bb.minY + bb.maxY) / 2;
      o.push(`<text transform="translate(0.9 ${f(my)}) rotate(-90)" font-size="0.9" font-weight="bold" fill="${COL.doblez}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">DOBLEZ DE LA TELA</text>`);
    }

    // Hilo
    const h = pz.hilo;
    if (h) {
      let a, b;
      if (h.x === null) { a = P(h.x1, h.y); b = P(h.x2, h.y); }
      else { a = P(h.x, h.y1); b = P(h.x, h.y2); }
      if (dist(a, b) > 3) {
        o.push(`<path d="${seg(a, b)}" stroke="${COL.linea}" stroke-width="0.06"/>`);
        // puntas de flecha dibujadas como triángulos (más compatibles que los markers)
        const len = dist(a, b), u = P((b.x - a.x) / len, (b.y - a.y) / len), n = P(-u.y, u.x);
        for (const [tip, s] of [[a, 1], [b, -1]]) {
          const base = P(tip.x + u.x * 0.7 * s, tip.y + u.y * 0.7 * s);
          o.push(`<path d="M${f(tip.x)} ${f(tip.y)} L${f(base.x + n.x * 0.3)} ${f(base.y + n.y * 0.3)} L${f(base.x - n.x * 0.3)} ${f(base.y - n.y * 0.3)} Z" fill="${COL.linea}"/>`);
        }
        const mid = lerp(a, b, 0.5);
        const rot = h.x === null ? 0 : -90;
        o.push(`<text transform="translate(${f(mid.x - (rot ? 0.35 : 0))} ${f(mid.y - (rot ? 0 : 0.35))}) rotate(${rot})" font-size="0.65" fill="${COL.texto}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">HILO</text>`);
      }
    }

    // Etiqueta
    const e = pz.etiqueta;
    const s = pz.compacta ? 0.8 : 1.15;
    o.push(`<g font-family="Helvetica, Arial, sans-serif" fill="${COL.texto}" text-anchor="middle">`);
    o.push(`<text x="${f(e.x)}" y="${f(e.y)}" font-size="${f(s)}" font-weight="bold">${esc(pz.nombre)}</text>`);
    o.push(`<text x="${f(e.x)}" y="${f(e.y + s * 1.2)}" font-size="${f(s * 0.75)}" fill="${COL.corte}" font-weight="bold">${esc(pz.corte)}</text>`);
    if (!pz.compacta) o.push(`<text x="${f(e.x)}" y="${f(e.y + s * 2.2)}" font-size="${f(s * 0.55)}" fill="${COL.guia}">${esc(info)}</text>`);
    o.push('</g>');
    return o.join('');
  }

  /**
   * Genera el SVG completo a escala 1:1 (unidades en cm).
   * Devuelve { svg, inner, width, height }
   */
  function generar(prendaId, medidas, opts = {}) {
    const prenda = PRENDAS[prendaId];
    const sa = opts.margen || 0;
    const res = prenda.trazar(medidas);
    const gap = 3 + sa * 2;
    const maxRow = opts.anchoMax || 110;

    for (const pz of res.piezas) pz._bb = bbox(pz.outline.pts);

    // Cuadro de control de 10 cm
    const header = 14;
    let x = 2, y = header, rowH = 0, totalW = 0;
    const placed = [];
    for (const pz of res.piezas) {
      const bb = pz._bb;
      const w = bb.w + sa * 2, hgt = bb.h + sa * 2;
      if (x > 2 && x + w > maxRow) { x = 2; y += rowH + gap; rowH = 0; }
      placed.push({ pz, tx: x + sa - bb.minX, ty: y + sa - bb.minY });
      x += w + gap;
      rowH = Math.max(rowH, hgt);
      totalW = Math.max(totalW, x - gap);
    }
    const width = Math.max(totalW + 2, 40);
    const height = y + rowH + 2;

    const fecha = new Date().toLocaleDateString('es-ES');
    const info = `Percha · ${prenda.nombre} · ${fecha}`;
    const g = [];
    g.push(`<rect x="0" y="0" width="${f(width)}" height="${f(height)}" fill="#FFFFFF"/>`);
    // Cabecera
    g.push(`<rect x="2" y="2" width="10" height="10" fill="none" stroke="${COL.linea}" stroke-width="0.06"/>`);
    g.push(`<path d="M2 7 L12 7 M7 2 L7 12" stroke="${COL.guia}" stroke-width="0.03" stroke-dasharray="0.3 0.3"/>`);
    g.push(`<text x="7" y="6.4" font-size="0.75" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" fill="${COL.texto}">10 × 10 cm</text>`);
    g.push(`<text x="7" y="8.1" font-size="0.5" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" fill="${COL.guia}">Comprueba la escala</text>`);
    g.push(`<g font-family="Helvetica, Arial, sans-serif" fill="${COL.texto}">`);
    g.push(`<text x="14" y="4.4" font-size="1.6" font-weight="bold">percha<tspan fill="${COL.corte}">.</tspan></text>`);
    g.push(`<text x="14" y="6.4" font-size="0.85">${esc(prenda.nombre)} · ${esc(prenda.resumen)}</text>`);
    const med = prenda.medidas.map((k) => `${MEDIDAS[k].label}: ${medidas[k]} cm`);
    for (let i = 0; i < med.length; i += 3) {
      g.push(`<text x="14" y="${f(7.8 + (i / 3) * 0.8)}" font-size="0.55" fill="${COL.guia}">${esc(med.slice(i, i + 3).join(' · '))}</text>`);
    }
    g.push(`<text x="14" y="${f(8.1 + Math.ceil(med.length / 3) * 0.8)}" font-size="0.55" fill="${COL.corte}">${sa > 0 ? `Margen de costura incluido: ${String(sa).replace('.', ',')} cm (zona coral). Cortar por la línea exterior.` : 'Sin margen de costura: añádelo al cortar la tela.'}</text>`);
    g.push('</g>');

    placed.forEach((p, i) => {
      g.push(`<g transform="translate(${f(p.tx)} ${f(p.ty)})">${renderPieza(p.pz, i, sa, info)}</g>`);
    });

    const inner = g.join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}cm" height="${f(height)}cm" viewBox="0 0 ${f(width)} ${f(height)}">${inner}</svg>`;
    return { svg, inner, width, height, notas: res.notas, piezas: res.piezas.length };
  }

  global.Percha = { PRENDAS, MEDIDAS, tallaBase, generar, _internals: { cubicLen } };
})(typeof window !== 'undefined' ? window : globalThis);
