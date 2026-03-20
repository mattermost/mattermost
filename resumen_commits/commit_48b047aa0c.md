## Commit: 48b047aa0ca78db3da9664ea1409da0f16823677
**Fecha:** Tue Apr 30 18:27:07 2024 +0200

### Descripción de los Cambios
Implementa validación completa para diálogos interactivos (GitHub issue #16199). Agrega métodos `IsValid()` a los modelos de diálogo para validar la estructura antes de abrirlos.

Cambios principales:
1. **Nuevas constantes de validación**:
   - `DialogTitleMaxLength = 24`
   - `DialogElementDisplayNameMaxLength = 24`
   - `DialogElementNameMaxLength = 300`
   - Límites para HelpText, Text, Textarea, Select y Bool

2. **Métodos `IsValid()`**:
   - `OpenDialogRequest.IsValid()`: Valida URL, trigger_id y el diálogo
   - `Dialog.IsValid()`: Valida título (longitud), URL del icono, y elementos duplicados
   - `DialogElement.IsValid()`: Valida según el tipo (text, textarea, select, bool, radio)

3. **Validaciones por tipo de elemento**:
   - **text**: valida subtipos (email, number, tel, url, password), longitudes máximas
   - **textarea**: longitudes máximas diferentes
   - **select**: valida data source (users, channels), valor default en opciones
   - **bool**: valida default (true/false)
   - **radio**: valida que default exista en opciones

4. **Logging**: Agrega advertencia cuando un diálogo inválido se abre (para no romper integraciones existentes)

5. **Tests exhaustivos**: 15+ casos de prueba cubriendo todas las validaciones

### Veredicto del Cambio
A) Cambio útil que mejora/corrige - Implementa validación robusta para API de integraciones
