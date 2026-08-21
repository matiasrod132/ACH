import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidad — StarkLab',
  description: 'Cómo StarkLab recolecta, usa y protege tus datos.',
}

export default function PoliticaPrivacidadPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 py-12 sm:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Política de Privacidad de StarkLab</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: agosto de 2026.</p>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        StarkLab es una aplicación personal para seguimiento de hábitos, finanzas, nutrición y
        entrenamiento. Esta página describe qué datos recolecta, para qué los usa, y cómo los
        protege.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Qué datos recolecta</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="text-foreground">Cuenta:</strong> correo electrónico y nombre, para
            iniciar sesión (Firebase Authentication).
          </li>
          <li>
            <strong className="text-foreground">Datos que registrás vos mismo:</strong> movimientos
            financieros, comidas, entrenamientos, hidratación, hobbies y tareas que ingresás
            manualmente dentro de la app.
          </li>
          <li>
            <strong className="text-foreground">Correos bancarios (opcional, con tu permiso explícito):</strong>{' '}
            si conectás tu cuenta de Gmail desde Ajustes, StarkLab busca <em>únicamente</em> los
            correos de notificación transaccional de Banco Guayaquil (remitente y asunto
            específicos, ej. &quot;Consumo por…&quot;) para detectar el monto y crear el movimiento
            automáticamente. No lee, procesa ni almacena ningún otro correo de tu bandeja.
          </li>
          <li>
            <strong className="text-foreground">Datos de Apple Salud (opcional):</strong> si
            configurás el Atajo de iOS correspondiente, se recibe peso y estatura para tu perfil de
            nutrición.
          </li>
          <li>
            <strong className="text-foreground">Token de notificaciones push:</strong> si activás
            notificaciones, se guarda un identificador de tu dispositivo (no personal) para poder
            enviarte avisos.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Para qué se usan</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Exclusivamente para el funcionamiento de la app: mostrarte tus propios datos, calcular
          tus métricas (presupuesto, calorías, progreso de entrenamiento), y — cuando corresponde —
          categorizar automáticamente un movimiento bancario o sugerirte metas de nutrición
          usando un modelo de IA (Groq) sobre el texto ya extraído del correo o tu perfil, nunca
          sobre tu bandeja completa. Nunca se venden ni se comparten datos con terceros con fines
          publicitarios.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Dónde se almacenan</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Todos los datos viven en Firebase (Firestore) bajo tu propia cuenta, protegidos por
          reglas de seguridad que solo permiten que cada usuario lea y escriba sus propios datos.
          El token de acceso a Gmail (si lo conectás) se guarda en una colección separada,
          inaccesible desde el navegador de cualquier usuario, incluido vos mismo — solo la
          sincronización automática del servidor puede leerlo.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Cómo eliminar tus datos</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Podés desconectar tu Gmail en cualquier momento desde Ajustes (revoca el permiso y borra
          el token guardado). Para eliminar tu cuenta y todos tus datos por completo, escribinos al
          correo de contacto abajo.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Contacto</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Para preguntas sobre esta política o tus datos: <span className="text-foreground">matiasrodriesc@gmail.com</span>
        </p>
      </section>
    </main>
  )
}
