# Cómo contribuir a Percha

¡Gracias por tu interés! Percha es un proyecto pequeño y sin compilación, así que empezar es fácil.

## Formas de ayudar

- **Probar patrones**: cose una toile y cuéntanos cómo ajusta. Abre un issue con tus medidas (si quieres compartirlas), la prenda y qué corregirías.
- **Reportar errores** con la plantilla de *bug*.
- **Proponer o programar prendas nuevas** (ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md#añadir-una-prenda-nueva)).
- **Mejorar la interfaz**, la accesibilidad o la documentación.
- **Traducir** la web y la herramienta.

## Flujo de trabajo

1. Haz un fork y crea una rama: `git checkout -b prenda/vestido-tubo`.
2. Arranca un servidor local: `npm start` y abre `http://localhost:8000`.
3. Haz tus cambios. Si tocas `assets/js/patrones.js`, ejecuta `npm test`.
4. Comprueba la herramienta en móvil (≈ 390 px) y escritorio, y exporta un PDF para verificar la escala.
5. Abre un pull request describiendo qué cambia y, si es una prenda, adjunta una captura del patrón.

## Convenciones

- JavaScript plano (ES2018+), sin dependencias de compilación. Nada de frameworks.
- Todo el texto visible está en español. Los nombres internos pueden estar en español (como el resto del código).
- Coordenadas del motor en **centímetros**, eje Y hacia abajo.
- Colores siempre a través de los tokens de `:root` en `styles.css`.
- Mantén las funciones de trazado puras: reciben medidas y devuelven piezas, sin tocar el DOM.

## Criterios para nuevas prendas

- Basadas en un método de patronaje reconocido (indica la referencia en el PR).
- Holguras documentadas en `notas`.
- Indicar en cada pieza el corte (`Cortar 2`, `Cortar 1 al doblez`…), el hilo y las líneas de referencia.
- Que pasen las pruebas de rangos extremos (`npm test`).
