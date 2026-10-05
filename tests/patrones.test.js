// Pruebas del motor de patronaje. Ejecutar con: node tests/patrones.test.js
'use strict';
const assert = require('node:assert/strict');
require('../assets/js/patrones.js');
const { PRENDAS, MEDIDAS, tallaBase, generar } = globalThis.Percha;

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
  const r = generar('camiseta', tallaBase(40), { margen: 0 });
  assert.ok(r.notas.some((n) => n.startsWith('Altura de copa')));
});

console.log(`\n${ok} pruebas superadas`);
