Pantallas legales de incorporación en la aplicación
Modelo de incorporación actual de dos etapas
Versión
Versión 1.1
Última actualización
5 de abril de 2026
Preparado para
Drivest Limited

Propósito del documento
Este documento interno define el flujo actual de permisos y aspectos legales de incorporación aprobado para Drivest. Refleja la implementación presente ahora en la aplicación y reemplaza la redacción anterior que no describía completamente el modelo de consentimiento almacenado.

1. Objetivo
Este documento define el flujo de incorporación actual en la aplicación para la aceptación legal y los permisos. El modelo aprobado utiliza dos etapas en lugar de un recorrido legal más largo de varias pantallas. El propósito es reducir la fricción del usuario y, al mismo tiempo, capturar un reconocimiento legal válido y opciones registradas por separado que el backend pueda aplicar y evidenciar.

2. Etapa 1: Aceptación legal combinada
La Etapa 1 es la puerta de entrada obligatoria a la aplicación.

Título actual:
Antes de empezar

Texto del cuerpo actual:
Drivest es una plataforma de apoyo a la conducción. Proporciona solo orientación y no reemplaza su juicio, a su instructor ni a la ley.

Siempre debe seguir las señales de tráfico, las leyes de tránsito y las condiciones del mundo real. Si algo en la aplicación entra en conflicto con la carretera, siga la carretera.

Al continuar, confirma que tiene 16 años de edad o más, que comprende y acepta el aviso de seguridad y que está de acuerdo con los Términos y condiciones y la Política de privacidad.

Controles requeridos:
- Ver Términos
- Ver Privacidad
- una casilla de verificación obligatoria
- Botón Continuar desactivado hasta que se seleccione la casilla de verificación

Texto de la casilla de verificación actual:
Confirmo que tengo 16 años o más, comprendo el aviso de seguridad y acepto los Términos y condiciones y la Política de privacidad.

Esta etapa crea el registro de aceptación legal autorizado.
El backend debe almacenar:
- termsVersion (versión de los términos)
- privacyVersion (versión de privacidad)
- safetyVersion (versión de seguridad)
- ageConfirmed (edad confirmada)
- safetyAccepted (seguridad aceptada)
- marca de tiempo de aceptación
- sourceScreen (pantalla de origen)
- versión de la aplicación
- plataforma
- identificador de instalación cuando esté disponible

3. Etapa 2: Permisos y consentimiento opcional
La Etapa 2 es la pantalla de permisos operativos.

Título actual:
Permisos

Texto del cuerpo actual:
Drivest necesita ciertos permisos para funcionar correctamente. La ubicación se utiliza para rutas y navegación cuando está activa. El análisis ayuda a mejorar el rendimiento y la confiabilidad y es opcional. Las notificaciones lo mantienen actualizado sobre reservas y actividad.

Controles requeridos:
- una acción de ubicación que active el flujo de permisos de ubicación nativo del sistema
- acciones separadas de permitir y no permitir análisis
- acciones separadas de habilitar y ahora no para notificaciones
- Botón Continuar

Sección de ubicación actual:
Título: Ubicación
Mensaje: La ubicación se utiliza para rutas y navegación cuando está activa.
Botón: Solicitar acceso a la ubicación

Estados actuales del estado de ubicación:
- El acceso a la ubicación ya está permitido para Drivest.
- El acceso a la ubicación está denegado actualmente. Puede continuar, pero las funciones de ruta seguirán siendo limitadas hasta que lo habilite.
- La ubicación es opcional por ahora, pero las funciones de ruta y estacionamiento la necesitan cuando las usa.

Sección de análisis actual:
Título: Análisis opcional
Mensaje: El análisis ayuda a mejorar el rendimiento y la confiabilidad y es opcional.
Acciones:
- Permitir análisis
- No permitir

Sección de notificaciones actual:
Título: Notificaciones opcionales
Mensaje: Las notificaciones lo mantienen actualizado sobre reservas y actividad.
Acciones:
- Habilitar notificaciones
- Ahora no

4. Mapeo de backend
Como mínimo, la Etapa 1 debe crear o actualizar registros en:
- legal_document_versions
- user_legal_acceptances

Como mínimo, la Etapa 2 debe crear o actualizar registros de historial y elección actual para:
- analyticsChoice (elección de análisis)
- notificationsChoice (elección de notificaciones)
- locationChoice (elección de ubicación)

Los cambios de configuración posteriores deben escribirse en el mismo modelo de cumplimiento de backend para que Drivest pueda probar tanto la elección de incorporación original como los cambios o retiros posteriores, según corresponda.

5. Reglas estrictas
Ninguna casilla de verificación puede estar preseleccionada.
La aplicación no debe permitir que un usuario omita la etapa de aceptación legal y continúe en el producto sin consentimiento.
Los Términos y condiciones y la Política de privacidad deben ser accesibles desde la etapa legal.
El aviso de seguridad debe seguir siendo parte del texto de aceptación legal a menos que la posición legal cambie y las versiones se actualicen en consecuencia.
La etapa de permisos no debe agrupar análisis, notificaciones y ubicación en un solo consentimiento vago.
Cada elección debe seguir siendo comprensible por separado y registrable por separado.
Cualquier cambio material en el texto legal, el modelo de permisos o el comportamiento rastreado debe activar una actualización de versión y una nueva aceptación cuando sea necesario.
