## Commit: f1019d076edd5b7b42f2c61c630c3ad4620383f0
**Fecha:** Thu May 2 09:15:15 2024 -0400

### Descripción de los Cambios
Deprecación de Self Serve - Segunda pasada. Elimina 8222+ líneas de código relacionadas con funcionalidades de autoservicio, true-up y facturación automática.

Cambios principales eliminados:
1. **APIs de servidor**: Elimina endpoints de cloud, licencias y true-up en `api4/`
2. **Lógica de negocio**: Remueve `true_up.go`, funciones de licencia en `platform/`
3. **Base de datos**: Agrega migración `000121_remove_true_up_review_history` para eliminar tabla
4. **Store**: Elimina `TrueUpReviewStore` y operaciones relacionadas
5. **Webapp - Componentes**:
   - `payment_form/` - Formularios de pago con Stripe
   - `delete_workspace/` - Eliminación de workspace
   - `cloud_start_trial/` - Botones y modales de trial
   - `true_up_review.tsx` - Revisiones de true-up
   - `upsell_card.tsx` - Tarjetas de upsell
6. **Webapp - Hooks**: Elimina `useCanSelfHostedExpand`, `useDelinquencySubscription`, `useLoadStripe`
7. **Webapp - Redux**: Reduce estados y acciones de `cloud` y `hosted_customer`
8. **i18n**: Elimina 68+ cadenas de traducción relacionadas
9. **Cliente**: Remueve métodos de API de `client4.ts` relacionados con self-serve

Este cambio representa una transición significativa del modelo de negocio de Mattermost, alejándose del autoservicio hacia un modelo más tradicional de ventas directas.

### Veredicto del Cambio
B) Cambio de marca/branding/Enterprise - Deprecación masiva de funcionalidades Self Serve
