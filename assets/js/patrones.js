/*
 * Percha · motor de patronaje
 * Todas las coordenadas están en centímetros. El eje Y crece hacia abajo.
 * Cada función de trazado recibe un objeto de medidas y devuelve una lista de piezas.
 */
(function (global) {
  'use strict';

  // ---------- Traducción ----------
  // Usa PerchaI18n si está cargado; si no, devuelve la clave.
  const tr = (k, p) => (global.PerchaI18n ? global.PerchaI18n.t(k, p) : k);
  const fmtN = (v) => (global.PerchaI18n ? global.PerchaI18n.num(v) : (Math.round(v * 10) / 10).toString());

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
    constructor() { this.d = []; this.pts = []; this.cur = null; this.len = 0; this.segs = []; }
    M(p) { this.d.push(`M${f(p.x)} ${f(p.y)}`); this.pts.push(p); this.cur = p; return this; }
    L(p) {
      this.segs.push({ from: this.cur, d: `L${f(p.x)} ${f(p.y)}` });
      this.d.push(`L${f(p.x)} ${f(p.y)}`); this.pts.push(p); this.len += dist(this.cur, p); this.cur = p; return this;
    }
    C(c1, c2, p) {
      this.segs.push({ from: this.cur, d: `C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p.x)} ${f(p.y)}` });
      this.d.push(`C${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p.x)} ${f(p.y)}`);
      for (let i = 1; i <= 12; i++) this.pts.push(cubicAt(this.cur, c1, c2, p, i / 12));
      this.len += cubicLen(this.cur, c1, c2, p);
      this.cur = p;
      return this;
    }
    Z() { this.d.push('Z'); return this; }
    toString() { return this.d.join(' '); }
    // Trazado abierto con los tramos i..j del contorno (L/C en orden de dibujo)
    tramo(i, j = i) {
      const a = this.segs[i].from;
      return `M${f(a.x)} ${f(a.y)} ` + this.segs.slice(i, j + 1).map((s) => s.d).join(' ');
    }
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
    const ventH = clamp(L * 0.35, 12, 24);
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

      const lineas = [guide(P(0, hh), P(w, hh), tr('p.hipLine')), guide(P(0, L - 4), P(w, L - 4), tr('p.hem'))];
      const waistY = (x) => cbY + (st.y - cbY) * Math.pow(x / st.x, 2);
      for (let i = 1; i <= n; i++) {
        const x = (st.x * i) / (n + 1);
        const half = pz / n / 2;
        const len = (isF ? 9 : 13) - (i - 1) * 1.5;
        lineas.push(dart(P(x - half, waistY(x - half)), P(x, cbY + len), P(x + half, waistY(x + half))));
      }
      if (!isF) {
        lineas.push(notch(P(0, 20), P(1, 0)));
        lineas.push({ d: seg(P(0.8, 20), P(3.5, 20)), tipo: 'guia', texto: tr('p.zipEnd'), at: P(2.2, 19.4) });
        const ventTop = L - ventH;
        lineas.push({ d: seg(P(0, ventTop), P(0, L)), tipo: 'guia', texto: tr('p.vent'), at: P(1.6, ventTop + 3) });
        lineas.push(notch(P(0, ventTop), P(1, 0)));
      }
      const pasos = isF
        ? [{ n: 1, x: w * 0.5, y: cbY + 5 }, { n: 2, x: w, y: (hh + L) / 2 }, { n: 6, x: w * 0.5, y: L - 2 }]
        : [{ n: 1, x: w * 0.5, y: cbY + 5 }, { n: 2, x: w, y: (hh + L) / 2 }, { n: 3, x: 0, y: 10 }, { n: 4, x: 0, y: L - ventH / 2 }, { n: 6, x: w * 0.5, y: L - 2 }];
      piezas.push({
        nombre: isF ? tr('p.skirtFront') : tr('p.skirtBack'),
        corte: isF ? tr('p.cutFold') : tr('p.cut2'),
        doblez: isF,
        outline: path,
        lineas,
        union: isF ? null : { d: seg(top, P(0, L)), texto: tr('p.joinPair'), at: P(1.3, hh + (L - ventH - hh) / 2), rot: 90 },
        pasos,
        hilo: { x: w * 0.55, y1: hh + 4, y2: L - 6 },
        etiqueta: P(w * 0.5, hh + (L - hh) * 0.35),
      });
      if (pz > 0) notas.push(tr(isF ? 'n.dartsFront' : 'n.dartsBack', { n, w: fmtN(pz / n) }));
    }

    const cl = W + 1 + 3;
    const cint = new Path().M(P(0, 0)).L(P(cl, 0)).L(P(cl, 8)).L(P(0, 8)).Z();
    piezas.push({
      nombre: tr('p.waistband'),
      corte: tr('p.cut1'),
      doblez: false,
      outline: cint,
      lineas: [guide(P(0, 4), P(cl, 4), tr('p.foldHere')), { d: seg(P(cl - 3, 0), P(cl - 3, 8)), tipo: 'guia', texto: tr('p.overlap'), at: P(cl - 1.5, 2) }],
      pasos: [{ n: 5, x: cl / 2, y: 4 }],
      hilo: { x: null, y: 6, x1: 4, x2: Math.min(cl - 6, 30) },
      etiqueta: P(Math.min(cl / 2, 22), 2),
      compacta: true,
    });

    // Vista de la abertura trasera (para rematar el martillo)
    {
      const vv = new Path().M(P(0, 0)).L(P(6, 0)).L(P(6, ventH)).L(P(0, ventH)).Z();
      piezas.push({
        nombre: tr('p.ventFacing'), corte: tr('p.cut2'), doblez: false, outline: vv,
        lineas: [guide(P(0, 0), P(0, ventH), tr('p.vent'))],
        pasos: [{ n: 4, x: 3, y: ventH / 2 }],
        hilo: { x: 3, y1: 2, y2: ventH - 2 }, etiqueta: P(3, ventH / 2 - 1), compacta: true,
      });
    }

    return {
      piezas,
      notas: [
        tr('n.skirtEase'),
        ...notas,
        tr('n.zip'),
        tr('n.skirtVent', { v: fmtN(ventH) }),
        tr('n.hem', { v: fmtN(4) }),
        tr('n.mirror'),
        tr('n.joinPair'),
        tr('n.saEdges'),
        tr('n.sewFalda'),
      ],
    };
  }

  // ---------- Cuerpo básico (delantero y espalda) ----------
  function cuerpo(m) {
    const B = m.pecho, W = m.cintura, te = m.talleEsp, td = m.talleDel, ae = m.anchoEsp,
      sh = m.hombro, N = m.cuello, ab = m.altBusto, sb = m.sepBusto, Lm = m.largoManga, Bi = m.brazo;
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
      .L(spB);
    const beforeB = back.len;
    back
      .C(P(spB.x - 0.3, spB.y + 3), P(bwp.x, bwp.y - 3), bwp)
      .C(P(bwp.x, bwp.y + (sisa - bwp.y) * 0.6), P(bwp.x + (bw - bwp.x) * 0.3, sisa), uaB);
    const armB = back.len - beforeB;
    back
      .L(wsB)
      .L(P(0, te))
      .Z();
    const dxB = ae / 4 + 1;
    const linB = [guide(P(0, sisa), P(bw, sisa), tr('p.armLine'))];
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
      .L(spF);
    const beforeF = front.len;
    front
      .C(P(spF.x - 0.5, spF.y + 3), P(fwp.x, fwp.y - 3), fwp)
      .C(P(fwp.x, fwp.y + (uaY - fwp.y) * 0.55), P(fwp.x + (fw - fwp.x) * 0.35, uaY), uaF);
    const armF = front.len - beforeF;
    front
      .L(wsF)
      .L(P(0, td))
      .Z();

    const linF = [guide(P(0, uaY), P(fw, uaY), tr('p.armLine'))];
    // Pinza de costado: absorbe la diferencia de largo por el busto
    const dSide = clamp(td - (te + 2), 0, 6);
    if (dSide >= 0.5) {
      const a = onLineAtY(uaF, wsF, uaY + 5);
      const b = onLineAtY(uaF, wsF, uaY + 5 + dSide);
      const mid = lerp(a, b, 0.5);
      const v = P(mid.x - bp.x, mid.y - bp.y), n = Math.hypot(v.x, v.y) || 1;
      const tip = P(bp.x + (v.x / n) * 2.5, bp.y + (v.y / n) * 2.5);
      linF.push(dart(a, tip, b));
      notas.push(tr('n.sideDart', { v: fmtN(dSide) }));
    }
    if (pzF > 0.3) linF.push(dart(P(bp.x - pzF / 2, td), P(bp.x, bp.y + 2.5), P(bp.x + pzF / 2, td)));
    linF.push({ d: `M${f(bp.x - 0.4)} ${f(bp.y)} L${f(bp.x + 0.4)} ${f(bp.y)} M${f(bp.x)} ${f(bp.y - 0.4)} L${f(bp.x)} ${f(bp.y + 0.4)}`, tipo: 'piquete', texto: tr('p.bustPoint'), at: P(bp.x + 2.2, bp.y - 0.6) });

    // Manga base de tejido plano: copa ajustada a la sisa (+2 cm de embebido)
    const piezasCuerpo = [
      {
        nombre: tr('p.bodiceBack'), corte: tr('p.cutFold'), doblez: true, outline: back, lineas: linB,
        pasos: [{ n: 1, x: dxB, y: te - 5 }, { n: 2, x: spB.x, y: spB.y }, { n: 3, x: (bw + wsB.x) / 2, y: (sisa + te) / 2 }],
        hilo: { x: bw * 0.6, y1: sisa + 3, y2: te - 4 }, etiqueta: P(bw * 0.45, sisa - 5),
      },
      {
        nombre: tr('p.bodiceFront'), corte: tr('p.cutFold'), doblez: true, outline: front, lineas: linF,
        pasos: [{ n: 1, x: bp.x, y: td - 5 }, { n: 2, x: spF.x, y: spF.y }, { n: 3, x: (uaF.x + wsF.x) / 2, y: (uaY + td) / 2 }, { n: 5, x: fw * 0.3, y: td - 1.5 }],
        hilo: { x: fw * 0.72, y1: uaY + 9, y2: td - 3 }, etiqueta: P(fw * 0.45, uaY - 5),
      },
    ];
    {
      const sw = (Bi + 8) / 2;
      const target = armB + armF + 2;
      const capLenB = (hh) => 2 * cubicLen(P(0, hh), P(sw * 0.3, hh), P(sw * 0.6, 0), P(sw, 0));
      let loB = 2, hiB = 25;
      for (let i = 0; i < 40; i++) {
        const mid = (loB + hiB) / 2;
        if (capLenB(mid) < target) loB = mid; else hiB = mid;
      }
      const capH = (loB + hiB) / 2;
      const hemYB = Math.max(Lm, capH + 3);
      const codoY = (capH + hemYB) / 2;
      const sleeveB = new Path()
        .M(P(0, capH))
        .C(P(sw * 0.3, capH), P(sw * 0.6, 0), P(sw, 0))
        .C(P(sw * 1.4, 0), P(sw * 1.7, capH), P(2 * sw, capH))
        .L(P(2 * sw - 2, hemYB))
        .L(P(2, hemYB))
        .Z();
      piezasCuerpo.push({
        nombre: tr('p.bodiceSleeve'), corte: tr('p.cut2'), doblez: false, outline: sleeveB,
        lineas: [
          guide(P(0, capH), P(2 * sw, capH), tr('p.bicep')),
          { d: seg(P(2, codoY), P(2 * sw - 2, codoY)), tipo: 'guia' },
          guide(P(2, hemYB - 2), P(2 * sw - 2, hemYB - 2), tr('p.hem')),
          notch(P(sw, 0), P(0, 1)),
        ],
        pasos: [{ n: 4, x: sw, y: 2 }],
        hilo: { x: sw, y1: capH + 1.5, y2: hemYB - 1.5 }, etiqueta: P(sw, capH - 3.5),
      });
      notas.push(tr('n.bodiceSleeve', { v: fmtN(capH) }), tr('n.hem', { v: fmtN(2) }));
    }

    return {
      piezas: piezasCuerpo,
      notas: [
        tr('n.bodiceEase'),
        tr('n.armDepth', { v: fmtN(sisa) }),
        ...notas,
        pzF > 0.3 ? tr('n.frontDart', { v: fmtN(pzF) }) : tr('n.noFrontDart'),
        pzB > 0.3 ? tr('n.backDart', { v: fmtN(pzB) }) : tr('n.noBackDart'),
        tr('n.mirror'),
        tr('n.saEdges'),
        tr('n.sewCuerpo'),
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
      const flyL0 = clamp(T * 0.65, 15, 20);
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
        guide(P(0, yh), P(fw, yh), tr('p.hip')),
        guide(P(0, T), P(tip.x, T), tr('p.crotch')),
        guide(kOut, kIn, tr('p.knee')),
        guide(cf, P(cf.x, clamp(T * 0.65, 15, 20)), tr('p.fly')),
        guide(P(hOut.x, L - 4), P(hIn.x, L - 4), tr('p.hem')),
        { d: `M${f(0)} 3 C3 5 5 9 6 15`, tipo: 'guia', texto: tr('p.pocket'), at: P(7.5, 10) },
        notch(P(0, 3), P(1, 0.3)),
        notch(P(6, 15), P(0.5, 1)),
      ];
      if (pz > 0.3) lineas.push(dart(P(xc - pz / 2, 0), P(xc, 9), P(xc + pz / 2, 0)));
      piezas.push({
        nombre: tr('p.pantsFront'), corte: tr('p.cut2'), doblez: false, outline: path, lineas,
        union: {
          d: path.tramo(1, 2),
          texto: tr('p.joinPair'), at: P(fw - 1.6, flyL0 + (yh - flyL0) / 2 + 4), rot: 87,
        },
        pasos: [
          { n: 1, x: xc, y: 4 }, { n: 2, x: 3, y: 9 }, { n: 3, x: cf.x, y: flyL0 / 2 },
          { n: 4, x: (tip.x + hIn.x) / 2 - 1.5, y: (T + L) / 2 }, { n: 5, x: hOut.x + 2, y: (T + L) / 2 },
          { n: 7, x: xc, y: L - 2 },
        ],
        hilo: { x: xc, y1: T + 12, y2: L - 6 }, etiqueta: P(xc, T + 6),
      });
      notas.push(tr('n.pantsFront', { w: fmtN(fw), e: fmtN(ext) }));
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
        guide(P(0, yh), P(bw, yh), tr('p.hip')),
        guide(P(0, T), P(tip.x, T), tr('p.crotch')),
        guide(kOut, kIn, tr('p.knee')),
        guide(P(hOut.x, L - 4), P(hIn.x, L - 4), tr('p.hem')),
      ];
      // Bolsillo trasero de ojal: abertura inclinada sobre la pala
      const ojalL = clamp(H * 0.14, 12, 16);
      const yOjal = Math.min(11, yh - 2);
      const xcOjal = bw * 0.45;
      const ojalA = P(xcOjal - ojalL / 2, yOjal + 1), ojalB = P(xcOjal + ojalL / 2, yOjal);
      lineas.push({ d: seg(ojalA, ojalB), tipo: 'guia', texto: tr('p.backPocket'), at: P(xcOjal, yOjal - 0.6) });
      lineas.push(notch(ojalA, P(-1, 0.3)));
      lineas.push(notch(ojalB, P(1, -0.3)));
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
        notas.push(tr('n.pantsBack', { n, w: fmtN(pz / n) }));
      }
      piezas.push({
        nombre: tr('p.pantsBack'), corte: tr('p.cut2'), doblez: false, outline: path, lineas,
        union: {
          d: path.tramo(1, 2),
          texto: tr('p.joinPair'), at: P((cb.x + bw) / 2 - 1.4, yh * 0.62), rot: 75,
        },
        pasos: [
          { n: 1, x: (st.x + cb.x) / 2, y: 4 }, { n: 2, x: xcOjal, y: yOjal },
          { n: 4, x: (tip.x + hIn.x) / 2 - 1.5, y: (T + L) / 2 }, { n: 5, x: hOut.x + 2, y: (T + L) / 2 },
          { n: 7, x: xc, y: L - 2 },
        ],
        hilo: { x: xc, y1: T + 12, y2: L - 6 }, etiqueta: P(xc, T + 6.5),
      });
    }

    const cl = W + 2 + 3;
    piezas.push({
      nombre: tr('p.waistband'), corte: tr('p.cut1'), doblez: false,
      outline: new Path().M(P(0, 0)).L(P(cl, 0)).L(P(cl, 8)).L(P(0, 8)).Z(),
      lineas: [guide(P(0, 4), P(cl, 4), tr('p.foldHere'))],
      pasos: [{ n: 6, x: cl / 2, y: 4 }],
      hilo: { x: null, y: 6, x1: 4, x2: Math.min(cl - 6, 30) },
      etiqueta: P(Math.min(cl / 2, 22), 2), compacta: true,
    });

    // Vista y tapeta de la bragueta (rectas; la cremallera va en el delantero izquierdo)
    {
      const flyL = clamp(T * 0.65, 15, 20);
      const vista = new Path().M(P(0, 0)).L(P(4.5, 0)).L(P(4.5, flyL)).L(P(0, flyL)).Z();
      piezas.push({
        nombre: tr('p.flyFace'), corte: tr('p.cut1'), doblez: false, outline: vista,
        lineas: [guide(P(0, 0), P(0, flyL), tr('p.fly'))],
        pasos: [{ n: 3, x: 2.2, y: flyL / 2 }],
        hilo: { x: 2.2, y1: 2, y2: flyL - 2 }, etiqueta: P(2.2, flyL / 2 - 1), compacta: true,
      });
      const tap = new Path().M(P(0, 0)).L(P(5, 0)).L(P(5, flyL)).L(P(0, flyL)).Z();
      piezas.push({
        nombre: tr('p.flyUnder'), corte: tr('p.cut1'), doblez: false, outline: tap,
        lineas: [],
        pasos: [{ n: 3, x: 2.5, y: flyL / 2 }],
        hilo: { x: 2.5, y1: 2, y2: flyL - 2 }, etiqueta: P(2.5, flyL / 2 - 1), compacta: true,
      });
      notas.push(tr('n.pantsFly', { v: fmtN(flyL) }));
    }

    // Bolsillo lateral (fondo) y tira para trabillas: piezas opcionales
    {
      const bag = new Path()
        .M(P(0, 0)).L(P(15, 0))
        .C(P(17, 6), P(16, 14), P(11, 18))
        .C(P(7, 21), P(3, 21), P(0, 19))
        .Z();
      piezas.push({
        nombre: tr('p.pocket'), corte: tr('p.cut4'), doblez: false, outline: bag,
        lineas: [
          guide(P(0, 3), P(6, 15), tr('p.pocket')),
          notch(P(0, 3), P(1, 0.3)),
          notch(P(6, 15), P(0.5, 1)),
        ],
        pasos: [{ n: 2, x: 7, y: 10 }],
        hilo: { x: 7, y1: 3, y2: 18 }, etiqueta: P(7.5, 9), compacta: true,
      });
      const strip = new Path().M(P(0, 0)).L(P(15, 0)).L(P(15, 9)).L(P(0, 9)).Z();
      const cutLines = [3, 6, 9, 12].map((x) => ({ d: seg(P(x, 0), P(x, 9)), tipo: 'corte' }));
      piezas.push({
        nombre: tr('p.loops'), corte: tr('p.cut1'), doblez: false, outline: strip,
        lineas: cutLines,
        pasos: [{ n: 6, x: 7.5, y: 4.5 }],
        hilo: { x: null, y: 7, x1: 2, x2: 13 }, etiqueta: P(7.5, 2.5), compacta: true,
      });
      notas.push(tr('n.pockets'), tr('n.loops'));
    }

    // Bolsillo trasero de ojal: vivo doblado + fondo propio
    {
      const ojalL2 = clamp(H * 0.14, 12, 16);
      const vivo = new Path().M(P(0, 0)).L(P(ojalL2 + 2, 0)).L(P(ojalL2 + 2, 6)).L(P(0, 6)).Z();
      piezas.push({
        nombre: tr('p.welt'), corte: tr('p.cut2'), doblez: false, outline: vivo,
        lineas: [guide(P(0, 3), P(ojalL2 + 2, 3), tr('p.foldHere'))],
        pasos: [{ n: 2, x: (ojalL2 + 2) / 2, y: 3 }],
        hilo: { x: null, y: 4.5, x1: 2, x2: ojalL2 }, etiqueta: P((ojalL2 + 2) / 2, 1.2), compacta: true,
      });
      const bw2 = ojalL2 + 3, bh2 = 18;
      const fondoT = new Path()
        .M(P(0, 0)).L(P(bw2, 0)).L(P(bw2, 13))
        .C(P(bw2, 17), P(bw2 - 4, bh2), P(bw2 - 6, bh2))
        .L(P(6, bh2))
        .C(P(4, bh2), P(0, 17), P(0, 13))
        .Z();
      piezas.push({
        nombre: tr('p.backBag'), corte: tr('p.cut4'), doblez: false, outline: fondoT,
        lineas: [
          guide(P(2, 1.5), P(bw2 - 2, 1.5), tr('p.backPocket')),
          notch(P(2, 1.5), P(0, -1)),
          notch(P(bw2 - 2, 1.5), P(0, -1)),
        ],
        pasos: [{ n: 2, x: bw2 / 2, y: 9 }],
        hilo: { x: bw2 / 2, y1: 3, y2: bh2 - 2 }, etiqueta: P(bw2 / 2, 7), compacta: true,
      });
      notas.push(tr('n.backPockets', { v: fmtN(ojalL2) }));
    }

    return {
      piezas,
      notas: [tr('n.pantsEase'), ...notas, tr('n.hem', { v: fmtN(4) }), tr('n.mirror'), tr('n.joinPair'), tr('n.saEdges'), tr('n.sewPantalon'), tr('n.crease')],
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
      const pasosT = lado === 'esp'
        ? [{ n: 1, x: sp.x, y: sp.y + 1 }, { n: 4, x: w, y: (sisa + Lt) / 2 }, { n: 5, x: w * 0.5, y: Lt - 1.5 }]
        : [{ n: 1, x: sp.x, y: sp.y + 1 }, { n: 2, x: nw / 2, y: nd / 2 }, { n: 4, x: w, y: (sisa + Lt) / 2 }, { n: 5, x: w * 0.5, y: Lt - 1.5 }];
      piezas.push({
        nombre: lado === 'esp' ? tr('p.teeBack') : tr('p.teeFront'),
        corte: tr('p.cutFold'), doblez: true, outline: path,
        lineas: [guide(P(0, sisa), P(w, sisa), tr('p.armLine')), guide(P(0, Lt - 2.5), P(w, Lt - 2.5), tr('p.hem'))],
        pasos: pasosT,
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
      nombre: tr('p.teeSleeve'), corte: tr('p.cut2'), doblez: false, outline: sleeve,
      lineas: [guide(P(0, h), P(2 * sw, h), tr('p.bicep')), guide(P(2, hemY - 2.5), P(2 * sw - 2, hemY - 2.5), tr('p.hem')), notch(P(sw, 0), P(0, 1))],
      pasos: [{ n: 3, x: sw, y: 2 }],
      hilo: { x: sw, y1: h + 1.5, y2: hemY - 1.5 }, etiqueta: P(sw, h - 3.5),
    });

    // Tira de cuello: 85 % del contorno del escote, 4 cm de ancho para doblar
    let bandNote = '';
    {
      const ndF = N / 6 + 2;
      const frontNeck = cubicLen(P(0, ndF), P(nw * 0.55, ndF), P(nw, ndF * 0.5), P(nw, 0));
      const backNeck = cubicLen(P(0, 0), P(nw * 0.55, 0), P(nw, -0.8), P(nw, -2));
      const bandL = Math.max((frontNeck + backNeck) * 2 * 0.85, 20);
      const band = new Path().M(P(0, 0)).L(P(bandL, 0)).L(P(bandL, 4)).L(P(0, 4)).Z();
      piezas.push({
        nombre: tr('p.neckband'), corte: tr('p.cut1'), doblez: false, outline: band,
        lineas: [guide(P(0, 2), P(bandL, 2), tr('p.foldHere'))],
        pasos: [{ n: 2, x: bandL / 2, y: 2 }],
        hilo: { x: null, y: 3, x1: 4, x2: Math.min(bandL - 4, 40) },
        etiqueta: P(Math.min(bandL / 2, 25), 1.2), compacta: true,
      });
      bandNote = tr('n.teeBand', { v: fmtN(bandL) });
    }

    return {
      piezas,
      notas: [
        tr('n.teeEase'),
        tr('n.armhole', { v: fmtN(arm) }),
        tr('n.cap', { v: fmtN(h) }),
        bandNote,
        tr('n.hem', { v: fmtN(2.5) }),
        tr('n.mirror'),
        tr('n.saEdges'),
        tr('n.sewCamiseta'),
        tr('n.knit'),
      ],
    };
  }

  // ---------- Bóxer (delantero, trasero y cintura elástica) ----------
  function boxer(m) {
    const W = m.cintura, H = m.cadera, T = m.tiro, Th = m.muslo;
    const L = Math.max(m.largoBoxer, T + 5);
    const yh = (T * 2) / 3;
    const pouch = clamp(H / 40, 2, 3.5);
    // En tejido plano la cintura tiene que pasar por la cadera: se corta
    // con la cadera + 6 cm (o la cintura + 8 si es mayor) y la goma la recoge.
    const ww = Math.max(W + 8, H + 6) / 4;
    const piezas = [];

    // Delantero (costado en x=0, centro delante a la derecha, con suplemento)
    {
      const hw = (H + 12) / 4;
      const ext = H / 20;
      const php = P(hw + pouch * 0.5, yh);
      const xc = (hw + ext) / 2;
      const hemHalf = (Th + 6) / 4;
      const st = P(0, 0), cf = P(ww, 0);
      const tip = P(hw + ext + pouch * 0.3, T);
      const hIn = P(xc + hemHalf, L), hOut = P(xc - hemHalf, L);
      const flyEnd = P(ww + pouch * 0.8, 14);
      const path = new Path()
        .M(st).L(cf)
        .C(P(cf.x + pouch, 5), P(hw + pouch, 10), php)
        .C(P(hw + pouch * 0.5, yh + (T - yh) * 0.6), P(hw + ext * 0.35 + pouch * 0.3, T), tip)
        .C(P(tip.x - 0.6, T + 2), P(hIn.x + 0.3, L - 6), hIn)
        .L(hOut)
        .C(P(hOut.x - 0.3, (L + yh) / 2), P(0, T + 2), P(0, yh))
        .C(P(0, yh * 0.45), P(st.x * 0.6, 0.4), st)
        .Z();
      const flyD = `M${f(cf.x)} ${f(cf.y)} C${f(cf.x + pouch)} 5 ${f(ww + pouch)} 10 ${f(flyEnd.x)} ${f(flyEnd.y)}`;
      const lineas = [
        guide(P(0, yh), php, tr('p.hip')),
        guide(P(0, T), P(tip.x, T), tr('p.crotch')),
        guide(P(0, 3), P(cf.x, 3), tr('p.casing')),
        { d: flyD, tipo: 'guia', texto: tr('p.fly'), at: P(flyEnd.x + 0.4, 10) },
        guide(P(hOut.x, L - 2), P(hIn.x, L - 2), tr('p.hem')),
        { d: seg(hOut, hIn), tipo: 'guia' },
        notch(tip, P(-1, 1)),
      ];
      piezas.push({
        nombre: tr('p.boxerFront'), corte: tr('p.cut2'), doblez: false, outline: path, lineas,
        eje: cf.x,
        union: { d: path.tramo(1, 2), texto: tr('p.joinPair'), at: P(hw + pouch * 0.5 - 1.3, yh + (T - yh) * 0.2), rot: 90 },
        // Tramos del contorno: 0 cintura, 1-2 centro, 3 entrepierna, 4 bajo, 5-6 costado
        bordes: {
          cintura: path.tramo(0), centro: path.tramo(1, 2), bragueta: flyD,
          entrepierna: path.tramo(3), bajo: path.tramo(4), costado: path.tramo(5, 6),
        },
        pasos: [
          { n: 1, x: flyEnd.x, y: 10 }, { n: 2, x: cf.x + 1, y: 7 },
          { n: 3, x: (tip.x + hIn.x) / 2 - 1.5, y: (T + L) / 2 }, { n: 4, x: hOut.x + 2, y: (T + L) / 2 },
          { n: 6, x: xc - 1, y: L - 1.5 },
        ],
        hilo: { x: xc, y1: 8, y2: L - 4 }, etiqueta: P(xc - 1, (T + L) / 2),
      });

      // Vista y tapeta de la bragueta, con el borde interior curvado como el delantero
      const flyL = 14;
      const vista = new Path().M(P(0, 0)).L(P(4, 0)).L(P(4, flyL)).L(P(0, flyL))
        .C(P(pouch * 0.4, 10), P(pouch * 0.4, 4), P(0, 0)).Z();
      piezas.push({
        nombre: tr('p.flyFace'), corte: tr('p.cut1'), doblez: false, outline: vista,
        lineas: [guide(P(0, 0), P(0, flyL), tr('p.fly'))],
        bordes: { bragueta: vista.tramo(3) },
        pasos: [{ n: 1, x: 2, y: 7 }],
        hilo: { x: 2, y1: 2, y2: flyL - 2 }, etiqueta: P(2, flyL / 2 - 1), compacta: true,
      });
      const tap = new Path().M(P(0, 0)).L(P(6, 0)).L(P(6, flyL)).L(P(0, flyL))
        .C(P(pouch * 0.5, 10), P(pouch * 0.5, 4), P(0, 0)).Z();
      piezas.push({
        nombre: tr('p.flyUnder'), corte: tr('p.cut1'), doblez: false, outline: tap,
        lineas: [],
        bordes: { bragueta: tap.tramo(3) },
        pasos: [{ n: 1, x: 3, y: 7 }],
        hilo: { x: 3, y1: 2, y2: flyL - 2 }, etiqueta: P(3, flyL / 2 - 1), compacta: true,
      });
    }

    // Trasero (más cruce de tiro y pernera más ancha)
    {
      const hw = (H + 12) / 4 + 1;
      const ext = H / 10;
      const xc = (hw + ext) / 2;
      const hemHalf = (Th + 6) / 4 + 1;
      // El centro trasero sube 3 cm (como en el pantalón) para dar largo de tiro al sentarse
      const st = P(0, 0), cb = P(ww, -3);
      const tip = P(hw + ext, T + 1);
      const hIn = P(xc + hemHalf, L), hOut = P(xc - hemHalf, L);
      const path = new Path()
        .M(st).L(cb).L(P(hw, yh))
        .C(P(hw + 0.3, yh + (T + 1 - yh) * 0.65), P(hw + ext * 0.45, T + 1), tip)
        .C(P(tip.x - 1, T + 3), P(hIn.x + 0.3, L - 6), hIn)
        .L(hOut)
        .C(P(hOut.x - 0.3, (L + yh) / 2), P(0, T + 3), P(0, yh))
        .C(P(0, yh * 0.45), P(st.x * 0.6, 0.4), st)
        .Z();
      const lineas = [
        guide(P(0, yh), P(hw, yh), tr('p.hip')),
        guide(P(0, T), P(tip.x, T), tr('p.crotch')),
        guide(P(0, 3), P(cb.x, cb.y + 3), tr('p.casing')),
        guide(P(hOut.x, L - 2), P(hIn.x, L - 2), tr('p.hem')),
        { d: seg(hOut, hIn), tipo: 'guia' },
        notch(tip, P(-1, 1)),
      ];
      piezas.push({
        nombre: tr('p.boxerBack'), corte: tr('p.cut2'), doblez: false, outline: path, lineas,
        eje: cb.x,
        union: { d: path.tramo(1, 2), texto: tr('p.joinPair'), at: P((cb.x + hw) / 2 - 1.2, yh * 0.5), rot: 64 },
        bordes: {
          cintura: path.tramo(0), centro: path.tramo(1, 2),
          entrepierna: path.tramo(3), bajo: path.tramo(4), costado: path.tramo(5, 6),
        },
        pasos: [
          { n: 2, x: cb.x - 1, y: 7 },
          { n: 3, x: (tip.x + hIn.x) / 2 - 1.5, y: (T + L) / 2 }, { n: 4, x: hOut.x + 2, y: (T + L) / 2 },
          { n: 6, x: xc, y: L - 1.5 },
        ],
        hilo: { x: xc, y1: 8, y2: L - 4 }, etiqueta: P(xc, (T + L) / 2),
      });
    }

    // Tira para la jareta de la goma: mide lo mismo que la cintura de la prenda
    const cl = 2 * (ww + Math.hypot(ww, 3));
    const tira = new Path().M(P(0, 0)).L(P(cl, 0)).L(P(cl, 7)).L(P(0, 7)).Z();
    piezas.push({
      nombre: tr('p.elastic'), corte: tr('p.cut1'), doblez: false,
      outline: tira,
      lineas: [guide(P(0, 3.5), P(cl, 3.5), tr('p.foldHere'))],
      bordes: { cintura: tira.tramo(2) },
      pasos: [{ n: 5, x: cl / 2, y: 3.5 }],
      hilo: { x: null, y: 5.5, x1: 4, x2: Math.min(cl - 4, 40) },
      etiqueta: P(Math.min(cl / 2, 30), 1.8), compacta: true,
    });

    return {
      piezas,
      notas: [
        tr('n.boxerEase'),
        tr('n.boxerPouch'),
        tr('n.boxerElastic', { v: fmtN(W) }),
        tr('n.boxerFabric'),
        tr('n.boxerRef'),
        tr('n.hem', { v: fmtN(2) }),
        tr('n.mirror'),
        tr('n.joinPair'),
        tr('n.saEdges'),
        tr('n.sewBoxer'),
      ],
    };
  }

  // ---------- Bocetos de prenda terminada (esquemáticos, sin escala) ----------
  // Trazos simples de vista delantera con las piezas ya unidas. No son a
  // escala ni sustituyen al patrón: solo muestran cómo queda la prenda.
  const BC = { linea: '#14101F', corte: '#FF4D2E', guia: '#7A6FA6', suave: '#FFD9CF' };

  function mangaBoceto(s, tx, ty, ax, ay, dx, dy, Lm) {
    const X = (v) => f(s * v);
    const cox = tx + dx * Lm, coy = ty + dy * Lm;
    const cix = ax + dx * (Lm - 3), ciy = ay + dy * (Lm - 3);
    return `M${X(tx)} ${f(ty)} L${X(cox)} ${f(coy)} L${X(cix)} ${f(ciy)} L${X(ax)} ${f(ay)} Z`;
  }

  function bocetoFalda(m) {
    const waistW = m.cintura + 1, hipW = m.cadera + 4, L = m.largoFalda;
    const d = [];
    d.push(`<path d="M${f(-waistW / 2)} 0 L${f(waistW / 2)} 0 L${f(hipW / 2)} ${f(L)} L${f(-hipW / 2)} ${f(L)} Z" fill="#FFFFFF" stroke="${BC.linea}" stroke-width="0.4" stroke-linejoin="round"/>`);
    d.push(`<rect x="${f(-waistW / 2)}" y="-4" width="${f(waistW)}" height="4" fill="#FFFFFF" stroke="${BC.linea}" stroke-width="0.4"/>`);
    d.push(`<path d="M0 0 V${f(L)}" stroke="${BC.guia}" stroke-width="0.25" stroke-dasharray="1 0.8"/>`);
    d.push(`<path d="M${f(-waistW / 4)} 0 L${f(-waistW / 4 + 1)} 9 M${f(waistW / 4)} 0 L${f(waistW / 4 - 1)} 9" stroke="${BC.linea}" stroke-width="0.3"/>`);
    d.push(`<path d="M${f(-hipW / 2)} ${f(L - 4)} H${f(hipW / 2)}" stroke="${BC.guia}" stroke-width="0.25" stroke-dasharray="1 0.8"/>`);
    return { d: d.join(''), w: Math.max(waistW, hipW) + 6, h: L + 4, y0: -4 };
  }

  function bocetoPantalon(m) {
    const waistW = m.cintura + 2, legW = m.bajo / 2, T = m.tiro, L = m.largoPantalon;
    const ox = waistW / 2 + 1.5, flyL = clamp(T * 0.65, 15, 20);
    const d = [];
    d.push(`<rect x="${f(-waistW / 2)}" y="-4" width="${f(waistW)}" height="4" fill="#FFFFFF" stroke="${BC.linea}" stroke-width="0.4"/>`);
    d.push(`<path d="M${f(-waistW / 2)} 0 L${f(-ox)} ${f(L)} L${f(-ox + legW)} ${f(L)} L0 ${f(T)} L${f(ox - legW)} ${f(L)} L${f(ox)} ${f(L)} L${f(waistW / 2)} 0" fill="#FFFFFF" stroke="${BC.linea}" stroke-width="0.4" stroke-linejoin="round"/>`);
    d.push(`<path d="M0 0 C1.5 4 1.8 9 1.5 ${f(flyL)}" fill="none" stroke="${BC.corte}" stroke-width="0.3"/>`);
    d.push(`<path d="M${f(-waistW / 2 + 1)} 1 Q${f(-waistW / 2 + 4)} 4 ${f(-waistW / 2 + 5)} 9 M${f(waistW / 2 - 1)} 1 Q${f(waistW / 2 - 4)} 4 ${f(waistW / 2 - 5)} 9" fill="none" stroke="${BC.linea}" stroke-width="0.3"/>`);
    d.push(`<path d="M${f(-ox)} ${f(L - 4)} H${f(-ox + legW)} M${f(ox - legW)} ${f(L - 4)} H${f(ox)}" stroke="${BC.guia}" stroke-width="0.25" stroke-dasharray="1 0.8"/>`);
    return { d: d.join(''), w: ox * 2 + 6, h: L + 4, y0: -4 };
  }

  function bocetoTorso(bodyW, waistW, yWaist, hemY, sx, sy, nw, nd, ay, Lm, darts) {
    const d = [];
    const tapered = hemY !== yWaist;
    const R = `M${f(nw)} 0 L${f(sx)} ${f(sy)} L${f(bodyW / 2)} ${f(ay)}` +
      (tapered ? ` L${f(waistW / 2)} ${f(yWaist)} L${f(bodyW / 2)} ${f(hemY)}` : ` L${f(bodyW / 2)} ${f(hemY)}`);
    const Lside = tapered
      ? ` L${f(-bodyW / 2)} ${f(hemY)} L${f(-waistW / 2)} ${f(yWaist)} L${f(-bodyW / 2)} ${f(ay)}`
      : ` L${f(-bodyW / 2)} ${f(hemY)} L${f(-bodyW / 2)} ${f(ay)}`;
    d.push(`<path d="${R}${Lside} L${f(-sx)} ${f(sy)} L${f(-nw)} 0 C${f(-nw * 0.5)} ${f(nd)} ${f(nw * 0.5)} ${f(nd)} ${f(nw)} 0 Z" fill="#FFFFFF" stroke="${BC.linea}" stroke-width="0.4" stroke-linejoin="round"/>`);
    if (darts) d.push(`<path d="M${f(-waistW / 4)} ${f(yWaist)} L${f(-waistW / 4 + 0.8)} ${f(yWaist - 11)} M${f(waistW / 4)} ${f(yWaist)} L${f(waistW / 4 - 0.8)} ${f(yWaist - 11)}" stroke="${BC.linea}" stroke-width="0.3"/>`);
    if (Lm > 0) {
      const dx = 0.55, dy = 0.84;
      d.push(`<path d="${mangaBoceto(1, sx, sy, bodyW / 2, ay, dx, dy, Lm)}" fill="#FFFFFF" stroke="${BC.linea}" stroke-width="0.4" stroke-linejoin="round"/>`);
      d.push(`<path d="${mangaBoceto(-1, sx, sy, bodyW / 2, ay, dx, dy, Lm)}" fill="#FFFFFF" stroke="${BC.linea}" stroke-width="0.4" stroke-linejoin="round"/>`);
    }
    const halfW = Math.max(bodyW / 2, sx + 0.55 * Lm) + 3;
    return { d: d.join(''), w: halfW * 2, h: Math.max(hemY, sy + 0.84 * Lm + 2), y0: 0 };
  }

  function bocetoCamiseta(m) {
    const bodyW = (m.pecho + 10) / 2, nw = m.cuello / 6 + 1, nd = m.cuello / 6 + 2;
    const b = bocetoTorso(bodyW, bodyW, m.largoCamiseta, m.largoCamiseta, m.hombros / 2, 4, nw, nd, m.pecho / 6 + 8, m.largoManga, false);
    const hem = `<path d="M${f(-bodyW / 2)} ${f(m.largoCamiseta - 2.5)} H${f(bodyW / 2)}" stroke="${BC.guia}" stroke-width="0.25" stroke-dasharray="1 0.8"/>`;
    return { d: b.d + hem, w: b.w, h: b.h, y0: b.y0 };
  }

  function bocetoCuerpo(m) {
    const chestW = (m.pecho + 8) / 2, waistW = (m.cintura + 4) / 2, td = m.talleDel;
    const nw = m.cuello / 6 + 0.5, nd = nw + 1, ay = m.pecho / 6 + 8;
    const sx = nw + m.hombro * 0.9;
    return bocetoTorso(chestW, waistW, td, td, sx, 3, nw, nd, ay, m.largoManga, true);
  }

  function bocetoBoxer(m) {
    // Prenda unida con los contornos reales del patrón (vista exterior:
    // sin vista ni tapeta, que quedan ocultas por dentro).
    const u = unirBoxer(m);
    const d = [];
    for (const e of [u.placed[0], u.placed[1], u.placed[2], u.placed[3], u.placed[4]]) {
      d.push(grupoColocado(e, `<path d="${e.pz.outline}" fill="#FFFFFF" stroke="${BC.linea}" stroke-width="0.07" stroke-linejoin="round"/>`));
    }
    d.push(`<text x="0" y="${f(u.L + 2.6)}" font-size="1.1" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" fill="${BC.guia}">${esc(tr('tut.front'))}</text>`);
    d.push(`<text x="${f(u.cxB)}" y="${f(u.L + 2.6)}" font-size="1.1" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" fill="${BC.guia}">${esc(tr('tut.back'))}</text>`);
    const w = u.maxX - u.minX;
    return { d: `<g transform="translate(${f(-(u.minX + u.maxX) / 2)} 0)">${d.join('')}</g>`, w, h: u.maxY - u.minY, y0: u.minY };
  }

  // ---------- Bóxer unido (parejas espejadas con los contornos reales) ----------
  // Compone delantero y trasero como pares espejados usando los mismos
  // contornos del patrón, para que el tutorial y el boceto se parezcan a
  // las figuras del PDF. La unión es esquemática (espejo sobre eje recto):
  // sirve para reconocer las piezas, no para medir sobre ella.
  function unirBoxer(m) {
    const res = boxer(m);
    // Orden fijo de boxer(): [delantero, vista, tapeta, trasero, goma]
    const front = res.piezas[0], vista = res.piezas[1], tap = res.piezas[2];
    const back = res.piezas[3], elastic = res.piezas[4];
    for (const pz of res.piezas) pz._bb = bbox(pz.outline.pts);
    const ejeF = front.eje, ejeB = back.eje;
    const halfUF = Math.max(ejeF - front._bb.minX, front._bb.maxX - ejeF);
    const halfUB = Math.max(ejeB - back._bb.minX, back._bb.maxX - ejeB);
    const gap = 8, cxB = halfUF + gap + halfUB;
    const cl = elastic._bb.maxX - elastic._bb.minX;
    const L = Math.max(m.largoBoxer, m.tiro + 5);
    const vx = -(halfUF + 3 + 6);
    const placed = [
      { pz: front, tx: -ejeF, ty: 0, mir: false },
      { pz: front, tx: ejeF, ty: 0, mir: true },
      { pz: back, tx: cxB - ejeB, ty: 0, mir: false },
      { pz: back, tx: cxB + ejeB, ty: 0, mir: true },
      { pz: elastic, tx: -cl / 2, ty: -12, mir: false },
      { pz: vista, tx: vx, ty: 8, mir: false },
      { pz: tap, tx: vx, ty: 24, mir: false },
    ];
    const minX = vx - 2, maxX = cxB + halfUB + 4, minY = -16, maxY = L + 5;
    return { placed, front, back, elastic, vista, tap, ejeF, ejeB, cxB, cl, L, halfUF, halfUB, minX, maxX, minY, maxY };
  }

  function grupoColocado(e, interior) {
    const t = e.mir ? `translate(${f(e.tx)} ${f(e.ty)}) scale(-1 1)` : `translate(${f(e.tx)} ${f(e.ty)})`;
    return `<g transform="${t}">${interior}</g>`;
  }

  const BOCETOS = { falda: bocetoFalda, cuerpo: bocetoCuerpo, pantalon: bocetoPantalon, camiseta: bocetoCamiseta, boxer: bocetoBoxer };

  function bocetar(prendaId, medidas) {
    const b = BOCETOS[prendaId](medidas);
    const pad = 5;
    const W = b.w + pad * 2, H = b.h + pad * 2 + 7;
    const inner = `<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="#FFFFFF"/>` +
      `<g transform="translate(${f(W / 2)} ${f(pad - b.y0)})">${b.d}</g>` +
      `<text x="${f(pad)}" y="${f(H - 2.5)}" font-size="2.4" font-family="Helvetica, Arial, sans-serif" fill="${BC.linea}"><tspan font-weight="bold">${esc(PRENDAS[prendaId].nombre)}</tspan><tspan fill="${BC.guia}" font-size="1.8"> · ${esc(tr('p.sketch'))}</tspan></text>`;
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}" height="${f(H)}" viewBox="0 0 ${f(W)} ${f(H)}">${inner}</svg>`, inner, width: W, height: H };
  }

  // ---------- Tutorial animado del bóxer (contornos reales del patrón) ----------
  // Las piezas se dibujan extendidas, sin solaparse, en el orden en que
  // rodean el cuerpo: trasero · delantero · delantero · trasero (los dos de
  // cada par en espejo). Así cada costado queda junto a su pareja y el
  // centro delantero en medio. En cada paso, los bordes que se cosen juntos
  // llevan el mismo color y la misma letra. La página (tutorial.js) muestra
  // el paso actual (.on) y deja los anteriores como costuras ya hechas (.done).

  // Muestrea un trazado M/L/C y devuelve el punto a mitad de su longitud
  function puntoMedio(d) {
    const t = d.match(/[MLCZ]|-?[\d.]+/g);
    const pts = [];
    let i = 0, cur = null;
    const n = () => +t[i++];
    while (i < t.length) {
      const c = t[i++];
      if (c === 'M') { cur = P(n(), n()); pts.push(cur); }
      else if (c === 'L') { cur = P(n(), n()); pts.push(cur); }
      else if (c === 'C') {
        const a = P(n(), n()), b = P(n(), n()), q = P(n(), n());
        for (let k = 1; k <= 24; k++) pts.push(cubicAt(cur, a, b, q, k / 24));
        cur = q;
      }
    }
    let total = 0;
    for (let k = 1; k < pts.length; k++) total += dist(pts[k - 1], pts[k]);
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const l = dist(pts[k - 1], pts[k]);
      if (acc + l >= total / 2) return lerp(pts[k - 1], pts[k], (total / 2 - acc) / (l || 1));
      acc += l;
    }
    return pts[0];
  }

  function tutorialBoxer(m) {
    const res = boxer(m);
    const [front, vista, tap, back, elastic] = res.piezas;
    for (const pz of res.piezas) pz._bb = bbox(pz.outline.pts);
    const L = Math.max(m.largoBoxer, m.tiro + 5);
    const gap = 7;

    // Fila principal: trasero (espejo) · delantero · delantero (espejo) · trasero
    let x = 0;
    const colocar = (pz, mir, ty = 0) => {
      const e = { pz, mir, ty, tx: mir ? x + pz._bb.maxX : x - pz._bb.minX };
      x += pz._bb.w + gap;
      return e;
    };
    const placed = [colocar(back, true), colocar(front, false), colocar(front, true), colocar(back, false)];
    const rowW = x - gap;
    // Vista y tapeta bajo los centros delanteros, con su curva mirando a la del delantero
    const yFly = L + 7;
    const cfD = placed[1].tx + front.eje, cfM = placed[2].tx - front.eje;
    placed.push({ pz: vista, mir: false, tx: cfD + 3, ty: yFly });
    placed.push({ pz: tap, mir: true, tx: cfM - 3, ty: yFly });
    // Tira de la jareta, centrada debajo
    const yBand = yFly + 14 + 9;
    const cl = elastic._bb.w;
    placed.push({ pz: elastic, mir: false, tx: rowW / 2 - cl / 2, ty: yBand });

    // Coordenadas globales de un punto local de una pieza colocada
    const glob = (e, p) => P(e.mir ? e.tx - p.x : e.tx + p.x, e.ty + p.y);

    const nombres = ['tut.back', 'tut.front', 'tut.front', 'tut.back', 'tut.lbl.facing', 'tut.lbl.under', 'tut.lbl.band'];
    const centroPieza = (e) => {
      const bb = e.pz._bb;
      return glob(e, P((bb.minX + bb.maxX) / 2, e.pz === elastic ? bb.maxY / 2 + 0.6 : bb.minY + bb.h * 0.42));
    };
    const FONT = 'font-family="Helvetica, Arial, sans-serif"';
    const base = placed.map((e) => grupoColocado(e, `<path d="${e.pz.outline}" fill="#FFFFFF" stroke="#B9A6FF" stroke-width="0.14" stroke-linejoin="round"/>`)).join('') +
      placed.map((e, i) => {
        const c = centroPieza(e);
        const fs = i >= 4 ? 1.3 : 2;
        return `<text class="tut-name" x="${f(c.x)}" y="${f(c.y)}" font-size="${fs}" font-weight="bold" text-anchor="middle" ${FONT} fill="#7A6FA6">${esc(tr(nombres[i]))}</text>`;
      }).join('');

    // Parejas de bordes por paso: [pieza, borde, pieza, borde]; una sola
    // pieza = borde que se cose sin pareja (jareta, bajo).
    const COLS = ['#FF4D2E', '#6A3DF0', '#0E9F6E', '#E08A00'];
    const pasos = {
      1: [[1, 'bragueta', 4, 'bragueta'], [2, 'bragueta', 5, 'bragueta']],
      2: [[1, 'centro', 2, 'centro'], [0, 'centro', 3, 'centro']],
      3: [[1, 'entrepierna', 0, 'entrepierna'], [2, 'entrepierna', 3, 'entrepierna']],
      4: [[0, 'costado', 1, 'costado'], [2, 'costado', 3, 'costado']],
      5: [[6, 'cintura', 0, 'cintura', 1, 'cintura', 2, 'cintura', 3, 'cintura']],
      6: [[0, 'bajo', 1, 'bajo', 2, 'bajo', 3, 'bajo']],
    };
    const LET = 'ABCD';
    const top = Math.min(front._bb.minY, back._bb.minY);
    let minY = top - 4, maxY = yBand + 9;
    const steps = [];
    const ov = [1, 2, 3, 4, 5, 6].map((n) => {
      const grupos = pasos[n];
      const activos = new Set();
      grupos.forEach((g) => { for (let k = 0; k < g.length; k += 2) activos.add(g[k]); });
      const tinte = [...activos].map((i) => grupoColocado(placed[i], `<path d="${placed[i].pz.outline}" fill="#FF4D2E" fill-opacity="0.07" stroke="#14101F" stroke-width="0.12" stroke-linejoin="round"/>`)).join('') +
        [...activos].map((i) => {
          const c = centroPieza(placed[i]);
          return `<text x="${f(c.x)}" y="${f(c.y)}" font-size="${i >= 4 ? 1.3 : 2}" font-weight="bold" text-anchor="middle" ${FONT} fill="#14101F">${esc(tr(nombres[i]))}</text>`;
        }).join('');
      const seams = [], links = [], badges = [];
      const info = [];
      grupos.forEach((g, gi) => {
        const col = COLS[gi % COLS.length], letra = LET[gi];
        const mids = [];
        const partes = [];
        for (let k = 0; k < g.length; k += 2) {
          const e = placed[g[k]], d = e.pz.bordes[g[k + 1]];
          seams.push(grupoColocado(e, `<path class="tut-seam" d="${d}" pathLength="100" fill="none" stroke="${col}" stroke-width="0.55" stroke-linecap="round" stroke-linejoin="round"/>`));
          mids.push(glob(e, puntoMedio(d)));
          partes.push({ pieza: nombres[g[k]], borde: g[k + 1] });
        }
        // Uniones de dos bordes: arco discontinuo entre los puntos medios
        if (mids.length === 2) {
          const [a, b] = mids;
          const abajo = (a.y + b.y) / 2 > L * 0.55;
          const k = 5 + dist(a, b) * 0.18;
          // Los arcos largos pasan por fuera de las piezas (mitad del arco = media de extremos y control)
          const med = (a.y + b.y) / 2;
          let cy = abajo ? Math.max(a.y, b.y) + k : Math.min(a.y, b.y) - k;
          if (dist(a, b) > 40) cy = abajo ? Math.max(cy, 2 * (L + 3) - med) : Math.min(cy, 2 * (top - 4) - med);
          minY = Math.min(minY, cy - 1); maxY = Math.max(maxY, cy + 1);
          links.push(`<path class="tut-link" d="M${f(a.x)} ${f(a.y)} Q${f((a.x + b.x) / 2)} ${f(cy)} ${f(b.x)} ${f(b.y)}" fill="none" stroke="${col}" stroke-width="0.22" stroke-dasharray="0.8 0.5"/>`);
        }
        for (const p of mids) {
          badges.push(`<g class="tut-badge" transform="translate(${f(p.x)} ${f(p.y)})"><circle r="1.7" fill="${col}" stroke="#FFFFFF" stroke-width="0.3"/><text y="0.62" font-size="1.8" font-weight="bold" text-anchor="middle" ${FONT} fill="#FFFFFF">${letra}</text></g>`);
        }
        info.push({ color: col, letra, partes });
      });
      steps.push({ n, grupos: info });
      return `<g class="tut-step" data-step="${n}"><g class="tut-tint">${tinte}</g>${links.join('')}${seams.join('')}${badges.join('')}</g>`;
    }).join('');

    const minX = -3, maxX = rowW + 3;
    const Wd = maxX - minX, Ht = maxY - minY;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(Wd)}" height="${f(Ht)}" viewBox="${f(minX)} ${f(minY)} ${f(Wd)} ${f(Ht)}"><g class="tut-base">${base}</g><g class="tut-seams">${ov}</g></svg>`;
    return { svg, width: Wd, height: Ht, steps };
  }

  // ---------- Catálogo de prendas y medidas ----------
  const MEDIDAS = {
    pecho: { min: 60, max: 160 },
    cintura: { min: 45, max: 150 },
    cadera: { min: 60, max: 170 },
    altCadera: { min: 12, max: 30 },
    largoFalda: { min: 30, max: 110 },
    talleEsp: { min: 30, max: 55 },
    talleDel: { min: 32, max: 62 },
    anchoEsp: { min: 25, max: 55 },
    hombro: { min: 8, max: 20 },
    cuello: { min: 28, max: 55 },
    altBusto: { min: 18, max: 40 },
    sepBusto: { min: 12, max: 28 },
    tiro: { label: tr('p.crotch'), ayuda: 'Sentada en una silla dura: desde la cintura hasta el asiento, por el costado.', min: 18, max: 40 },
    largoPantalon: { min: 50, max: 130 },
    bajo: { min: 30, max: 70 },
    largoCamiseta: { min: 40, max: 95 },
    hombros: { min: 28, max: 60 },
    largoManga: { min: 10, max: 70 },
    brazo: { min: 18, max: 55 },
    muslo: { min: 35, max: 80 },
    largoBoxer: { min: 25, max: 65 },
  };

  const PRENDAS = {
    falda: { medidas: ['cintura', 'cadera', 'altCadera', 'largoFalda'], trazar: falda },
    cuerpo: { medidas: ['pecho', 'cintura', 'talleEsp', 'talleDel', 'anchoEsp', 'hombro', 'cuello', 'altBusto', 'sepBusto', 'largoManga', 'brazo'], trazar: cuerpo },
    pantalon: { medidas: ['cintura', 'cadera', 'tiro', 'largoPantalon', 'bajo'], trazar: pantalon },
    camiseta: { medidas: ['pecho', 'hombros', 'cuello', 'largoCamiseta', 'largoManga', 'brazo'], trazar: camiseta },
    boxer: { medidas: ['cintura', 'cadera', 'tiro', 'muslo', 'largoBoxer'], trazar: boxer },
  };

  // Textos traducibles como propiedades calculadas: MEDIDAS.pecho.label, PRENDAS.falda.nombre…
  for (const [k, m] of Object.entries(MEDIDAS)) {
    Object.defineProperty(m, 'label', { get: () => tr(`m.${k}.l`), enumerable: true });
    Object.defineProperty(m, 'ayuda', { get: () => tr(`m.${k}.h`), enumerable: true });
  }
  for (const [k, p] of Object.entries(PRENDAS)) {
    Object.defineProperty(p, 'nombre', { get: () => tr(`g.${k}.name`), enumerable: true });
    Object.defineProperty(p, 'resumen', { get: () => tr(`g.${k}.sum`), enumerable: true });
  }

  // Tallas de referencia (aproximadas; mujer: tabla española 34–54; hombre: 44–60)
  function tallaBase(t) {
    const k = (t - 38) / 2;
    return {
      pecho: 88 + 4 * k, cintura: 68 + 4 * k, cadera: 94 + 4 * k, altCadera: 20 + 0.25 * k,
      largoFalda: 60, talleEsp: 40 + 0.5 * k, talleDel: 43 + 0.75 * k, anchoEsp: 35 + 1 * k,
      hombro: 12 + 0.25 * k, cuello: 36 + 1 * k, altBusto: 26 + 0.5 * k, sepBusto: 18 + 0.5 * k,
      tiro: 26 + 0.5 * k, largoPantalon: 102, bajo: 40 + 1 * k, largoCamiseta: 62 + 0.5 * k,
      hombros: 38 + 1 * k, largoManga: 20, brazo: 27 + 1.5 * k, muslo: 54 + 2 * k, largoBoxer: 38 + 0.5 * k,
    };
  }

  function tallaBaseHombre(t) {
    const k = (t - 50) / 2;
    return {
      pecho: 100 + 4 * k, cintura: 88 + 4 * k, cadera: 102 + 4 * k, altCadera: 21 + 0.25 * k,
      largoFalda: 60, talleEsp: 44 + 0.5 * k, talleDel: 47 + 0.75 * k, anchoEsp: 39 + 1 * k,
      hombro: 13 + 0.25 * k, cuello: 40 + 1 * k, altBusto: 28 + 0.5 * k, sepBusto: 19 + 0.5 * k,
      tiro: 28 + 0.5 * k, largoPantalon: 106, bajo: 42 + 1 * k, largoCamiseta: 66 + 0.5 * k,
      hombros: 44 + 1 * k, largoManga: 22, brazo: 30 + 1.5 * k, muslo: 58 + 2 * k, largoBoxer: 40 + 0.5 * k,
    };
  }

  // ---------- Renderizado SVG ----------
  const COL = { linea: '#14101F', margen: '#FFD9CF', corte: '#FF4D2E', guia: '#7A6FA6', pinza: '#14101F', texto: '#14101F', doblez: '#6A3DF0', union: '#0E9F6E' };

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

    // Borde por el que se cosen entre sí las dos piezas de un par «Cortar 2»
    const u = pz.union;
    if (u) {
      o.push(`<path d="${u.d}" fill="none" stroke="${COL.union}" stroke-width="0.22" stroke-linecap="round" stroke-dasharray="0.9 0.35"/>`);
      o.push(`<text transform="translate(${f(u.at.x)} ${f(u.at.y)}) rotate(${f(u.rot || 0)})" font-size="0.75" font-weight="bold" fill="${COL.union}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${esc(u.texto)}</text>`);
    }

    if (pz.doblez) {
      o.push(`<path d="M0 ${f(bb.minY)} L0 ${f(bb.maxY)}" stroke="${COL.doblez}" stroke-width="0.1" stroke-dasharray="1.2 0.4 0.2 0.4"/>`);
      const my = (bb.minY + bb.maxY) / 2;
      o.push(`<text transform="translate(0.9 ${f(my)}) rotate(-90)" font-size="0.9" font-weight="bold" fill="${COL.doblez}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${esc(tr('p.fold'))}</text>`);
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
        o.push(`<text transform="translate(${f(mid.x - (rot ? 0.35 : 0))} ${f(mid.y - (rot ? 0 : 0.35))}) rotate(${rot})" font-size="0.65" fill="${COL.texto}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${esc(tr('p.grain'))}</text>`);
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
   * Estima los metros de tela (tela doblada a lo largo) por área ocupada de
   * las piezas, con un 15 % extra por retales y huecos del tendido.
   * Es una aproximación generosa: no optimiza el tendido real.
   * Devuelve metros.
   */
  function estimarTela(piezas, anchoTela, sa) {
    const medio = Math.max(anchoTela / 2 - 2, 20);
    let area = 0;
    for (const pz of piezas) {
      const bb = pz._bb;
      const n = pz.corte === tr('p.cut4') ? 4 : pz.corte === tr('p.cut2') ? 2 : 1;
      area += (bb.w + sa * 2) * (bb.h + sa * 2) * n;
    }
    return (area / (medio * 100)) * 1.15;
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

    const fecha = new Date().toLocaleDateString(global.PerchaI18n ? global.PerchaI18n.locale() : 'es-ES');
    const info = `Percha · ${prenda.nombre} · ${fecha}`;
    const g = [];
    g.push(`<rect x="0" y="0" width="${f(width)}" height="${f(height)}" fill="#FFFFFF"/>`);
    // Cabecera
    g.push(`<rect x="2" y="2" width="10" height="10" fill="none" stroke="${COL.linea}" stroke-width="0.06"/>`);
    g.push(`<path d="M2 7 L12 7 M7 2 L7 12" stroke="${COL.guia}" stroke-width="0.03" stroke-dasharray="0.3 0.3"/>`);
    g.push(`<text x="7" y="6.4" font-size="0.75" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" fill="${COL.texto}">10 × 10 cm</text>`);
    g.push(`<text x="7" y="8.1" font-size="0.5" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" fill="${COL.guia}">${esc(tr('p.check'))}</text>`);
    g.push(`<g font-family="Helvetica, Arial, sans-serif" fill="${COL.texto}">`);
    g.push(`<text x="14" y="4.4" font-size="1.6" font-weight="bold">percha<tspan fill="${COL.corte}">.</tspan></text>`);
    g.push(`<text x="14" y="6.4" font-size="0.85">${esc(prenda.nombre)} · ${esc(prenda.resumen)}</text>`);
    const med = prenda.medidas.map((k) => `${MEDIDAS[k].label}: ${fmtN(medidas[k])} cm`);
    for (let i = 0; i < med.length; i += 3) {
      g.push(`<text x="14" y="${f(7.8 + (i / 3) * 0.8)}" font-size="0.55" fill="${COL.guia}">${esc(med.slice(i, i + 3).join(' · '))}</text>`);
    }
    g.push(`<text x="14" y="${f(8.1 + Math.ceil(med.length / 3) * 0.8)}" font-size="0.55" fill="${COL.corte}">${esc(sa > 0 ? tr('p.saIncl', { sa: fmtN(sa) }) : tr('p.saNone'))}</text>`);
    g.push('</g>');

    placed.forEach((p, i) => {
      g.push(`<g transform="translate(${f(p.tx)} ${f(p.ty)})">${renderPieza(p.pz, i, sa, info)}</g>`);
    });

    // Capa de montaje: insignias numeradas sobre las costuras de cada paso
    const ov = [];
    placed.forEach((p) => {
      if (!p.pz.pasos) return;
      for (const s of p.pz.pasos) {
        ov.push(`<g transform="translate(${f(p.tx + s.x)} ${f(p.ty + s.y)})"><circle r="1.15" fill="${COL.corte}" stroke="#FFFFFF" stroke-width="0.18"/><text y="0.45" font-size="1.35" font-weight="bold" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" fill="#FFFFFF">${s.n}</text></g>`);
      }
    });
    const overlay = ov.join('');

    const inner = g.join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(width)}cm" height="${f(height)}cm" viewBox="0 0 ${f(width)} ${f(height)}">${inner}${opts.montaje ? overlay : ''}</svg>`;
    const anchoTela = opts.anchoTela || 140;
    const largoTela = estimarTela(res.piezas, anchoTela, sa);
    res.notas.push(tr('n.tela', { w: fmtN(anchoTela), m: fmtN(Math.ceil(largoTela * 10) / 10) }));
    return { svg, inner, overlay, width, height, notas: res.notas, piezas: res.piezas.length };
  }

  global.Percha = { PRENDAS, MEDIDAS, tallaBase, tallaBaseHombre, generar, bocetar, tutorialBoxer, _internals: { cubicLen } };
})(typeof window !== 'undefined' ? window : globalThis);
