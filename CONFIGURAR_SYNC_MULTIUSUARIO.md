# Sync de Banco Guayaquil multi-usuario (gratis)

Esto es la versión "cualquiera que se registre puede usarlo" del sync de
correos de Banco Guayaquil. A diferencia de `apps-script/Code.gs` (que solo
puede leer **tu** Gmail, porque corre como vos), acá cada usuario conecta
**su propio** Gmail desde la app, y un cron gratis externo dispara la
sincronización de todos cada 5 minutos.

No usa Cloud Functions ni el plan Blaze de Firebase — todo corre como rutas
normales de Next.js. El único costo real sería si algún día tenés muchísimos
usuarios y tu hosting deja de tener tier gratis, pero para uso personal/con
gente de confianza esto es $0.

## Cómo queda armado

```
Usuario hace clic "Conectar Gmail" en Ajustes
  -> /api/gmail/oauth/start (verifica tu sesión, redirige a Google)
  -> pantalla de consentimiento de Google
  -> /api/gmail/oauth/callback (guarda tu refresh token, SOLO accesible desde el servidor)

Cron externo (cron-job.org) cada 5 min
  -> GET /api/cron/sync-gmail?secret=...
  -> por cada usuario conectado: revisa correos nuevos del banco, categoriza,
     guarda el movimiento, marca el correo como leído, manda push
```

## 1. Habilitar la API de Gmail

En [console.cloud.google.com](https://console.cloud.google.com), elegí el
**mismo proyecto que tu Firebase** (el de `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
ej. `chat-8ada6`) y andá a **APIs & Services → Library**, buscá "Gmail API" y
habilitala.

## 2. Configurar la pantalla de consentimiento OAuth

**APIs & Services → OAuth consent screen**:

1. Tipo de usuario: **External** (a menos que tengas Google Workspace).
2. Nombre de la app, correo de soporte, logo (opcional).
3. Scopes: agregá `https://www.googleapis.com/auth/gmail.modify`.
4. **Test users**: agregá tu propio Gmail y el de cualquier persona de
   confianza que quieras que use el sync — hasta 100 sin pasar por
   verificación de Google. Si algún día es gente registrándose sola sin que
   vos la agregues acá, ahí sí Google exige un proceso de verificación de
   seguridad para el scope de Gmail (no es plata garantizada, pero es un
   trámite real).

## 3. Crear las credenciales OAuth

**APIs & Services → Credentials → Create Credentials → OAuth client ID**:

- Tipo: **Web application**.
- **Authorized redirect URIs** — agregá las dos:
  - `http://localhost:3000/api/gmail/oauth/callback` (desarrollo)
  - `https://tu-dominio-real.com/api/gmail/oauth/callback` (producción, una
    vez que despliegues)

Copiá el **Client ID** y el **Client Secret** — van en `.env.local` como
`GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`.

## 4. Generar la clave del Admin SDK de Firebase

**Firebase Console → Configuración del proyecto → Cuentas de servicio →
Generate new private key**. Descarga un JSON. De ahí sacás:

```
FIREBASE_ADMIN_PROJECT_ID=<"project_id" del JSON>
FIREBASE_ADMIN_CLIENT_EMAIL=<"client_email" del JSON>
FIREBASE_ADMIN_PRIVATE_KEY=<"private_key" del JSON, con comillas, tal cual>
```

Guardá ese JSON en un lugar seguro y **nunca lo subas al repo** (ya debería
estar cubierto por `.gitignore` al ser un archivo `.json` suelto, pero
verificalo si lo descargás dentro de la carpeta del proyecto).

## 5. Completar `.env.local`

Copiá las variables nuevas de `.env.example` (sección "Multi-user Gmail
bank-email sync") a tu `.env.local` real:

- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` — del paso 3.
- `OAUTH_STATE_SECRET` — cualquier string largo random que inventes vos
  (`openssl rand -hex 32` en una terminal, o cualquier generador de
  contraseñas largas).
- `CRON_SECRET` — otro string random que inventes vos.
- `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` /
  `FIREBASE_ADMIN_PRIVATE_KEY` — del paso 4.
- `GROQ_API_KEY` — si ya la tenés configurada para el nutrition-plan o el
  script de Apps Script, podés reusar la misma.

Reiniciá `npm run dev` después (las env vars se leen al arrancar).

## 6. Desplegar la app en algo con URL pública

El cron necesita pegarle a una URL real, no a `localhost`. Cualquier hosting
gratis que corra Next.js sirve — [Vercel](https://vercel.com) (tier gratis
Hobby) es la opción más directa para un proyecto Next.js. Agregá ahí las
mismas variables de entorno del paso 5, y agregá la URL de producción a los
**Authorized redirect URIs** del paso 3 si todavía no lo hiciste.

## 7. Configurar el cron gratis

En [cron-job.org](https://cron-job.org) (gratis, sin tarjeta):

1. Creá una cuenta.
2. **Create cronjob**:
   - URL: `https://tu-dominio-real.com/api/cron/sync-gmail?secret=TU_CRON_SECRET`
   - Schedule: cada 5 minutos.
   - Method: GET.
3. Guardá y activalo.

(Alternativa sin depender de un tercero: un GitHub Actions con `schedule:
cron` en el propio repo que haga `curl` a la misma URL — también gratis,
pero cron-job.org es más simple de armar.)

## 8. Conectar tu Gmail desde la app

Andá a **Ajustes** dentro de StarkLab → sección "Sync de Banco Guayaquil" →
**Conectar Gmail**. Te lleva a la pantalla de consentimiento de Google (tenés
que estar en la lista de test users del paso 2, salvo que ya hayas pasado
verificación). Una vez que aceptás, el sync queda activo — el cron lo va a
procesar en su próxima corrida.

## Convive con tu Apps Script actual

Si seguís teniendo el trigger de `apps-script/Code.gs` activo para tu propia
cuenta, no pasa nada por tener ambos corriendo — el id de cada movimiento se
deriva del id del correo de Gmail (`bg_` + hash), así que si los dos
procesan el mismo correo, el segundo lo detecta como duplicado y no crea
nada repetido. Podés desactivar el trigger del script (`removeAutomaticTrigger`)
cuando confirmes que el sync nuevo te está funcionando bien, o dejarlo — es
tu decisión, ninguno de los dos rompe al otro.
