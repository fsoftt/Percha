# Arquitectura de Percha

Percha es un sitio estático con dos páginas y dos scripts propios:

| Archivo | Responsabilidad |
| --- | --- |
| `assets/js/patrones.js` | Motor de patronaje. Define las medidas (`MEDIDAS`), las prendas (`PRENDAS`), las tallas de referencia (`tallaBase`) y genera el SVG (`generar`). No toca el DOM y funciona también en Node. |
| `assets/js/i18n.js` | Traducciones: detecta el idioma, aplica los atributos `data-i18n*` del HTML y expone `t()` y `num()`. |
| `assets/js/lang/*.js` | Un diccionario por idioma. `es.js` es la referencia. |
| `assets/js/app.js` | Interfaz: selector de prenda, formulario, validación, vista previa con zoom, guardado en `localStorage` y exportación a SVG/PDF. |

## Flujo de datos

```
medidas (cm) ──► PRENDAS[id].trazar(medidas) ──► { piezas, notas }
                                                    │
                                generar() ◄─────────┘
                                   │  coloca las piezas, añade cabecera y cuadro de control
                                   ▼
                       SVG 1:1 (viewBox en cm, width/height en "cm")
                                   │
             ┌─────────────────────┼──────────────────────┐
             ▼                     ▼                      ▼
       vista previa          Descargar SVG       jsPDF + svg2pdf.js
       (zoom en px/cm)                           (mosaico A4/Carta o plóter)
```

## Sistema de coordenadas

- Unidades: **centímetros**. Eje X a la derecha, eje Y hacia abajo.
- En las piezas que se cortan **al doblez**, el doblez es siempre el eje `x = 0` y la pieza queda en `x ≥ 0`. Así el margen de costura se recorta en ese borde con un `clipPath`.

## Modelo de una pieza

```js
{
  nombre: 'Falda · Delantero',
  corte: 'Cortar 1 al doblez',
  doblez: true,                 // el borde x=0 va al doblez de la tela
  outline: Path,                // contorno cerrado (línea de costura)
  lineas: [                     // líneas interiores
    { d: 'M… L…', tipo: 'pinza' },
    { d: 'M… L…', tipo: 'guia', texto: 'Línea de cadera', at: {x, y} },
    { d: 'M… L…', tipo: 'piquete' },
  ],
  hilo: { x, y1, y2 },          // línea de hilo vertical (o { x: null, y, x1, x2 } horizontal)
  etiqueta: { x, y },           // posición del nombre de la pieza
  compacta: false,              // etiqueta pequeña para piezas estrechas
}
```

`Path` es un pequeño constructor con `M`, `L`, `C` y `Z` que además guarda puntos muestreados (para calcular la caja envolvente) y la longitud acumulada (útil, por ejemplo, para que la copa de la manga iguale la sisa).

Ayudantes disponibles: `P(x, y)`, `dist`, `lerp`, `clamp`, `onLineAtY`, `cubicLen`, `dart(a, vértice, b)`, `guide(a, b, texto)`, `notch(p, dirección)`.

## Margen de costura

Se dibuja el contorno con un trazo de `2 × margen` (borde coral exterior + relleno claro) y encima la pieza en blanco. El resultado visual es una banda del ancho del margen alrededor de la línea de costura; la línea exterior es la de corte. En piezas al doblez la banda se recorta en `x < 0`.

## Exportación a PDF

`app.js` usa [jsPDF](https://github.com/parallax/jsPDF) y [svg2pdf.js](https://github.com/yWorks/svg2pdf.js), incluidos en `assets/vendor/`:

- **Mosaico**: elige la orientación (vertical u horizontal) que necesite menos hojas. Cada hoja tiene 10 mm de margen de impresión y 1 cm de solape. Para cada hoja se crea un SVG con un `viewBox` que recorta la zona correspondiente del patrón, más una capa con la etiqueta (A1, B2…), la línea de solape y rombos de alineación. La primera página es la hoja de montaje con instrucciones y un mapa.
- **Plóter**: una sola página con el tamaño exacto del patrón.

## Añadir una prenda nueva

1. **Medidas.** Si necesitas medidas nuevas, añádelas a `MEDIDAS` con `label`, `ayuda`, `min` y `max`, y dales un valor en `tallaBase()`.
2. **Función de trazado.** Escribe una función pura que reciba las medidas y devuelva `{ piezas, notas }`:

   ```js
   function vestidoTubo(m) {
     const piezas = [];
     const w = (m.cadera + 4) / 4;
     const contorno = new Path()
       .M(P(0, 0)).L(P(w, 0)).L(P(w, m.largo)).L(P(0, m.largo)).Z();
     piezas.push({
       nombre: 'Vestido · Delantero', corte: 'Cortar 1 al doblez', doblez: true,
       outline: contorno, lineas: [],
       hilo: { x: w / 2, y1: 10, y2: m.largo - 10 }, etiqueta: P(w / 2, 20),
     });
     return { piezas, notas: ['Holgura: 4 cm en cadera.'] };
   }
   ```

3. **Registro.** Añádela a `PRENDAS`:

   ```js
   vestido: { nombre: 'Vestido tubo', resumen: 'Delantero y espalda', medidas: ['pecho', 'cintura', 'cadera', 'largo'], trazar: vestidoTubo },
   ```

4. **Icono.** Añade un SVG de 48 × 48 en `ICONOS` dentro de `app.js` (y una tarjeta en `index.html` si quieres mostrarla en la landing).
5. **Pruebas.** `npm test` recorre automáticamente todas las prendas con todas las tallas y con valores extremos.
6. **Verificación.** Exporta un PDF, imprímelo al 100 % y mide el cuadro de control y alguna línea clave (por ejemplo, el ancho de cadera).

## Internacionalización

- Las cadenas viven en `assets/js/lang/<código>.js` como un objeto plano `clave → texto`, registrado con `PerchaI18n.add(código, { nombre, locale }, dict)`.
- Interpolación con llaves: `'chip.measures': '{n} medidas'` → `t('chip.measures', { n: 4 })`.
- En el HTML:
  - `data-i18n="clave"` reemplaza el texto del elemento.
  - `data-i18n-html="clave"` reemplaza el HTML (solo para textos propios con `<b>`, `<br>`…).
  - `data-i18n-attr="aria-label:clave,title:otra"` traduce atributos.
  - `data-i18n-args='{"n":4}'` pasa parámetros.
  - `<select data-lang-switch>` se convierte en el selector de idioma.
- El motor de patrones usa `tr()` para todos los textos que se imprimen (nombres de pieza, «Cortar 2», notas…) y `fmtN()` para formatear números según el idioma (`20,7` / `20.7`).
- Orden de detección: parámetro `?lang=`, preferencia guardada en `localStorage`, idiomas del navegador y, por último, español.
- El texto del HTML está en español por defecto, así la página se lee aunque JavaScript falle.
- Los PDF usan las fuentes estándar de jsPDF (codificación WinAnsi): cubren los idiomas de Europa occidental. Para alfabetos no latinos habría que incrustar una fuente TTF con `doc.addFont`.

## Añadir un idioma

1. Copia `assets/js/lang/es.js` a `assets/js/lang/<código>.js` (por ejemplo `it.js`).
2. Cambia la primera línea: `PerchaI18n.add('it', { nombre: 'Italiano', locale: 'it-IT' }, { … })`.
3. Traduce todos los valores. No cambies las claves ni los marcadores `{n}`, `{w}`…
4. Añade `<script src="assets/js/lang/it.js" defer></script>` en `index.html` y `herramienta.html`, junto a los demás idiomas (y un `<link rel="alternate" hreflang="it">` en la landing).
5. Ejecuta `npm test`: comprueba que el idioma tiene exactamente las mismas claves que `es.js` y los mismos parámetros.
6. Revisa la web en móvil: algunos idiomas son más largos y pueden necesitar textos más cortos en botones.
