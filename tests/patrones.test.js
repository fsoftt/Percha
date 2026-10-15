// Pruebas del motor de patronaje. Ejecutar con: node tests/patrones.test.js
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../assets/js/i18n.js');
const LANG_DIR = path.join(__dirname, '../assets/js/lang');
for (const f of fs.readdirSync(LANG_DIR)) require(path.join(LANG_DIR, f));
require('../assets/js/patrones.js');
const I18n = globalThis.PerchaI18n;
const { PRENDAS, MEDIDAS, tallaBase, tallaBaseHombre, generar } = globalThis.Percha;

let ok = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log(`✓ ${nombre}`); }
  catch (e) { console.error(`✗ ${nombre}\n  ${e.message}`); process.exitCode = 1; }
}

test('cada prenda declara medidas conocidas', () => {
  for (const [id, p] of Object.entries(PRENDAS)) {
    for (const k of p.medidas) assert.ok(MEDIDAS[k], `${id}: medida desconocida ${k}`);
  }
});

test('las tallas de referencia están dentro de los rangos', () => {
  for (let t = 34; t <= 54; t += 2) {
    const m = tallaBase(t);
    for (const [k, def] of Object.entries(MEDIDAS)) {
      assert.ok(m[k] >= def.min && m[k] <= def.max, `talla ${t}: ${k}=${m[k]}`);
    }
  }
  for (let t = 44; t <= 60; t += 2) {
    const m = tallaBaseHombre(t);
    for (const [k, def] of Object.entries(MEDIDAS)) {
      assert.ok(m[k] >= def.min && m[k] <= def.max, `talla hombre ${t}: ${k}=${m[k]}`);
    }
  }
});

test('todas las prendas generan SVG válido en todas las tallas y márgenes', () => {
  for (let t = 34; t <= 54; t += 2) {
    for (const id of Object.keys(PRENDAS)) {
      for (const margen of [0, 1, 1.5]) {
        const r = generar(id, tallaBase(t), { margen });
        assert.ok(!/NaN|Infinity|undefined/.test(r.svg), `${id} talla ${t} margen ${margen}`);
        assert.ok(r.width > 0 && r.height > 0);
        assert.match(r.svg, /^<svg [^>]*width="[\d.]+cm"/);
      }
    }
  }
});

test('las medidas extremas no rompen el trazado', () => {
  for (const id of Object.keys(PRENDAS)) {
    for (const lado of ['min', 'max']) {
      const m = {};
      for (const [k, def] of Object.entries(MEDIDAS)) m[k] = def[lado];
      const r = generar(id, m, { margen: 1 });
      assert.ok(!/NaN|Infinity|undefined/.test(r.svg), `${id} ${lado}`);
    }
  }
});

test('la falda tiene el ancho de cadera esperado (escala 1:1)', () => {
  const m = tallaBase(38);
  const r = generar('falda', m, { margen: 0 });
  // delantero + espalda = (cadera + holgura) / 2
  const anchos = [...r.svg.matchAll(/L([\d.]+) ([\d.]+) L0 \2 Z/g)].map((x) => Number(x[1]));
  assert.ok(Math.abs(anchos[0] + anchos[1] - (m.cadera + 4) / 2) < 0.01, `anchos ${anchos}`);
});

test('la manga de la camiseta encaja en la sisa', () => {
  I18n.setLang('es');
  const r = generar('camiseta', tallaBase(40), { margen: 0 });
  assert.ok(r.notas.some((n) => n.startsWith('Altura de copa')));
});

test('todos los idiomas tienen exactamente las mismas claves que el español', () => {
  const base = Object.keys(I18n._dicts.es);
  for (const code of I18n.idiomas) {
    const keys = Object.keys(I18n._dicts[code]);
    const faltan = base.filter((k) => !keys.includes(k));
    const sobran = keys.filter((k) => !base.includes(k));
    assert.deepEqual(faltan, [], `${code}: faltan ${faltan.join(', ')}`);
    assert.deepEqual(sobran, [], `${code}: sobran ${sobran.join(', ')}`);
  }
});

test('las traducciones conservan los mismos parámetros {x}', () => {
  const params = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const code of I18n.idiomas) {
    for (const [k, v] of Object.entries(I18n._dicts.es)) {
      assert.equal(params(I18n._dicts[code][k]), params(v), `${code}: ${k}`);
    }
  }
});

test('el patrón se genera en todos los idiomas sin claves sin traducir', () => {
  for (const code of I18n.idiomas) {
    I18n.setLang(code);
    for (const id of Object.keys(PRENDAS)) {
      const r = generar(id, tallaBase(40), { margen: 1 });
      assert.ok(!/\b(p|n|m|g)\.[a-zA-Z]+(\.[a-z]+)?\b/.test(r.svg.replace(/<[^>]+>/g, ' ')), `${code} ${id}`);
      for (const nota of r.notas) assert.ok(!/^[a-z]+\.[a-zA-Z.]+$/.test(nota), `${code}: ${nota}`);
    }
  }
  I18n.setLang('es');
});

test('la falda trae abertura trasera con vista', () => {
  I18n.setLang('es');
  const res = PRENDAS.falda.trazar(tallaBase(38));
  assert.equal(res.piezas.length, 4);
  assert.ok(res.piezas.some((p) => p.nombre === 'Vista de abertura'));
  assert.ok(res.piezas.some((p) => p.nombre === 'Falda · Espalda' && p.lineas.some((l) => l.texto === 'Abertura')));
  assert.ok(res.notas.some((n) => n.startsWith('Abertura trasera')));
});

test('el cuerpo trae manga con copa ajustada a la sisa', () => {
  I18n.setLang('es');
  const res = PRENDAS.cuerpo.trazar(tallaBase(38));
  assert.equal(res.piezas.length, 3);
  assert.ok(res.piezas.some((p) => p.nombre === 'Cuerpo · Manga'));
  assert.ok(res.notas.some((n) => n.startsWith('Manga de tejido plano')));
});

test('el pantalón trae bragueta con vista y tapeta', () => {
  I18n.setLang('es');
  const res = PRENDAS.pantalon.trazar(tallaBase(38));
  assert.equal(res.piezas.length, 9);
  assert.ok(res.piezas.some((p) => p.nombre === 'Bragueta · Vista'));
  assert.ok(res.piezas.some((p) => p.nombre === 'Bragueta · Tapeta'));
  assert.ok(res.notas.some((n) => n.startsWith('Bragueta con cremallera')));
});

test('el pantalón trae bolsillo y tira para trabillas', () => {
  I18n.setLang('es');
  const res = PRENDAS.pantalon.trazar(tallaBase(38));
  const fondo = res.piezas.find((p) => p.nombre === 'Bolsillo delantero · Fondo');
  assert.ok(fondo);
  assert.equal(fondo.corte, 'Cortar 4');
  assert.ok(fondo.lineas.filter((l) => l.tipo === 'piquete').length >= 2, 'el fondo no trae piquetes de coincidencia');
  assert.ok(res.piezas.some((p) => p.nombre === 'Tira para trabillas'));
  assert.ok(res.piezas.some((p) => p.nombre === 'Tira para trabillas'));
  assert.ok(res.piezas.some((p) => p.nombre === 'Pantalón · Delantero' && p.lineas.some((l) => l.texto === 'Bolsillo delantero · Fondo')));
  assert.ok(res.notas.some((n) => n.startsWith('Bolsillos delanteros')));
  assert.ok(res.notas.some((n) => n.startsWith('Tira de 15')));
});

test('el pantalón trae bolsillos traseros de ojal con vivo', () => {
  I18n.setLang('es');
  const res = PRENDAS.pantalon.trazar(tallaBase(38));
  const tras = res.piezas.find((p) => p.nombre === 'Pantalón · Trasero');
  assert.ok(tras.lineas.some((l) => l.texto === 'Bolsillo trasero'), 'el trasero no marca el ojal');
  assert.ok(tras.lineas.filter((l) => l.tipo === 'piquete').length >= 2, 'el ojal no trae piquetes');
  const vivo = res.piezas.find((p) => p.nombre === 'Vivo trasero');
  assert.ok(vivo);
  assert.equal(vivo.corte, 'Cortar 2');
  const fondoT = res.piezas.find((p) => p.nombre === 'Bolsillo trasero · Fondo');
  assert.ok(fondoT);
  assert.equal(fondoT.corte, 'Cortar 4');
  assert.ok(res.notas.some((n) => n.startsWith('Bolsillos traseros de ojal')));
});

test('la tabla masculina genera patrones válidos en todos los idiomas', () => {
  for (const code of I18n.idiomas) {
    I18n.setLang(code);
    for (const id of ['pantalon', 'camiseta', 'boxer', 'cuerpo']) {
      const r = generar(id, tallaBaseHombre(50), { margen: 1 });
      assert.ok(!/NaN|Infinity|undefined/.test(r.svg), `${code} ${id} hombre`);
      assert.ok(r.width > 0 && r.height > 0);
    }
  }
  I18n.setLang('es');
});

test('la camiseta trae tira de cuello con largo positivo', () => {
  I18n.setLang('es');
  const res = PRENDAS.camiseta.trazar(tallaBase(38));
  assert.equal(res.piezas.length, 4);
  const tira = res.piezas.find((p) => p.nombre === 'Tira de cuello');
  assert.ok(tira);
  const w = Math.max(...tira.outline.pts.map((p) => p.x)) - Math.min(...tira.outline.pts.map((p) => p.x));
  assert.ok(w > 20, `ancho tira ${w}`);
});

test('el bóxer trae suplemento y bragueta curva', () => {
  I18n.setLang('es');
  const m = tallaBase(38);
  const res = PRENDAS.boxer.trazar(m);
  assert.equal(res.piezas.length, 5);
  const del = res.piezas.find((p) => p.nombre === 'Bóxer · Delantero');
  const hw = (m.cadera + 12) / 4;
  assert.ok(Math.max(...del.outline.pts.map((p) => p.x)) > hw, 'sin suplemento');
  const vista = res.piezas.find((p) => p.nombre === 'Bragueta · Vista');
  assert.ok(vista.outline.toString().includes('C'), 'vista recta sin curva');
  assert.ok(res.notas.some((n) => n.includes('masculino')));
});

test('todas las prendas marcan el dobladillo del bajo', () => {
  I18n.setLang('es');
  for (const id of ['falda', 'pantalon', 'camiseta', 'cuerpo', 'boxer']) {
    const res = PRENDAS[id].trazar(tallaBase(38));
    assert.ok(res.piezas.some((p) => p.lineas.some((l) => l.texto === 'Dobladillo')), `${id}: sin guía de dobladillo`);
    assert.ok(res.notas.some((n) => n.includes('Dobladillo')), `${id}: sin nota de dobladillo`);
  }
});

test('todas las prendas explican espejo, margen por borde y orden de costura', () => {
  I18n.setLang('es');
  const sew = { falda: 'Orden de costura: 1) pinzas', pantalon: 'Orden de costura: 1) pinzas', camiseta: 'Orden de costura: 1) hombros', cuerpo: 'Orden de costura: 1) pinzas', boxer: 'Orden de costura: 1) bragueta' };
  for (const id of Object.keys(sew)) {
    const res = PRENDAS[id].trazar(tallaBase(38));
    assert.ok(res.notas.some((n) => n.includes('espejo')), `${id}: sin nota de espejo`);
    assert.ok(res.notas.some((n) => n.includes('Margen aplicado')), `${id}: sin nota de margen por borde`);
    assert.ok(res.notas.some((n) => n.startsWith(sew[id])), `${id}: sin orden de costura`);
  }
});

test('la estimación de tela baja con telas más anchas', () => {
  I18n.setLang('es');
  const num = (nota) => Number(nota.match(/([\d.,]+) m\./)[1].replace(',', '.'));
  const a = generar('pantalon', tallaBase(38), { margen: 1, anchoTela: 110 });
  const b = generar('pantalon', tallaBase(38), { margen: 1, anchoTela: 150 });
  const na = a.notas.find((n) => n.startsWith('Tela estimada'));
  const nb = b.notas.find((n) => n.startsWith('Tela estimada'));
  assert.ok(na && nb);
  assert.ok(num(na) > 0 && num(nb) > 0);
  assert.ok(num(na) >= num(nb), `${num(na)} < ${num(nb)}`);
});

test('la vista de montaje numera todos los pasos de cada prenda', () => {
  I18n.setLang('es');
  const pasos = { falda: 6, cuerpo: 5, pantalon: 7, camiseta: 5, boxer: 6 };
  for (const [id, n] of Object.entries(pasos)) {
    const r = generar(id, tallaBase(38), { margen: 1, montaje: true });
    assert.ok(r.overlay.length > 0, `${id}: sin capa de montaje`);
    const nums = new Set([...r.overlay.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1])));
    assert.deepEqual([...nums].sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1), `${id}: pasos ${[...nums]}`);
    assert.ok(r.svg.includes(r.overlay), `${id}: el svg no incluye la capa`);
    const limpio = generar(id, tallaBase(38), { margen: 1 });
    assert.ok(!limpio.svg.includes('<circle'), `${id}: el patrón limpio lleva insignias`);
  }
});

test('el boceto de prenda terminada es válido en todas las tallas e idiomas', () => {
  const { bocetar } = globalThis.Percha;
  for (const code of I18n.idiomas) {
    I18n.setLang(code);
    for (let t = 34; t <= 54; t += 2) {
      for (const id of Object.keys(PRENDAS)) {
        const b = bocetar(id, tallaBase(t));
        assert.ok(!/NaN|Infinity|undefined/.test(b.svg), `${code} ${id} t${t}`);
        assert.ok(b.width > 0 && b.height > 0);
      }
    }
    for (let t = 44; t <= 60; t += 2) {
      const b = bocetar('boxer', tallaBaseHombre(t));
      assert.ok(!/NaN|Infinity|undefined/.test(b.svg), `${code} boxer hombre t${t}`);
    }
    const b = bocetar('camiseta', tallaBase(40));
    assert.ok(!/p\.[a-zA-Z]+/.test(b.svg.replace(/<[^>]+>/g, ' ')), `${code}: clave sin traducir en boceto`);
  }
  I18n.setLang('es');
});

test('el tutorial del bóxer usa los contornos reales del patrón', () => {
  const { tutorialBoxer } = globalThis.Percha;
  for (const code of I18n.idiomas) {
    I18n.setLang(code);
    for (let t = 34; t <= 54; t += 2) {
      const r = tutorialBoxer(tallaBase(t));
      assert.ok(!/NaN|Infinity|undefined/.test(r.svg), `${code} t${t}`);
      assert.ok(r.width > 0 && r.height > 0);
    }
    for (let t = 44; t <= 60; t += 2) {
      const r = tutorialBoxer(tallaBaseHombre(t));
      assert.ok(!/NaN|Infinity|undefined/.test(r.svg), `${code} hombre t${t}`);
    }
  }
  I18n.setLang('es');
  const m = tallaBase(40);
  const r = tutorialBoxer(m);
  assert.deepEqual(r.steps.map((s) => s.n), [1, 2, 3, 4, 5, 6]);
  assert.equal((r.svg.match(/data-step="/g) || []).length, 6);
  // Los mismos contornos que el PDF: delantero, trasero y goma, con parejas en espejo
  const piezas = PRENDAS.boxer.trazar(m).piezas;
  assert.ok(r.svg.includes(piezas[0].outline.toString()), 'sin el delantero real');
  assert.ok(r.svg.includes(piezas[3].outline.toString()), 'sin el trasero real');
  assert.ok(r.svg.includes(piezas[4].outline.toString()), 'sin la goma real');
  assert.ok(r.svg.includes('scale(-1 1)'), 'sin parejas en espejo');
});

test('el boceto del bóxer usa los contornos reales del patrón', () => {
  I18n.setLang('es');
  const m = tallaBase(40);
  const b = globalThis.Percha.bocetar('boxer', m);
  const piezas = PRENDAS.boxer.trazar(m).piezas;
  assert.ok(b.svg.includes(piezas[0].outline.toString()), 'sin el delantero real');
  assert.ok(b.svg.includes('scale(-1 1)'), 'sin parejas en espejo');
  assert.ok(!/NaN|Infinity|undefined/.test(b.svg));
});

test('el bóxer entra por la cadera y la jareta mide lo mismo que la cintura', () => {
  for (const m of [tallaBase(34), tallaBase(46), tallaBaseHombre(44), tallaBaseHombre(60)]) {
    const [front, , , back, band] = PRENDAS.boxer.trazar(m).piezas;
    const largo = (pz) => { const [a, b] = [pz.outline.pts[0], pz.outline.pts[1]]; return Math.hypot(b.x - a.x, b.y - a.y); };
    const cintura = 2 * (largo(front) + largo(back));
    assert.ok(cintura >= m.cadera + 4, `cintura ${cintura} < cadera ${m.cadera}`);
    const largoTira = Math.max(...band.outline.pts.map((p) => p.x));
    assert.ok(Math.abs(largoTira - cintura) < 0.01, `tira ${largoTira} ≠ cintura ${cintura}`);
  }
});

test('las piezas «Cortar 2» que se cosen entre sí marcan el borde de unión', () => {
  const m = tallaBase(40);
  const con = (id) => PRENDAS[id].trazar(m).piezas.filter((p) => p.union).length;
  assert.equal(con('boxer'), 2);
  assert.equal(con('pantalon'), 2);
  assert.equal(con('falda'), 1);
  assert.equal(con('camiseta'), 0);
  const svg = generar('boxer', m).svg;
  assert.ok(svg.includes('#0E9F6E'), 'sin línea de unión en el SVG');
});

test('cada paso del tutorial une bordes con color y letra', () => {
  const r = globalThis.Percha.tutorialBoxer(tallaBase(40));
  for (const s of r.steps) {
    assert.ok(s.grupos.length > 0);
    for (const g of s.grupos) assert.ok(g.color && g.letra && g.partes.length >= 1);
  }
  assert.equal((r.svg.match(/class="tut-badge"/g) || []).length, 2 * 2 * 4 + 5 + 4);
});

test('los bordes del bóxer salen del propio contorno del patrón', () => {
  const [front, vista, , back] = PRENDAS.boxer.trazar(tallaBase(40)).piezas;
  for (const pz of [front, back]) {
    const o = pz.outline.toString();
    for (const [k, d] of Object.entries(pz.bordes)) {
      if (k === 'bragueta') continue; // guía de la abertura, no es un tramo del contorno
      for (const tramo of d.replace(/^M[^LC]+/, '').trim().split(/ (?=[LC])/)) assert.ok(o.includes(tramo), `${k}: ${tramo}`);
    }
  }
  assert.ok(vista.outline.toString().includes(vista.bordes.bragueta.replace(/^M[^LC]+/, '').trim()));
  // El trasero sube en el centro: más largo de tiro que el delantero
  assert.ok(back.outline.pts[1].y < 0);
});

const TALLAS_TODAS = () => [
  ...[34, 38, 42, 46, 50, 54].map((t) => tallaBase(t)),
  ...[44, 50, 56, 60].map((t) => tallaBaseHombre(t)),
];
const largoX = (pz) => Math.max(...pz.outline.pts.map((p) => p.x));

test('las cinturillas miden lo mismo que la cintura cosida de la prenda + 3 cm de cruce', () => {
  for (const m of TALLAS_TODAS()) {
    const f = PRENDAS.falda.trazar(m).piezas, p = PRENDAS.pantalon.trazar(m).piezas;
    assert.ok(Math.abs(largoX(f[2]) - 3 - (m.cintura + 1)) < 0.6, `falda: ${largoX(f[2])} para cintura ${m.cintura}`);
    assert.ok(Math.abs(largoX(p[2]) - 3 - (m.cintura + 2)) < 0.6, `pantalón: ${largoX(p[2])} para cintura ${m.cintura}`);
    for (const banda of [f[2], p[2]]) assert.equal(banda.lineas.filter((l) => l.tipo === 'piquete').length, 3);
  }
});

test('la cremallera de la falda llega a la cadera y no se cruza con la abertura', () => {
  for (const m of TALLAS_TODAS()) {
    for (const largo of [MEDIDAS.largoFalda.min, 45, 60, MEDIDAS.largoFalda.max]) {
      for (const altCadera of [MEDIDAS.altCadera.min, m.altCadera, MEDIDAS.altCadera.max]) {
        const res = PRENDAS.falda.trazar({ ...m, largoFalda: largo, altCadera });
        const zip = res.piezas[1].lineas.find((l) => l.texto === I18n.t('p.zipEnd'));
        const zipY = Number(zip.d.split(' ')[1]);
        assert.ok(zipY >= altCadera, `cremallera ${zipY} sobre cadera ${altCadera}`);
        const vent = res.piezas[1].lineas.find((l) => l.texto === I18n.t('p.vent'));
        if (vent) assert.ok(Number(vent.d.split(' ')[1]) >= zipY + 10, `abertura pisa la cremallera (largo ${largo})`);
        assert.equal(res.piezas.length, vent ? 4 : 3);
      }
    }
  }
});

test('las costuras que se cosen entre sí casan', () => {
  for (const m of TALLAS_TODAS()) {
    const [fd, fe] = PRENDAS.falda.trazar(m).piezas;
    assert.ok(Math.abs(fd.outline.largo(1, 2) - fe.outline.largo(1, 2)) < 0.1, 'costados de falda');
    const [pd, pt] = PRENDAS.pantalon.trazar(m).piezas;
    assert.ok(Math.abs(pd.outline.largo(7, 8) - pt.outline.largo(7, 8)) < 0.5, 'costados de pantalón');
    const entre = pd.outline.largo(3, 4) - pt.outline.largo(3, 4);
    assert.ok(entre >= 0 && entre < 1.5, `entrepierna: el trasero se estira hasta ${entre}`);
    const [ce, cd] = PRENDAS.cuerpo.trazar(m).piezas;
    assert.ok(Math.abs(ce.outline.largo(1) - cd.outline.largo(1) - 1) < 0.01, 'hombro espalda = delantero + 1 cm de embebido');
  }
});

test('la sisa del cuerpo lleva piquetes que casan con la manga', () => {
  const [ce, cd, manga] = PRENDAS.cuerpo.trazar(tallaBase(40)).piezas;
  const n = (pz) => pz.lineas.filter((l) => l.tipo === 'piquete').length;
  assert.equal(n(ce), 2);
  assert.equal(n(cd), 2); // sisa + punto de busto
  assert.equal(n(manga), 4); // copa + doble trasero + sencillo delantero
});

test('el escote de la camiseta pasa por la cabeza y la tira es el 85 % del escote real', () => {
  for (const m of TALLAS_TODAS()) {
    const [esp, del, , tira] = PRENDAS.camiseta.trazar(m).piezas;
    const escote = 2 * (esp.outline.largo(0) + del.outline.largo(0));
    assert.ok(escote >= m.cuello + 7, `escote ${escote} para cuello ${m.cuello}`);
    assert.ok(Math.abs(largoX(tira) - escote * 0.85) < 0.01, `tira ${largoX(tira)} ≠ 85 % de ${escote}`);
  }
});

test('cada prenda tiene tutorial con sus textos y los bordes reales del patrón', () => {
  const { tutorial, TUTORIALES } = globalThis.Percha;
  assert.deepEqual(Object.keys(TUTORIALES).sort(), Object.keys(PRENDAS).sort());
  I18n.setLang('es');
  const opcionales = new Set(['pinzas', 'abertura']);
  for (const id of Object.keys(PRENDAS)) {
    I18n.setLang('es');
    const piezas = PRENDAS[id].trazar(tallaBase(38)).piezas;
    // Cada borde nombrado existe en su pieza (salvo los que dependen de la talla)
    const spec = TUTORIALES[id];
    const porId = {};
    for (const e of [...spec.fila, ...spec.extra]) { porId[e.id] = e; porId[`${e.id}~`] = e; }
    for (const grupos of spec.pasos) {
      for (const g of grupos) {
        for (const [pid, borde] of g) {
          const pz = piezas[porId[pid].i];
          if (!opcionales.has(borde)) assert.ok(pz && pz.bordes && pz.bordes[borde], `${id}: ${pid}.${borde}`);
        }
      }
    }
    // Mismo número de pasos que el orden de costura de las notas
    const sew = PRENDAS[id].trazar(tallaBase(38)).notas.find((n) => n.startsWith('Orden de costura'));
    assert.equal(spec.pasos.length, (sew.match(/\d\)/g) || []).length, `${id}: pasos`);
    for (const code of I18n.idiomas) {
      I18n.setLang(code);
      for (const m of [tallaBase(34), tallaBase(54), tallaBaseHombre(60)]) {
        const r = tutorial(id, m);
        assert.ok(!/NaN|Infinity|undefined/.test(r.svg), `${code} ${id}`);
        assert.equal(r.steps.length, spec.pasos.length);
        for (const st of r.steps) for (const g of st.grupos) for (const p of g.partes) {
          assert.ok(I18n._dicts[code][p.pieza], `${code}: ${p.pieza}`);
          assert.ok(I18n._dicts[code][`tut.e.${p.borde.replace(/\d$/, '')}`], `${code}: borde ${p.borde}`);
        }
      }
      const claves = ['title', 'lead', 's0.d', 'mat1', 'mat2'];
      for (let n = 1; n <= spec.pasos.length; n++) claves.push(`s${n}.t`, `s${n}.d`);
      for (const c of claves) assert.ok(I18n._dicts[code][`tut.${id}.${c}`], `${code}: tut.${id}.${c}`);
    }
  }
  I18n.setLang('es');
});

test('las piezas al doblez se despliegan en el tutorial', () => {
  const r = globalThis.Percha.tutorial('camiseta', tallaBase(40));
  const del = PRENDAS.camiseta.trazar(tallaBase(40)).piezas[1];
  const veces = r.svg.split(`d="${del.outline}"`).length - 1;
  assert.ok(veces >= 2, 'delantero sin su mitad en espejo');
  assert.ok(r.svg.includes('stroke-dasharray="1.2 0.4 0.2 0.4"'), 'sin línea de doblez');
});

test('las claves usadas en el HTML existen en el diccionario', () => {
  const dict = I18n._dicts.es;
  for (const f of ['index.html', 'herramienta.html', 'glosario.html', 'tutorial.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    const keys = new Set();
    for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) keys.add(m[1]);
    for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
      for (const part of m[1].split(',')) keys.add(part.split(':')[1].trim());
    }
    for (const k of keys) assert.ok(k in dict, `${f}: falta ${k}`);
  }
});

console.log(`\n${ok} pruebas superadas`);
