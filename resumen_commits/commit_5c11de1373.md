## Commit: 5c11de137372682048c50045dd3ebc2eba9e00da
**Fecha:** Tue Apr 30 09:11:55 2024 -0400

### Descripción de los Cambios
Corrige el estilo del checkbox en el modal de "Explorar Canales". Los cambios incluyen:

- Agrega `position: relative` al contenedor del checkbox para mejor posicionamiento
- Añade `border-radius` con variable CSS `--radius-xs` para esquinas redondeadas
- Añade `margin-right` de 6px para separación adecuada
- Define `background-color` usando la variable `--center-channel-bg`
- Mejora el estilo del estado `checked` eliminando el borde cuando está seleccionado
- Posiciona absolutamente el icono SVG del checkbox dentro del contenedor
- Define el color de relleno del SVG usando `--button-bg`

Estos cambios mejoran la consistencia visual y la apariencia del checkbox de "Ocultar canales unidos" en la interfaz de exploración de canales.

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Corrección de estilo visual en la interfaz de usuario
