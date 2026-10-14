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
