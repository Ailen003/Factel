# Roadmap: acceso controlado y administración de la demo

Actualizado: 2026-09-10. Dirección acordada: solicitud de acceso, alta administrativa y gasto de 0 USD. Implementación pendiente de los hitos indicados.

Se conserva la ruta para mantener los enlaces anteriores. Esta versión sustituye la propuesta de registro público automático del mismo día. No autoriza compras, migraciones, despliegues ni cambios de permisos en ejecución.

## 1. Objetivo y decisión

La landing permite contactar con el equipo para solicitar una prueba. El equipo evalúa el interés y la capacidad disponible, crea una cuenta individual y comparte credenciales temporales con la persona autorizada. El usuario cambia la contraseña al entrar y utiliza la demo dentro de la asignación concedida. Los administradores gestionan duración, consumo, soporte y cierre.

No se implementará registro público en este roadmap. [REQ-009](../requirements/capped-public-registration/brief.md) permanece diferido y fuera de la entrega actual; no se considera completado ni se reutiliza su ID. Reactivarlo requeriría una nueva decisión explícita, incluso después de completar el baseline.

Este modelo reduce altas no deseadas, permite reservar recursos para interesados concretos y aprovecha la administración existente. Sigue requiriendo límites técnicos: una cuenta legítima, una credencial compartida indebidamente o un reintento pueden agotar recursos.

## 2. Recorrido acordado

1. La persona pulsa **Solicitar acceso** en la landing. Quien ya tiene cuenta dispone de **Iniciar sesión**.
2. Contacta con el equipo. La landing explica revisión y disponibilidad; contactar no crea cuentas, reserva plazas ni asigna créditos.
3. Un administrador confirma destinatario, interés, idioma, vigencia, créditos y límites tras comprobar capacidad gratuita.
4. Crea una cuenta de prueba individual. El servidor genera una contraseña temporal aleatoria y la muestra una sola vez al administrador para entregar URL, identificador y credencial mediante el canal acordado. Nunca entrega una cuenta administrativa ni una cuenta común para varios interesados.
5. El primer acceso exige sustituir la contraseña antes de consultar contenido, subir audio, procesar o usar el asistente. El plazo comienza al completar la activación; la credencial temporal sin usar caduca 72 horas después del aprovisionamiento exitoso.
6. La bienvenida muestra vigencia, créditos, límites, aviso de acceso auditado para soporte y guía hacia el primer resultado.
7. El equipo puede ampliar dentro de capacidad, suspender, revocar sesiones o cerrar la prueba. Las ampliaciones de plazo y créditos son independientes.

Mecanismo de contacto elegido: formulario bilingüe con campos acotados que prepara un correo en la aplicación del visitante hacia una dirección empresarial configurable por administración. La aplicación no almacena el contenido ni envía correo en servidor; por ello no crea una bandeja de solicitudes, CRM ni superficie pública de envío abusivo. Un interruptor independiente permite pausar solicitudes sin eliminar la dirección. El valor operativo exacto del buzón debe configurarse antes de abrir el canal.

La entrega debe usar contraseña temporal aleatoria, cambio obligatorio, caducidad y recuperación con comprobación de identidad. No guardar secretos en auditoría, notas, enlaces públicos o parámetros de contacto. Se registra la entrega sin conservar la credencial. Una invitación de un solo uso sería una alternativa futura, no un requisito adicional.

## 3. Política acordada y configuración pendiente

| Tema | Acuerdo o estado |
|---|---|
| Admisión | Sólo altas administrativas tras revisión humana. Signup deshabilitado también en servidor. |
| Presupuesto | 0 USD en proveedores y alojamiento; sin compras, mejoras de plan ni recargas automáticas. Saldo promocional tratado como recurso finito. |
| Créditos | Referencia acordada: 10 iniciales una sola vez, configurables a la baja según capacidad. Recargas explícitas, justificadas y auditadas. |
| Duración | 14 días desde activación; ampliar plazo no repone créditos. |
| Cupo | 25 pruebas activas como techo inicial provisional, no objetivo de ocupación ni capacidad gratuita verificada. El cupo efectivo puede ser menor. |
| Equipo | Fuera del cupo de pruebas, pero todo su consumo entra en límites globales. |
| Vencimiento | 30 días de consulta, con solicitud de ampliación o eliminación; después, borrado con aviso previo. Política aceptada, todavía no implementada. Las cuentas vencidas ocupan almacenamiento hasta su limpieza. |
| Sin créditos | Durante una prueba vigente, consultar y gestionar datos existentes; bloquear nuevo procesamiento. Subidas sujetas a cuota propia y elegibilidad. |
| Seguridad administrativa | H2C-1 implementa perfiles separados de propietario/operador y una política de capacidades autoritativa en servidor. H2C-2a está implementado y migrado para MFA TOTP obligatorio, challenge y backup codes; su recorrido real autorizado sigue pendiente. H2C-2b está completo en código para recuperación administrativa, break-glass y transferencia protegida de propiedad, pendiente de aplicar su migración y del recorrido real autorizado. |
| Configuración pendiente | Bytes/archivos acumulados, minutos por audio/periodo, intentos, tokens, concurrencia y consumo compartido con otras demos. La sugerencia previa de 3 minutos no fue aprobada y no se convierte aquí en regla. El correo está configurado y la credencial temporal caduca a las 72 horas. |

| Permiso | Propietario | Administrador operativo |
|---|---|---|
| Incorporar/retirar administradores y fijar límites globales | Sí | No |
| Crear/gestionar pruebas, suspender y revocar sesiones | Sí | Sí |
| Recargar créditos y ampliar plazos | Dentro de recursos gratuitos | Dentro de límites delegados y recursos gratuitos |
| Consultar contenido ajeno para soporte | Con motivo y auditoría | Con motivo y auditoría |
| Eliminar cuentas de prueba | Con confirmación | Con confirmación |
| Pausar altas o procesamiento ante incidente | Sí | Sí |
| Reabrir tras pausa global | Sí | No |

Ningún rol convierte una asignación interna en gasto autorizado. Los límites globales prevalecen sobre el saldo individual. Si no hay capacidad para una operación, se rechaza o aplaza con un estado comprensible. Pausar procesamiento conserva consulta y recuperación cuando la infraestructura siga disponible; no se promete disponibilidad continua del alojamiento gratuito.

## 4. Base existente y pendientes

La inspección estática inicial encontró:

- [Autenticación](../../lib/auth/auth.ts) y [sesiones](../../lib/auth/session.ts) con signup deshabilitado y workspace individual resuelto en servidor.
- [Administración](../../modules/users/lib/services/user.services.ts) con creación, filtros, edición, suspensión, revocación y capacidades centralizadas. H2C-1 separa un único `owner` de los `operator`, mantiene `trial_user`/`platform_admin` como roles generales y autoriza cada operación sensible con estado actual de base de datos.
- [Créditos](../../modules/conversations/lib/services/credit.services.ts) con inicialización única y saldo; procesamiento con reservas y liquidación. Faltan recargas operativas y controles globales completos.
- [Conversaciones](../../modules/conversations/lib/services/conversation.services.ts) con validación y limpieza de audio. Borrado integral de cuentas pendiente; referencias de créditos también bloquean el borrado actual, incluso potencialmente en cuentas nuevas con saldo.
- Landing, login y contacto configurable operativos con su migración aplicada, buzón configurado e interruptor activo. H2A añade contraseña temporal obligatoria, caducidad a 72 horas, activación única y vigencia de 14 días; su migración `20260909213000_trial_activation` está aplicada. H2B está implementado y verificado con `20260910143000_temporary_credential_reissue` aplicada. H2C-1 implementa perfiles owner/operator, matriz tipada server-only, administración owner-only y autorización diferenciada de Settings. La comprobación agregada de solo lectura observa las diez migraciones aplicadas y el esquema actualizado, exactamente un owner activo y MFA-ready, y ninguna divergencia de rol, perfil, estado, credencial, workspace o MFA, sin revelar identidad ni inferir la procedencia del bootstrap. H2C-2a está migrado; su recorrido real autorizado sigue pendiente. Recuperación administrativa, break-glass y transferencia protegida de ownership forman H2C-2b.
- Auditoría persistida, pero sin consola completa de consulta/soporte. El asistente está sujeto a evidencia y requisito propios; no prometerlo por existir entidades en el esquema.

La evaluación inicial no accedió a bases de datos, proveedores ni despliegue. El intento anterior de pruebas de identidad/créditos no pudo ejecutarse porque Vitest no estaba disponible. Esta actualización documental no certifica código ni declara capacidades implementadas.

## 5. Roadmap revisado

| Hito | Trabajo | Criterio de salida | Requisitos |
|---|---|---|---|
| H0. Política y capacidad gratuita | Acceso controlado y gasto cero acordados. Inventariar planes, saldo, cuotas, renovación y consumo compartido; fijar asignaciones y canal de contacto/entrega. | Límites y responsables definidos; alojamiento y proveedores compatibles con uso previsto; respuesta al agotamiento conocida. H0 parcialmente resuelto. | REQ-001/007 |
| H1. Contacto en la landing | Solicitar acceso e Iniciar sesión EN/ES, aviso de revisión/disponibilidad y buzón administrable. Implementado, migrado, configurado y activo en el entorno local autorizado. | Contacto funcional sin crear identidad ni conceder recursos; no se promete acceso inmediato. | REQ-001; aceptación REQ-008 |
| H2. Alta y acceso seguros | Provisión administrativa, entrega temporal, cambio obligatorio, activación/caducidad, recuperación, revocación y seguridad privilegiada. H2A, H2B y H2C-1 están operativos con sus migraciones aplicadas. H2C-2a está implementado y migrado para TOTP MFA obligatorio, backup codes y challenge de segundo factor; su recorrido real autorizado sigue pendiente. H2C-2b está completo en código para recuperación administrativa de MFA, pérdida total de factores, protecciones contra takeover y transferencia protegida de ownership; espera activación operativa. | Cuenta nueva accede sólo a su workspace tras sustituir contraseña; recuperación controlada; autorización privilegiada refleja cambios inmediatamente; reintentos no divergen rol/perfil ni duplican resultados. | REQ-001/007 |
| H3. Operación y límites | Permisos, ficha de usuario, créditos/plazos, cuotas, pausas, auditoría/soporte y borrado integral con expiración. | Equipo controla todo el ciclo; concesiones dentro de recursos gratuitos; limpieza termina sin resurrección ni devolución indebida de créditos. | REQ-007; controles en cada capacidad |
| H4. Primera experiencia | Bienvenida, vigencia/créditos, guía con audio autorizado, ayuda, estados de cuota y solicitud de ampliación. | Usuario autorizado llega a resultado confirmado sin acompañamiento constante, en EN/ES y con teclado/móvil. | REQ-008; dashboard REQ-007 |
| H5. Piloto controlado | Recorrido completo con cuentas creadas por el equipo; comprobar operación/recursos del despliegue; ampliar tras observar consumo. | Evidencia de aislamiento, recuperación, permisos, cuotas, fallos, expiración y limpieza; no habilitar cargos para sostener la prueba. | REQ-008 y capacidades anteriores |

H1 está operativo mientras se sigue cerrando H0. Compartir acceso real exige completar H2 y los controles relevantes de H3. Los hitos enfocan trabajo en requisitos existentes; no declaran completo el baseline ni eliminan sus restantes dependencias. REQ-009 no participa. Alta por invitación humana no implica implementar un plugin o sistema automatizado de invitaciones.

## 6. Qué se elimina y qué se conserva

Fuera de la entrega: autorregistro, activación pública automática, verificación de correo para signup, CAPTCHA específico de signup, reserva automática de plazas por visitantes y lista de espera automatizada.

Se conservan: autenticación, límites de login/recuperación, protección del canal de contacto elegido, aislamiento, credenciales temporales, recuperación, cuotas de medios/IA, supervisión, auditoría, revocación y eliminación. Automatizar correo se evaluará por necesidad; no es requisito para recibir solicitudes por un canal existente.

## 7. Condicionantes que el acceso manual no resuelve

- **Vercel Hobby:** limita el uso a proyectos personales no comerciales e incluye promoción de productos/servicios en su definición comercial. Controlar altas no cambia por sí mismo la naturaleza empresarial. Comprobar adecuación o evaluar alojamiento compatible; no se ha elegido ni autorizado migración. [Fuente oficial](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage).
- **AssemblyAI:** el crédito gratuito inicial no caduca, pero se consume y no es una cuota mensual renovable. Sin recarga, la API se pausa al llegar a cero. El alta manual dosifica el saldo, no garantiza transcripción indefinida gratis. Saldo actual y continuidad pendientes. [Fuente oficial](https://www.assemblyai.com/docs/billing-and-pricing).
- **Recursos compartidos:** inventariar Vercel, Neon, Groq, almacenamiento y correo. Distinguir cuota de demo, proyecto, cuenta y organización; incluir desarrollo, equipo, reintentos, transferencia y limpieza. Una clave por demo no implica cuota independiente.
- **Retención:** el cupo activo no limita cuentas vencidas en consulta, objetos pendientes de borrar o auditoría acumulada. Limitar también esos recursos.

Reservar capacidad antes de operaciones costosas y considerar solicitudes en curso. No confiar sólo en avisos o créditos de producto. Mantener pausas independientes para altas, subidas y procesamiento. Datos ya guardados consultables mientras alojamiento y base de datos estén disponibles.

## 8. Aceptación del acceso controlado

1. Landing EN/ES: contacto llega al destino confirmado; login funciona; autorregistro no habilitado.
2. Contactar no crea usuario/workspace, reserva cupo ni concede créditos; si existe formulario, probar abuso/validación.
3. Sólo administradores autorizados crean pruebas; destinatario, idioma y límites registrados sin secretos.
4. Probar entrega fallida, contraseña temporal caducada, cambio obligatorio y recuperación; sesiones previas no eluden suspensión/revocación.
5. Dos administradores concurrentes y reintentos no duplican provisión/recargas ni exceden cupo/cuotas. Operadores no elevan privilegios ni reabren pausas globales.
6. Aislamiento entre cuentas; soporte con motivo y auditoría persistida, denegado si falla su registro.
7. Subidas excesivas, almacenamiento, errores de proveedor, concurrencia y saldo insuficiente detienen trabajo sin habilitar pago.
8. Vencimiento bloquea nuevas escrituras/procesamiento; permite consulta y solicitudes durante el periodo definido. Ampliaciones auditadas no reponen saldo automáticamente.
9. Borrado de cuenta nueva con ledger y de cuenta poblada; limpieza reintentable sin conservar contenido ni aceptar resultados tardíos; sólo prueba mínima no sensible.
10. Usuario autorizado completa un primer resultado y comprende cómo pedir ayuda/ampliación.

## 9. Próximo incremento y trazabilidad

H2B permanece cerrado con su migración aplicada. H2C-1 está implementado, verificado y migrado, y existe un owner activo válido según la comprobación agregada de solo lectura. H2C-2a está implementado y migrado para TOTP MFA obligatorio, backup codes y challenge de segundo factor; su recorrido real autorizado sobre PostgreSQL permanece pendiente. H2C-2b está completo en código para recuperación administrativa controlada, pérdida total de factores, protecciones contra takeover, confirmaciones reforzadas, revocación/auditoría asociadas y transferencia protegida de ownership; su undécima migración y recorrido real autorizado siguen pendientes. H2 no está completo. A continuación siguen H0, H3A (límites globales, cupo y pausas), H3B (créditos y extensiones), H3C (expiración, consulta y eliminación integral), H3D (soporte e inspección auditada), H4 y H5. El procedimiento humano del canal privado, el inventario de H0, los límites efectivos y la adecuación de alojamiento/transcripción siguen pendientes antes de prometer continuidad a 0 USD.

Esta implementación se coordina con producto, arquitectura, modelo de datos, REQ-001, REQ-007, REQ-009, índice y progresos. No se crean requisitos duplicados. REQ-008 conserva aceptación integrada y se usa como referencia sin marcarlo entregado. La navegación de docs enlaza este roadmap. La iteración H2C-2a preparó sin aplicar su migración; evidencia posterior de solo lectura confirma que ahora está aplicada. H2C-2b prepara una undécima migración sin aplicarla, no ejecuta bootstrap o seeds, no despliega y no hace commit.

Comprobaciones acumuladas de H2B: la integración enfocada pasó 63/63 pruebas en 13 archivos y la cobertura final del bloqueo H2A/H2B pasó 31/31 en 3 archivos, después de que la revisión independiente aprobara el conjunto anterior de 30 pruebas. La suite global serial final pasó 547/547 pruebas ejecutables en 108 archivos, con 3 pruebas/archivos omitidos; tipos y build pasaron tras el ajuste final. El `pnpm verify` paralelo falló sólo por tres timeouts fijos de cinco segundos (compatibilidad del esquema y dos pruebas no relacionadas de revisión de conversaciones); la repetición serial aislada de los dos archivos afectados pasó 10/10. Lint pasó con dos avisos preexistentes, y Prisma validate/generate, harness 20/20, paridad ES/EN 1225/1225 y whitespace pasaron. Una prueba local con dos clientes PostgreSQL observó adquisición `true`, competencia `false` y nueva adquisición `true` tras liberar. `migrate status` confirma las ocho migraciones aplicadas, incluidas H2A y la aditiva H2B, y la base de datos al día. La implementación automatizada no aplicó migraciones, no se desplegó y no se hizo commit; la evidencia actual posterior no reabre H2B. H2C-2, el procedimiento privado de entrega, las cuotas y la viabilidad externa permanecen explícitamente pendientes. La verificación local no sustituye la aceptación del entorno desplegado.

Comprobaciones de H2C-1 en su iteración original: 51/51 pruebas enfocadas; auditoría de UI 29/29; seguridad/H2B 25/25; conjunto funcional enfocado 170 pruebas superadas con sólo el timeout conocido de compatibilidad de esquema bajo carga, cuya ejecución aislada pasó 1/1 en 0.888 s. La verificación integrada final pasó 115 archivos y 613 pruebas, con 3 archivos/pruebas omitidos; typecheck, lint con dos avisos preexistentes, build y harness pasaron. Prisma validate/generate, paridad EN/ES 1270/1270 y `git diff --check` también pasaron. En esa iteración no se aplicó `20260910210000_admin_profiles`; la comprobación agregada posterior confirma que actualmente sí está aplicada y existe un owner válido. No se ejecutó bootstrap en H2C-2a, no se desplegó y no se hizo commit.

Comprobaciones de H2C-2a: 60/60 pruebas enfocadas en 14 archivos y 652/652 pruebas ejecutables en la suite serial global de 125 archivos, con 3 pruebas/archivos omitidos. La ejecución canónica `pnpm verify` también emitió PASS con las mismas 652 pruebas, y una revisión independiente de sólo lectura devolvió PASS sin hallazgos bloqueantes o de severidad alta. Typecheck de aplicación y referencia, lint con dos avisos preexistentes, build de producción, Prisma validate/generate, harness 20/20, paridad EN/ES 1361/1361 y `git diff --check` pasaron. `migrate status` encuentra diez migraciones y señala únicamente `20260910223000_admin_totp_mfa` como pendiente. La migración no fue aplicada; tampoco se ejecutaron bootstrap, seed, mutaciones MFA sobre cuentas reales, despliegue o commit. El recorrido real y H2C-2b permanecen pendientes.

Evidencia posterior de solo lectura al iniciar H2C-2b: `migrate status` encuentra las diez migraciones aplicadas y el esquema actualizado. Las comprobaciones agregadas observan tres administradores, exactamente un owner activo y MFA-ready, y cero inconsistencias de rol/perfil/estado/credencial/workspace/MFA. Esta evidencia no expone identidad y no sustituye el recorrido real autorizado de H2C-2a.

Comprobaciones de H2C-2b: la cobertura enfocada final pasó 90/90 pruebas en 15 archivos. La suite global serial aislada pasó 714/714 pruebas ejecutables en 136 archivos, con 3 pruebas/archivos omitidos y sin timeouts. Typecheck completo, lint con dos avisos preexistentes, build de producción, Prisma validate/generate, harness 20/20, paridad EN/ES 1487/1487 y `git diff --check` pasaron. La revisión independiente devolvió PASS sin hallazgos bloqueantes, altos o medios. `migrate status` encuentra once migraciones y sólo `20260911120000_admin_mfa_recovery_ownership` pendiente. No se aplicó esa migración ni se ejecutaron recuperaciones, reenrollments o transferencias reales; H2 está completo en código pero pendiente de activación y verificación operativa autorizada.
