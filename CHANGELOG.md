# Changelog

## Sin publicar

- Tutoriales animados para todas las prendas (falda, cuerpo, pantalón, camiseta y bóxer) en `tutorial.html`, con una pestaña por prenda y enlace directo `tutorial.html#prenda`. Siguen el orden de costura de cada patrón, con las piezas reales (las de doblez, desplegadas) y los bordes que se cosen juntos marcados con color y letra. El motor es uno solo (`tutorial()` + `TUTORIALES`) y cada pieza declara sus `bordes`.
- Mejoras del bóxer llevadas al resto de prendas:
  - Cinturillas de falda y pantalón medidas sobre la cintura real de la prenda (no con fórmula), con 3 cm de cruce y piquetes de costados y centro.
  - Falda: la cremallera llega a la línea de cadera (18/20/22/25 cm) para que entre al ponérsela; la abertura solo aparece si el largo la necesita y no se cruza con la cremallera.
  - Camiseta: escote más abierto para que pase por la cabeza (≈ cuello + 9 cm) y tira de cuello calculada sobre el escote real (antes usaba otra curva de espalda).
  - Piquetes de cadera en costados (falda y pantalón) y de punta de tiro en el pantalón.
- Revisión de patronaje:
  - Cuerpo: el hombro de la espalda lleva 1 cm de embebido; piquetes de sisa (uno delante, dos detrás) que casan con la manga.
  - Pruebas de costuras que casan entre sí, cinturillas, cremallera y escote en tallas de mujer y hombre.
- Bóxer con suplemento delantero curvo, bragueta con vista y tapeta, y tira para goma.
- Pantalón con bragueta (vista, tapeta y guía de cremallera).
- Camiseta con tira de cuello calculada al 85 % del escote.
- Falda con abertura trasera y vista para el martillo.
- Cuerpo básico con manga de tejido plano (copa ajustada a la sisa).
- Pruebas específicas por prenda (piezas, suplemento, tira de cuello).
- Tabla de tallas masculina 44–60 con selector Mujer/Hombre en la herramienta.
- Pantalón con bolsillos laterales (fondo + abertura) y tira para 5 trabillas.
- Guía de dobladillo del bajo en las 5 prendas, con nota del ancho.
- Estimación de tela por área según el ancho elegido (110/140/150 cm).
- Notas de par en espejo, margen por borde y orden de costura numerado.
- Vistas de Montaje (pasos numerados sobre el patrón) y Boceto (prenda unida, sin escala).
- Página de glosario con 24 conceptos en 4 idiomas, enlazada desde la navegación.
- Página tutorial animada del bóxer en 6 pasos, con tus medidas guardadas.
- El tutorial y el boceto del bóxer usan los contornos reales del patrón en espejo.
- Bolsillos traseros de ojal con vivo en el pantalón (delanteros renombrados para distinguirlos).
- Bóxer: la cintura se corta con la cadera + 6 cm para que entre al ponérselo en tejido plano (antes medía cintura + 8 cm), y la tira de la jareta mide lo mismo que la cintura de la prenda (antes 6 cm menos).
- Bóxer: el centro trasero sube 3 cm (como en el pantalón) para dar largo de tiro al sentarse.
- Los bordes de costura del bóxer y la línea de unión salen del propio contorno del patrón: si se ajusta el patrón, el tutorial se actualiza solo.
- Línea verde «Unir aquí las 2 piezas» en las piezas «Cortar 2» que se cosen entre sí (bóxer, pantalón y espalda de la falda), con su entrada en la leyenda y nota.
- Tutorial del bóxer más claro: piezas extendidas sin solapes, pantalla inicial de corte, bordes que se cosen juntos con el mismo color y letra, costuras ya hechas en punteado, textos de cada paso detallados y dos consejos nuevos.

## 1.1.0 — 2026-10-05

- Multilenguaje: español, inglés, francés y portugués.
- Se traducen la landing, la herramienta, los textos del patrón (piezas, cortes, notas) y la hoja de montaje del PDF.
- Detección automática del idioma del navegador, selector en la cabecera y parámetro `?lang=`.
- Números formateados según el idioma.
- Pruebas que verifican que todos los idiomas tienen las mismas claves y parámetros.

## 1.0.0 — 2026-10-05

- Primera versión pública.
- Prendas: falda recta, cuerpo básico, pantalón básico y camiseta.
- Tallas de referencia 34–54 y validación de medidas.
- Margen de costura opcional (0, 1 y 1,5 cm), sin margen en bordes al doblez.
- Exportación a PDF en mosaico (A4 y Carta) con hoja de montaje, PDF de plóter y SVG 1:1.
- Landing page y herramienta responsive con modo oscuro.
