<p align="center">
  <img src="assets/img/favicon.svg" width="72" alt="Logo de Percha">
</p>

<h1 align="center">percha.</h1>

<p align="center">
  <b>Patronaje a medida, libre y gratuito.</b><br>
  Introduce tus medidas y obtén un patrón de costura a escala real, listo para imprimir en PDF.
</p>

<p align="center">
  <a href="https://fsoftt.github.io/Percha/">Web</a> ·
  <a href="https://fsoftt.github.io/Percha/herramienta.html">Herramienta</a> ·
  <a href="docs/ARQUITECTURA.md">Arquitectura</a> ·
  <a href="CONTRIBUTING.md">Contribuir</a>
</p>

<p align="center">
  <img alt="Licencia MIT" src="https://img.shields.io/badge/licencia-MIT-D4FF3A?labelColor=14101F">
  <img alt="Sin dependencias de build" src="https://img.shields.io/badge/build-ninguno-FF4D2E?labelColor=14101F">
  <img alt="100% en el navegador" src="https://img.shields.io/badge/100%25-navegador-6A3DF0?labelColor=14101F">
</p>

---

## ¿Qué es Percha?

Percha es una aplicación web estática que genera **patrones base de costura** a partir de las medidas de una persona. Aplica reglas clásicas de patronaje (holguras, pinzas, profundidad de sisa, cruce de tiro…) y dibuja cada pieza a **escala 1:1** en SVG. Desde el navegador se puede exportar a:

- **PDF en mosaico** (A4 o Carta) con hoja de montaje, hojas numeradas, solape de 1 cm y marcas de unión.
- **PDF de plóter** en una sola página del tamaño del patrón.
- **SVG vectorial** con unidades en centímetros.

Todo ocurre en el navegador: no hay servidor, cuentas ni seguimiento. Las medidas se guardan solo en `localStorage`.

### Prendas disponibles

| Prenda | Medidas | Piezas |
| --- | --- | --- |
| Falda recta | cintura, cadera, altura de cadera, largo | delantero (al doblez), espalda, cinturilla |
| Cuerpo básico | pecho, cintura, talles delantero y espalda, ancho de espalda, hombro, cuello, altura y separación de busto | delantero y espalda con pinzas de busto y cintura |
| Pantalón básico | cintura, cadera, tiro, largo, contorno de bajo | delantero, trasero, cinturilla |
| Camiseta | pecho, ancho de hombros, cuello, largo, largo de manga, brazo | delantero, espalda, manga con copa ajustada a la sisa |

## Uso

1. Abre la [herramienta](https://fsoftt.github.io/Percha/herramienta.html).
2. Elige la prenda y, si quieres, una talla de referencia (34–54).
3. Ajusta las medidas en centímetros. El botón **?** de cada campo explica cómo medir.
4. Elige el margen de costura (0, 1 o 1,5 cm) y el papel.
5. Pulsa **Exportar PDF** e imprime al **100 % / tamaño real**. Comprueba el cuadro de control de 10 × 10 cm.

> ⚠️ Son bloques base trazados con métodos clásicos simplificados. Haz siempre una prueba (toile) en tela barata antes de cortar la tela definitiva.

## Desarrollo local

No hay paso de compilación. Solo necesitas un servidor estático:

```bash
git clone https://github.com/fsoftt/Percha.git
cd Percha
npm start            # equivale a: python3 -m http.server 8000
# abre http://localhost:8000
```

Pruebas del motor de patronaje (Node 18+ sin dependencias):

```bash
npm test
```

### Estructura

```
.
├── index.html               # Landing page
├── herramienta.html         # Herramienta
├── assets/
│   ├── css/styles.css       # Estilos compartidos (tokens de color, modo oscuro, responsive)
│   ├── js/patrones.js       # Motor de patronaje: medidas, prendas, trazado y SVG
│   ├── js/app.js            # Interfaz: formulario, vista previa, zoom, exportación PDF/SVG
│   ├── vendor/              # jsPDF y svg2pdf.js (MIT), incluidos para no depender de CDNs
│   └── img/favicon.svg
├── tests/patrones.test.js   # Pruebas con node:assert
└── docs/ARQUITECTURA.md     # Cómo funciona el motor y cómo añadir prendas
```

## Publicar en GitHub Pages

1. En GitHub, ve a **Settings → Pages**.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Selecciona la rama `main` y la carpeta `/ (root)`. Guarda.
4. En unos minutos la web estará en `https://<usuario>.github.io/Percha/`.

El archivo `.nojekyll` evita que GitHub procese el sitio con Jekyll.

## Contribuir

¡Las contribuciones son bienvenidas! Nuevas prendas, mejoras de ajuste, traducciones, accesibilidad… Lee [CONTRIBUTING.md](CONTRIBUTING.md) y la guía para [añadir una prenda](docs/ARQUITECTURA.md#añadir-una-prenda-nueva). Este proyecto sigue un [código de conducta](CODE_OF_CONDUCT.md).

## Hoja de ruta

- [ ] Manga para el cuerpo básico
- [ ] Vestido y falda evasé derivados de los bloques
- [ ] Medidas en pulgadas
- [ ] Interfaz en inglés y otros idiomas
- [ ] Tallas de referencia de hombre e infantiles
- [ ] Exportar a DXF para software CAD textil

## Licencia

[MIT](LICENSE) © Percha contributors. Incluye [jsPDF](https://github.com/parallax/jsPDF) y [svg2pdf.js](https://github.com/yWorks/svg2pdf.js), ambos bajo licencia MIT (ver `assets/vendor/`).
