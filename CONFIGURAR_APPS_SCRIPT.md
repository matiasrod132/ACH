# Sincronización automática con Banco Guayaquil

El Apps Script usa la autorización de tu propia cuenta Google (OAuth) para leer y
escribir en Firestore — no necesita una clave de Firebase ni una cuenta de servicio.
La categorización con IA (Groq) es opcional: sin su API key, los movimientos igual
se crean usando un categorizador nativo por palabras clave.

## 1. Vincular Google Cloud

1. En Firebase abre **Configuración del proyecto** y copia el **número del proyecto**.
2. Abre Apps Script y entra a **Configuración del proyecto**.
3. En **Proyecto de Google Cloud Platform**, pulsa **Cambiar proyecto**.
4. Introduce el número del mismo proyecto de Firebase y confirma.

La cuenta Google que ejecuta Apps Script debe tener acceso (rol Editor o superior)
al proyecto de Firebase, porque el script llama a Firestore con su propio token
OAuth en lugar de una API key.

## 2. Copiar el script

1. Copia `apps-script/Code.gs` al proyecto de Apps Script.
2. Activa la visualización del manifiesto (⚙️ del editor) y copia `apps-script/appsscript.json`
   tal cual — incluye el scope `https://www.googleapis.com/auth/datastore`, imprescindible
   para que el token OAuth pueda leer/escribir en Firestore. Si lo omites, todas las
   llamadas a Firestore fallarán con un error de permisos.
3. En **Propiedades del script** crea:

| Propiedad | Valor | Obligatoria |
|---|---|---|
| `FIRESTORE_PROJECT_ID` | ID de Firebase, por ejemplo `chat-8ada6` | Sí |
| `GROQ_API_KEY` | Tu API key de Groq (console.groq.com) | No — habilita categorización con IA |
| `GROQ_MODEL` | ID del modelo, por defecto `openai/gpt-oss-120b` | No |
| `HEALTH_WEBHOOK_SECRET` | Un valor largo y aleatorio, inventado por ti | No — solo si usas el webhook de Apple Salud (sección 7) |

Groq retira modelos de vez en cuando (por ejemplo `llama-3.3-70b-versatile` dejó de
funcionar el 16 de agosto de 2026). Si `testConfiguration` o los logs muestran un
error `model_not_found`, revisa [console.groq.com/docs/deprecations](https://console.groq.com/docs/deprecations)
y actualiza la propiedad `GROQ_MODEL` — no hace falta tocar el código.

No pegues ninguna API key directamente en el código: si alguna vez estuvo escrita
en el script o se compartió por chat, considérala expuesta y rótala desde el
panel de Groq antes de usarla aquí.

## 3. Registrar el usuario

Inicia sesión en ACH con el mismo Gmail donde recibes las alertas del banco. ACH
guarda ese correo dentro de tu documento de usuario (`users/{uid}.email`) la primera
vez que entras a la app, para que Apps Script encuentre automáticamente tu UID.

## 4. Autorizar y probar

La primera ejecución de cualquier función pedirá autorizar los permisos (Gmail +
Firestore + tu email). Si más adelante actualizas `appsscript.json` y agregas o
cambias un scope, Apps Script **no siempre vuelve a pedir permisos solo por eso** —
si ves un error `PERMISSION_DENIED` / `insufficient authentication scopes` o
`Specified permissions are not sufficient`, ve a
[myaccount.google.com/permissions](https://myaccount.google.com/permissions), busca
el proyecto de Apps Script y quítale el acceso, y vuelve a ejecutar una función para
forzar una nueva pantalla de consentimiento con el scope actualizado.

Ejecuta estas funciones en orden desde el editor:

1. `testConfiguration`: debe indicar `success: true`, `userRegistered: true` y
   `groqEnabled` según si configuraste la API key.
2. `testLatestBancoGuayaquilEmail`: analiza el correo más reciente sin guardar nada —
   útil para verificar que el monto/tipo/categoría se detectan bien antes de dejarlo
   automático.
3. `procesarMailsBancoGuayaquil`: procesa los correos no leídos reconocidos y crea
   los movimientos en `users/{uid}/financeMovements` (la misma colección que usa la
   pestaña Finanzas de la app).
4. `createAutomaticTrigger`: activa la revisión cada cinco minutos.

`removeAutomaticTrigger` detiene la automatización. Cada correo usa un ID estable
derivado de su Gmail message ID, por lo que reprocesar correos ya leídos no crea
movimientos duplicados.

La búsqueda de Gmail combina dos filtros, no solo uno:

1. **Remitente**: `BancoGuayaquil@bancoguayaquil.com` o
   `bancavirtual@bancoguayaquil.com` (constante `REMITENTES_TRANSACCIONALES`).
2. **Asunto**: debe empezar con un patrón **confirmado** de transacción real —
   solo "Consumo por" (compras con tarjeta) y "Orden de" (Ahorro Meta),
   constante `PATRONES_ASUNTO_TRANSACCION`.

El remitente solo no alcanzaba: **"Banco Guayaquil" manda los consumos reales
Y las promociones de conciertos/viajes desde la misma dirección** — buscar
solo por remitente seguía trayendo boletines, avisos de cajeros y entradas a
shows. Con los dos filtros combinados, esos correos ya ni siquiera se
descargan.

A propósito **no** se incluyen patrones como "Transacción rechazada",
"Retiro", "Transferencia" o "Depósito": el script nunca crea un movimiento
para una transacción que no se efectuó, así que no tiene sentido ni
descargar ese correo — y los otros tres eran solo una suposición, nunca se
confirmó un asunto real con ese texto. Es mejor dejar un correo real sin
procesar (y que lo notes) que abrir correos que no tienen nada que ver con
la función. Si algún día Banco Guayaquil manda un tipo de comprobante nuevo,
dime el **asunto exacto** que llegó y lo agrego a `PATRONES_ASUNTO_TRANSACCION`
— nunca voy a adivinar un patrón sin haberlo visto.

Los correos con asunto de "acceso con éxito", activación o cambio de clave, y
los de una transacción que no se efectuó (rechazada, declinada, fondos
insuficientes, reversada, etc.), siguen teniendo su lógica de detección
dentro del script (`FRASES_TRANSACCION_NO_EFECTIVA`) como red de seguridad —
por si alguna vez un correo con asunto "Consumo por..." u "Orden de..."
describe una transacción que en realidad no se efectuó. En la práctica, con
el filtro de asunto tan acotado, casi nunca deberían aparecer.
Si alguno de los dos remitentes transaccionales llega a mandar un correo sin
ningún monto "$" detectable (poco común, pero puede pasar), también se marca
como leído — dejarlo sin leer significaría volver a descargarlo y analizarlo
en cada corrida de 5 minutos para siempre. El asunto queda en el log de
ejecución por si alguna vez hace falta revisar qué se descartó.

## 5. Producto "Orden de Ahorro Meta" del banco

Si usas el producto **"Orden de Ahorro Meta"** de Banco Guayaquil, el correo
trae el texto "Orden de **{nombre}** Meta" / "TRANSFERENCIA **{nombre}** META".
Comprobado: **el correo es idéntico letra por letra tanto para un aporte como
para un retiro** — mismo ordenante/beneficiario, mismo formato, ningún campo
que diga cuál es cuál. El script solo usa este patrón para categorizar el
movimiento como "Ahorro" (con la descripción "revisa si fue aporte o retiro"
como recordatorio) — no está enlazado a ninguna meta de la app ni ajusta nada
automáticamente. El script no tiene ningún concepto de metas: solo crea
movimientos.

## 6. Movimientos automáticos son de solo lectura para borrar

Los movimientos creados por este script (`automatic: true`) no se pueden
eliminar desde la app — se ven con la etiqueta "Auto" y el botón de borrar
aparece bloqueado. Sí se pueden editar (por ejemplo para corregir la
categoría). Esto evita que se pierda el rastro de auditoría de lo que
realmente reportó el banco. Si de verdad necesitas borrar uno (por ejemplo,
uno que se coló antes de agregar el filtro de transacciones rechazadas),
hazlo directamente desde la consola de Firebase (Firestore Database →
`users/{uid}/financeMovements`).

## 7. Webhook de Apple Salud (peso/estatura vía Atajos de iOS)

No existe una API pública de Apple Salud para servicios web — los datos
viven en el iPhone. El puente es un Atajo de iOS que lee tu peso (y
opcionalmente estatura) desde la app Salud y los manda por HTTP a este mismo
script, que los guarda en `users/{uid}/bodyWeight` y
`users/{uid}.nutritionProfile.heightCm` — las mismas colecciones que ya usa
Nutrición → Peso y → Objetivos en la app.

### 7.1 Configurar el script

1. Añade la propiedad de script `HEALTH_WEBHOOK_SECRET` con un valor largo y
   aleatorio (invéntalo tú, no lo compartas).
2. En el editor: **Implementar → Nueva implementación**.
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo** (imprescindible — así el Atajo no necesita iniciar
     sesión en Google; el script sigue actuando con tu identidad).
   - Quién tiene acceso: **Cualquier usuario**.
3. Copia la URL de la implementación (termina en `/exec`). Esa es la URL que
   usa el Atajo.

Ojo: esto crea una URL pública de escritura. Está protegida por el secreto
(sin él, el script responde `{"success":false,"error":"No autorizado"}` y no
toca nada), pero sigue siendo una superficie nueva — no la compartas.

### 7.2 Crear el Atajo en iPhone

1. Abre **Atajos** → **+** → agrega la acción **Obtener muestra de salud**,
   tipo **Peso corporal**, "más reciente".
2. Agrega **Convertir medida** → a **Kilogramos** (así no importa en qué
   unidad tengas configurado el iPhone).
3. Agrega **Diccionario** con estas claves:
   - `secret`: texto → tu `HEALTH_WEBHOOK_SECRET`.
   - `weightKg`: número → el peso convertido del paso 2.
   - `date`: texto → **Fecha actual** con formato `AAAA-MM-DD`.
4. Agrega **Obtener contenido de URL**:
   - URL: la del paso 3.7 (termina en `/exec`).
   - Método: **POST**.
   - Cuerpo de la solicitud: **JSON**, usando el diccionario del paso 3.
5. Pruébalo manualmente una vez (▶️ en el editor del Atajo) y confirma en la
   app, en Nutrición → Peso, que apareció el registro.

La estatura casi nunca cambia, así que agregar `heightCm` al diccionario es
opcional — puedes mandarla una sola vez a mano o configurarla directamente
en Objetivos dentro de la app.

### 7.3 Automatizarlo

**Atajos → pestaña Automatización → Crear automatización personal → Hora del
día** (ej. todos los días 8:00 a.m.) → **Ejecutar Atajo** → elige el que
creaste → desactiva "Preguntar antes de ejecutar" para que corra en
silencio.

## 8. Notificaciones push (nuevo movimiento / peso actualizado)

El script manda una notificación push real de Firebase Cloud Messaging cada
vez que crea un movimiento (Fase 4 de `procesarMailsBancoGuayaquil`) o guarda
un peso nuevo desde el webhook de Salud — **llega aunque la app esté
cerrada**, sin necesidad de Cloud Functions ni del plan de pago "Blaze": se
envía por la API v1 de FCM usando el mismo `ScriptApp.getOAuthToken()` que ya
usa este script para Firestore, solo que con el scope
`https://www.googleapis.com/auth/firebase.messaging` agregado.

Pasos para activarlo:

1. **`appsscript.json`** ya trae el scope nuevo — si tu script estaba
   autorizado con la versión anterior, tenés que volver a autorizarlo (ver
   sección 4: quitarle el acceso en
   [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
   y ejecutar una función de nuevo).
2. **Generar la VAPID key** (clave pública de Web Push) en la consola de
   Firebase: **Configuración del proyecto → Cloud Messaging → pestaña "Web
   configuration" → "Generate key pair"**. Copia el valor.
3. Agregala a tu `.env.local` de la app web:
   ```
   NEXT_PUBLIC_FIREBASE_VAPID_KEY=<la clave que copiaste>
   ```
   Sin esto, activar notificaciones en Ajustes sigue funcionando para avisos
   locales (mientras la pestaña está abierta), pero **no** registra el token
   de push en segundo plano — Ajustes te avisa si falta esta variable.
4. Reiniciá `npm run dev` (las variables `NEXT_PUBLIC_*` se leen al arrancar,
   no en caliente) y activá las notificaciones desde **Ajustes** en la app —
   eso guarda tu token de dispositivo en `users/{uid}/pushTokens`, de donde
   el script lo lee para enviarte los avisos.

Si un token queda inválido (por ejemplo, borraste el sitio del navegador),
FCM devuelve un error al enviarle — el script lo registra en el log de
ejecución y sigue con los demás tokens sin interrumpir el resto del proceso;
no hay limpieza automática de tokens viejos todavía.
