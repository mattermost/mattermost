# Análisis EXACTO de Commits - Mattermost

**Generado:** 2026-03-17 17:57:01
**Total de commits analizados:** 3,677

## 📊 Resumen Ejecutivo

### Distribución por Tipo

| Tipo | Descripción | Cantidad | Porcentaje |
|------|-------------|----------|------------|
| **A** | Cambios útiles que mejoran/corrigen | 1,894 | 51.51% |
| **B** | Cambios de marca/Enterprise/licencias | 1,783 | 48.49% |
| **Total** | | **3,677** | **100%** |

## 📈 Estadísticas por Categoría

| Categoría | Total | Tipo A | Tipo B | Descripción |
|-----------|-------|--------|--------|-------------|
| mobile | 2,265 | 1,212 | 1,053 | App móvil |
| enterprise | 2,246 | 463 | 1,783 | Licencias, branding, enterprise |
| tests | 1,664 | 884 | 780 | Tests (unit, e2e, cypress, playwright) |
| api | 1,395 | 387 | 1,008 | Cambios en API |
| i18n | 1,183 | 297 | 886 | Traducciones, internacionalización |
| ci_cd | 1,031 | 703 | 328 | GitHub Actions, pipelines |
| ui_ux | 568 | 308 | 260 | Mejoras de interfaz |
| plugins | 303 | 144 | 159 | Prepackage, plugins |
| feature | 290 | 173 | 117 | Nuevas funcionalidades |
| dependencies | 279 | 192 | 87 | Actualizaciones de dependencias |
| docs | 222 | 125 | 97 | Documentación |
| security | 164 | 84 | 80 | Mejoras de seguridad |
| bugfix | 159 | 118 | 41 | Correcciones de bugs |
| other | 45 | 45 | 0 | Otros cambios |
| performance | 44 | 35 | 9 | Optimizaciones |
| refactor | 18 | 16 | 2 | Refactorización de código |

## 🌟 Top 10 Commits Tipo A (Más Importantes)

Estos son los commits más significativos que mejoran o corrigen la aplicación:

### 1. Commit `539daee63447f6a18f56d86a952563e85296fb93`
- **Tipo:** A
- **Categorías:** bugfix, security, ci_cd, mobile
- **Importancia:** 80/100
- **Descripción:** Corrige los tipos TypeScript para permitir que el store retorne canales `undefined`. Cambios principales: - Actualiza selectores de canales para retor...

### 2. Commit `0cee332001a0b9a8589349624ed7c286e38bd984`
- **Tipo:** A
- **Categorías:** bugfix, feature, tests, ci_cd, i18n, ui_ux, api, mobile
- **Importancia:** 70/100
- **Descripción:** Corrige un bug crítico en entornos HA (High Availability) donde el estado del usuario se establecía incorrectamente como "offline" sin verificar conex...

### 3. Commit `3bd6c444133a717a8de1e109029f10007df13fc6`
- **Tipo:** A
- **Categorías:** bugfix, security, ci_cd, enterprise
- **Importancia:** 70/100
- **Descripción:** Corrige un tipo incorrecto en el componente `desktop_auth_token.tsx`. El callback `onLogin` tenía la firma incorrecta `(userProfile: UserProfile) => v...

### 4. Commit `43a5e61d8552933aa14916ebad26371d5924c9e8`
- **Tipo:** A
- **Categorías:** bugfix, refactor, performance, tests, ci_cd, api, mobile
- **Importancia:** 70/100
- **Descripción:** Corrige un bug en el componente de autocompletado (SuggestionBox) donde ocasionalmente se borraba todo el texto después del cursor al usar autocomplet...

### 5. Commit `71c25fb316cfcda9b9af09df9318e153d5e7e66a`
- **Tipo:** A
- **Categorías:** bugfix, security, enterprise
- **Importancia:** 70/100
- **Descripción:** Corrige permisos de subida de archivos Mensaje original: MM-58525 Fix upload file permissions (#27298)...

### 6. Commit `77ab7b92c6de08832011104d85af97573ccd6121`
- **Tipo:** A
- **Categorías:** feature, security, tests, i18n, mobile
- **Importancia:** 70/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** ayush-chauhan233 <ayush.chauhan@brightscout.com> **Archivos modificados:** - `.../system_console/su...

### 7. Commit `10a59619c7b3e05ba1588369694547d203b12166`
- **Tipo:** A
- **Categorías:** bugfix, feature, tests, ci_cd, i18n
- **Importancia:** 65/100
- **Descripción:** Corrige el flag `--bypass-upload` en modo HA (High Availability). Anteriormente, este flag podía causar problemas porque no había garantía de que el s...

### 8. Commit `133bd5c2cb15724f9820b371690a73cc8a8c6495`
- **Tipo:** A
- **Categorías:** feature, security
- **Importancia:** 65/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Caleb Roseland <caleb@calebroseland.com> **Archivos modificados:** - `.../secure_connections/modals...

### 9. Commit `8f9d1b802c`
- **Tipo:** A
- **Categorías:** security, performance, ci_cd, api, mobile
- **Importancia:** 65/100
- **Descripción:** [MM-58263] Remueve la verificación CSRF del endpoint /api/v4/client_perf. Cambios principales: - Elimina la verificación de token CSRF para el endpoin...

### 10. Commit `92339d03aba98e08646a504bd461627cedfd0fb2`
- **Tipo:** A
- **Categorías:** feature, security, ci_cd, ui_ux
- **Importancia:** 65/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Matthew Birtch <mattbirtch@gmail.com> **Archivos modificados:** - `.../secure_connections/building....

## 🏢 Top 10 Commits Tipo B (Enterprise/Licencias)

Estos son los commits relacionados con marca, licencias y funcionalidades Enterprise:

### 1. Commit `7ea7b3384fccc50fa1f8145fcdcc0a7cdea85012`
- **Tipo:** B
- **Categorías:** bugfix, feature, security, docs, i18n, ui_ux, enterprise, mobile
- **Importancia:** 70/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Matthew Birtch <mattbirtch@gmail.com> **Archivos modificados:** - `.../src/components/access_proble...

### 2. Commit `eb967b6b6dfd16176117e79a1884d18f497890ca`
- **Tipo:** B
- **Categorías:** bugfix, feature, security, tests, i18n, api, enterprise, mobile
- **Importancia:** 70/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Ben Cooke <benkcooke@gmail.com> **Archivos modificados:** - `api/v4/source/users.yaml` - `.../playw...

### 3. Commit `f1b9aa052e821701c9184e16337558f96b8755f4`
- **Tipo:** B
- **Categorías:** bugfix, security, tests, ui_ux, enterprise
- **Importancia:** 55/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Maria A Nunez <maria.nunez@mattermost.com> **Archivos modificados:** - `.../playwright/lib/src/serv...

### 4. Commit `5d3a04760b83fae43abc9e4aabf7ef1de54c7770`
- **Tipo:** B
- **Categorías:** bugfix, security, tests, i18n, api, enterprise, mobile
- **Importancia:** 50/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Nick Misasi <nick.misasi@mattermost.com> **Archivos modificados:** - `.../playwright/lib/src/server...

### 5. Commit `731cc1fb5fd9d23e449305b02d2e06a4d10c1919`
- **Tipo:** B
- **Categorías:** bugfix, security, tests, i18n, enterprise, mobile
- **Importancia:** 50/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Elias Nahum <nahumhbl@gmail.com> **Archivos modificados:** - `.../playwright/lib/src/server/default...

### 6. Commit `74258c3b7a2a3df71f6bd3884bc413df5ba69fbc`
- **Tipo:** B
- **Categorías:** bugfix, security, tests, i18n, ui_ux, api, enterprise, mobile
- **Importancia:** 50/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Devin Binnie <52460000+devinbinnie@users.noreply.github.com> **Archivos modificados:** - `.../playw...

### 7. Commit `7999239ccfd7cdcccdb23c877bd18de06491b1bd`
- **Tipo:** B
- **Categorías:** feature, security, tests, ui_ux, api, enterprise, mobile
- **Importancia:** 50/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Daniel Espino García <larkox@gmail.com> **Archivos modificados:** - `e2e-tests/cypress/tests/suppor...

### 8. Commit `91dfcbbdd17b66c31a5a7fa5fd6ed42ef3d04e3c`
- **Tipo:** B
- **Categorías:** feature, security, tests, i18n, api, enterprise, mobile
- **Importancia:** 50/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Nick Misasi <nick.misasi@mattermost.com> **Archivos modificados:** - `e2e-tests/cypress/tests/suppo...

### 9. Commit `049f954b7f498342a76e6afca297db5eed4a88b6`
- **Tipo:** B
- **Categorías:** feature, security, tests, i18n, enterprise, mobile
- **Importancia:** 45/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Maria A Nunez <maria.nunez@mattermost.com> **Archivos modificados:** - `.../system_console/openid/o...

### 10. Commit `37a9a30f4082291c3a8811ef0f43f4cd526909e9`
- **Tipo:** B
- **Categorías:** feature, security, tests, i18n, api, enterprise
- **Importancia:** 45/100
- **Descripción:** Commit:     GitHub <noreply@github.com> **Autor:** Pablo Vélez <pablovv2012@gmail.com> **Archivos modificados:** - `api/v4/source/users.yaml` - `serve...

## 🔍 Análisis Detallado

### Comparativa Tipo A vs Tipo B

- **Ratio A/B:** 51.5% de los commits son cambios útiles
- **Ratio B/A:** 48.5% de los commits son cambios de marca/enterprise

### Distribución de Categorías en Tipo A

- **mobile:** 1,212 commits (64.0% del Tipo A)
- **enterprise:** 463 commits (24.4% del Tipo A)
- **tests:** 884 commits (46.7% del Tipo A)
- **api:** 387 commits (20.4% del Tipo A)
- **i18n:** 297 commits (15.7% del Tipo A)
- **ci_cd:** 703 commits (37.1% del Tipo A)
- **ui_ux:** 308 commits (16.3% del Tipo A)
- **plugins:** 144 commits (7.6% del Tipo A)
- **feature:** 173 commits (9.1% del Tipo A)
- **dependencies:** 192 commits (10.1% del Tipo A)
- **docs:** 125 commits (6.6% del Tipo A)
- **security:** 84 commits (4.4% del Tipo A)
- **bugfix:** 118 commits (6.2% del Tipo A)
- **other:** 45 commits (2.4% del Tipo A)
- **performance:** 35 commits (1.8% del Tipo A)
- **refactor:** 16 commits (0.8% del Tipo A)

### Distribución de Categorías en Tipo B

- **mobile:** 1,053 commits (59.1% del Tipo B)
- **enterprise:** 1,783 commits (100.0% del Tipo B)
- **tests:** 780 commits (43.7% del Tipo B)
- **api:** 1,008 commits (56.5% del Tipo B)
- **i18n:** 886 commits (49.7% del Tipo B)
- **ci_cd:** 328 commits (18.4% del Tipo B)
- **ui_ux:** 260 commits (14.6% del Tipo B)
- **plugins:** 159 commits (8.9% del Tipo B)
- **feature:** 117 commits (6.6% del Tipo B)
- **dependencies:** 87 commits (4.9% del Tipo B)
- **docs:** 97 commits (5.4% del Tipo B)
- **security:** 80 commits (4.5% del Tipo B)
- **bugfix:** 41 commits (2.3% del Tipo B)
- **performance:** 9 commits (0.5% del Tipo B)
- **refactor:** 2 commits (0.1% del Tipo B)

---

*Este análisis fue generado automáticamente por `generate_exact_stats.py`*