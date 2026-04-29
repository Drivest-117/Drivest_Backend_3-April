Marco de permisos y consentimiento
Permisos móviles de Drivest, consentimiento opcional y modelo de registro
Versión
Versión 1.1
Última actualización
5 de abril de 2026
Preparado para
Drivest Limited

Propósito del documento
Este documento interno define cómo se deben solicitar ahora los permisos y el consentimiento en la aplicación para que el recorrido móvil siga siendo de baja fricción, legalmente defendible y consistente con el sitio web actual, el comportamiento de la aplicación y el modelo de registro del backend.

1. Propósito de este documento
Este documento establece el marco actual de permisos y consentimiento para Drivest. Está destinado a mantener la experiencia móvil utilizable mientras permanece alineada con la posición legal, de privacidad y de la tienda de aplicaciones activa.
El principio fundamental sigue siendo el mismo. Drivest debe solicitar solo los permisos que sean necesarios, debe solicitarlos en contexto, no debe preactivar opciones opcionales y debe poder probar qué eligió el usuario y cuándo.

2. Modelo actual de permisos de incorporación
Drivest utiliza ahora un modelo de incorporación de dos etapas.

La Etapa 1 maneja la aceptación legal obligatoria. Cubre:
- Aceptación de Términos y condiciones
- Aceptación de la Política de privacidad
- Confirmación de edad
- Reconocimiento del aviso de seguridad

La Etapa 2 maneja los permisos operativos y el consentimiento opcional. Presenta:
- Acceso a la ubicación
- Elección de análisis
- Elección de notificaciones

La ubicación es operativamente importante para las funciones relacionadas con la ruta y el estacionamiento, pero sigue siendo un permiso del sistema operativo. El análisis es opcional. Las notificaciones son opcionales.

3. Etapa de aceptación legal obligatoria
La primera etapa de incorporación debe dejar claro que Drivest es una plataforma de apoyo a la conducción que proporciona solo orientación.
Debe dejar claro que Drivest no reemplaza el juicio del usuario, un instructor de conducción o la ley.
La etapa debe proporcionar acceso a los Términos y condiciones y a la Política de privacidad antes de que el usuario continúe.
El usuario debe marcar activamente una casilla antes de continuar.
La aplicación no debe continuar hasta que se seleccione esa casilla de verificación.
La misma etapa captura la confirmación de la edad y el reconocimiento de seguridad como parte del evento de aceptación.
El backend debe almacenar la versión de los términos aceptada, la versión de privacidad, la versión de seguridad, la marca de tiempo de aceptación, la pantalla de origen, la versión de la aplicación, la plataforma y el identificador de instalación cuando esté disponible.

4. Permiso de ubicación
La ubicación debe solicitarse a través de una acción en contexto y luego a través del diálogo de permisos del sistema operativo.
La redacción explicativa debe seguir siendo consistente con la posición de privacidad actual:
- La ubicación se utiliza para rutas y navegación cuando está activa
- Las funciones de ruta y estacionamiento necesitan ubicación cuando el usuario intenta usarlas
- Drivest no debe dar a entender que el historial de ubicación continuo en segundo plano se almacena en los servidores

Si un usuario rechaza el permiso de ubicación, la aplicación puede restringir las funciones relacionadas con la ruta y el estacionamiento, pero no debe bloquear las funciones de aprendizaje no relacionadas.
La aplicación debe almacenar la elección de ubicación efectiva del usuario como uno de:
- permitir (allow)
- denegar (deny)
- omitir (skip)

5. Consentimiento de análisis
El análisis debe seguir siendo opcional cuando el consentimiento es la base legal prevista.
El comportamiento de análisis debe permanecer desactivado hasta que el usuario tome una decisión afirmativa.
La interfaz de usuario debe describir el análisis como una ayuda para mejorar el rendimiento y la confiabilidad.
La interfaz no debe sugerir que se requiere el análisis para utilizar el servicio principal.
El backend debe almacenar:
- analyticsChoice (elección de análisis)
- marca de tiempo
- superficie de origen
- versión de la aplicación
- plataforma
- identificador de instalación cuando esté disponible

6. Consentimiento de notificaciones
Las notificaciones deben seguir siendo opcionales.
El aviso debe describir su propósito operativo, incluyendo actualizaciones, reservas, recordatorios y actividad importante de la cuenta cuando sea relevante.
Las notificaciones no deben estar preactivadas de forma predeterminada.
La aplicación debe almacenar la elección de preferencia en la aplicación del usuario por separado del resultado del permiso del sistema operativo.
El backend debe almacenar:
- notificationsChoice (elección de notificaciones)
- marca de tiempo
- superficie de origen
- versión de la aplicación
- plataforma
- identificador de instalación cuando esté disponible

7. Requisitos de registro
El sistema debe registrar el evento de aceptación legal por separado de las opciones de permiso y consentimiento.
Como mínimo, el backend debe almacenar:
- versión de términos
- versión de privacidad
- versión de seguridad
- marca de tiempo de aceptación
- estado de confirmación de edad
- elección de análisis
- marca de tiempo de análisis
- elección de notificaciones
- marca de tiempo de notificaciones
- elección de ubicación
- marca de tiempo de ubicación
- pantalla de origen o superficie de origen
- versión de la aplicación
- plataforma
- identificador de instalación cuando esté disponible

8. Requisito de implementación actual
El marco de permisos debe coincidir con el comportamiento real de la aplicación.
Si el flujo legal describe el análisis como opcional, el análisis debe ser realmente opcional en la implementación.
Si la aplicación almacena la elección de ubicación como parte de la incorporación, ese modelo de datos debe reflejarse en la documentación de cumplimiento interna.
Si la aplicación agrega más adelante un nuevo permiso, un nuevo comportamiento de seguimiento o un procesamiento de ubicación continuo en segundo plano, el marco de permisos, la política de privacidad, el texto de la aplicación y las declaraciones de la tienda deben actualizarse todos juntos antes del lanzamiento.

9. Inventario final de permisos
Permiso o elección
Posición final

Reconocimiento legal combinado obligatorio
Aceptación de términos, aceptación de privacidad, confirmación de edad y reconocimiento de seguridad. Requerido antes de que el usuario pueda ingresar al producto.

Ubicación
Solicitado en contexto para admitir rutas, navegación y funciones que dependen de la ubicación. Controlado por el sistema operativo, pero la aplicación también almacena un estado de elección registrado.

Análisis
Consentimiento opcional. Debe permanecer desactivado hasta que el usuario tome una decisión afirmativa.

Notificaciones
Consentimiento opcional. No debe estar preactivado. Los ajustes del dispositivo siguen siendo la autoridad final de permisos, mientras que la aplicación almacena la elección de preferencia del usuario en la aplicación.
