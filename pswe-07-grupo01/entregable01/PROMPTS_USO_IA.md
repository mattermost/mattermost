# Registro de prompts de apoyo: Entregable 1

Este archivo reúne versiones normalizadas de prompts utilizados durante el análisis y la redacción del Entregable 1. Se documentan para dar trazabilidad al uso de IA y permitir su reutilización.

## 1. Evaluar si un issue es apto para el proyecto

```text
Analice el issue de software disponible en:

<URL_DEL_ISSUE>

Considere en su totalidad la consigna del proyecto ubicada en:

<RUTA_AL_PDF_DEL_PROYECTO>

Determine si el issue tiene un alcance apropiado para un proyecto de maestría
del curso Procesos de Ingeniería de Software. Evalúe, como mínimo:

- alineación con los objetivos y entregables del curso;
- tamaño y viabilidad para un equipo de tres personas;
- complejidad técnica y partes del sistema potencialmente afectadas;
- oportunidades para aplicar planificación, estimación, gestión de riesgos,
  requisitos, diseño, pruebas, control de versiones, CI/CD y mejora continua;
- riesgos, dependencias e incertidumbres;
- evidencia que debería capturarse antes y después del cambio;
- alcance recomendado y exclusiones explícitas.

No implemente la solución. Concluya con uno de estos dictámenes: apto, apto con
ajustes de alcance o no apto, y justifique la decisión con referencias concretas
al issue y a la consigna.
```

## 2. Revisar coherencia del plan y del documento

```text
Revise <RUTA_ENTREGABLE_UNIFICADO> contra la consigna del proyecto y el calendario
oficial del curso. Actúe como revisor académico de una maestría en ingeniería de
software.

Compruebe que:

- los hitos coincidan con los avances de las semanas 6 y 11 y la entrega final de
  la semana 14;
- cada actividad tenga un responsable identificable y un revisor diferente;
- exista trazabilidad entre issues, incrementos, criterios, tareas, pruebas y
  evidencia;
- las métricas tengan definición, fuente y meta inicial;
- el diagrama C4 sea realmente de nivel contexto y no incluya componentes internos;
- las afirmaciones estén respaldadas y no se presenten supuestos como resultados.

Devuelva primero los hallazgos ordenados por impacto y después una propuesta de
redacción mínima para corregirlos. Mantenga el documento claro, conciso y dentro
del límite de extensión indicado por la consigna.
```

## 3. Preparar un ambiente de desarrollo reproducible

```text
Prepare una guía reproducible para configurar y ejecutar el repositorio ubicado en
<RUTA_AL_REPOSITORIO>. Use como referencia la guía oficial de desarrollo de
Mattermost y verifique en el repositorio las versiones requeridas de Go, Node.js y
demás herramientas antes de recomendar comandos.

El ambiente objetivo es Windows con WSL2, Ubuntu, VS Code conectado a WSL y Docker
Engine ejecutándose dentro de Linux. No use Docker Desktop. Para instalar Docker,
remita a la documentación oficial de Ubuntu e incluya la posinstalación necesaria
para que el usuario Linux pueda ejecutar Docker sin sudo, explicando el riesgo del
grupo docker.

La guía debe cubrir:

- requisitos y validaciones previas;
- clonación del fork y fijación del commit base;
- instalación y comprobación de versiones;
- puertos o servicios locales que puedan generar conflictos;
- build separado del frontend y del servidor;
- inicio, comprobación y detención del ambiente;
- resultado esperado de cada etapa;
- solución de los errores más probables.

No suponga que un comando funcionó: distinga instrucciones de resultados verificados.
Mantenga actualizado un archivo Markdown que pueda seguir otra persona del equipo
desde una máquina nueva.
```
