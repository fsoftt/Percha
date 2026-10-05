<p align="center">
  <img src="assets/img/favicon.svg" width="72" alt="Percha logo">
</p>

<h1 align="center">percha.</h1>

<p align="center">
  <b>Made-to-measure sewing patterns, free and open source.</b><br>
  Enter your measurements and get a true-scale sewing pattern, ready to print as a PDF.
</p>

<p align="center">
  <a href="README.md">🇪🇸 Español</a> · 🇬🇧 English
</p>

---

## What is Percha?

Percha is a static web app that drafts **basic sewing blocks** from body measurements. It applies classic pattern-drafting rules (ease, darts, armhole depth, crotch extension…) and draws every piece at **1:1 scale** as SVG. From the browser you can export:

- A **tiled PDF** (A4 or Letter) with an assembly page, numbered sheets, 1 cm overlap and matching marks.
- A **plotter PDF** on a single page the size of the pattern.
- A **vector SVG** with units in centimetres.

Available in **Spanish, English, French and Portuguese** — the website, the tool and the text printed on the pattern and PDF. The language is detected from the browser, can be changed with the selector, or forced with `?lang=en`.

Everything runs in the browser: no server, no accounts, no tracking. Measurements are only stored in `localStorage`.

### Garments

| Garment | Measurements | Pieces |
| --- | --- | --- |
| Straight skirt | waist, hips, waist-to-hip, length | front (on fold), back, waistband |
| Basic bodice | bust, waist, front and back length, back width, shoulder, neck, bust height and span | front and back with bust and waist darts |
| Basic trousers | waist, hips, crotch depth, length, hem width | front, back, waistband |
| T-shirt | bust, shoulder width, neck, length, sleeve length, upper arm | front, back, sleeve with cap matched to the armhole |

## Usage

1. Open the [tool](https://fsoftt.github.io/Percha/herramienta.html?lang=en).
2. Pick a garment and, optionally, a reference size (EU 34–54).
3. Adjust the measurements in centimetres. The **?** button on each field explains how to measure.
4. Choose the seam allowance (0, 1 or 1.5 cm) and paper size.
5. Click **Export PDF** and print at **100% / actual size**. Check the 10 × 10 cm test square.

> ⚠️ These are basic blocks drafted with simplified classic methods. Always make a test garment (toile) before cutting your final fabric.

## Local development

No build step. You only need a static server:

```bash
git clone https://github.com/fsoftt/Percha.git
cd Percha
npm start            # same as: python3 -m http.server 8000
npm test             # drafting engine and translation tests (Node 18+, no dependencies)
```

## Contributing

Contributions are welcome — new garments, fit improvements, translations, accessibility… See [CONTRIBUTING.md](CONTRIBUTING.md) (in Spanish) and the architecture guide in [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md), which explains how to [add a garment](docs/ARQUITECTURA.md#añadir-una-prenda-nueva) or [add a language](docs/ARQUITECTURA.md#añadir-un-idioma). Issues and pull requests in English are perfectly fine.

## License

[MIT](LICENSE) © Percha contributors. Bundles [jsPDF](https://github.com/parallax/jsPDF) and [svg2pdf.js](https://github.com/yWorks/svg2pdf.js), both MIT-licensed.
