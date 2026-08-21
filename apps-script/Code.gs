// Banco Guayaquil -> Firebase finance movement synchronizer, más un webhook
// para recibir peso/estatura desde un Atajo de iOS conectado a Apple Salud,
// y envío de notificaciones push (Firebase Cloud Messaging) por cada
// movimiento nuevo y cada actualización de peso.
//
// Script Properties required (Project Settings > Script Properties):
//   FIRESTORE_PROJECT_ID     e.g. "chat-8ada6"
//   GROQ_API_KEY             optional — enables AI categorization. Without it,
//                            movements still get created using the built-in
//                            keyword-based categorizer.
//   HEALTH_WEBHOOK_SECRET    optional — required only to use el webhook de
//                            Apple Salud (sección "WEBHOOK SALUD" más abajo).
//
// Auth: uses the script owner's own Google identity (ScriptApp.getOAuthToken()),
// which needs these scopes declared in appsscript.json:
//   https://www.googleapis.com/auth/datastore          — leer/escribir Firestore
//   https://www.googleapis.com/auth/firebase.messaging — enviar push (FCM v1)
// No Firebase API key, service account, ni Cloud Function necesarios — enviar
// por la API v1 de FCM es gratis en cualquier plan de Firebase (lo que
// requiere el plan de pago "Blaze" es Cloud Functions, y este proyecto no usa
// ninguna). Si acabás de agregar el scope de firebase.messaging a un script
// que ya estaba autorizado, tenés que volver a autorizarlo (Ejecutar
// cualquier función una vez y aceptar el nuevo permiso).

// ==================== CONFIGURACIÓN ====================

function config_() {
  var props = PropertiesService.getScriptProperties()
  var projectId = props.getProperty("FIRESTORE_PROJECT_ID")
  if (!projectId) throw new Error("Falta la propiedad FIRESTORE_PROJECT_ID")
  return {
    FIRESTORE_PROJECT_ID: projectId,
    GROQ_API_KEY: props.getProperty("GROQ_API_KEY") || null,
    // Groq rotates/deprecates models periodically (e.g. llama-3.3-70b-versatile
    // was retired 2026-08-16). Override via the GROQ_MODEL script property if
    // this one ever stops working — no code change needed.
    GROQ_MODEL: props.getProperty("GROQ_MODEL") || "openai/gpt-oss-120b",
    HEALTH_WEBHOOK_SECRET: props.getProperty("HEALTH_WEBHOOK_SECRET") || null,
    // content-firestore.googleapis.com avoids a DNS resolution issue some
    // Apps Script runtimes hit with the plain firestore.googleapis.com host.
    BASE_URL: "https://content-firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents",
  }
}

// These must match lib/movements.ts INCOME_CATEGORIES / EXPENSE_CATEGORIES
// exactly, so movements created here always land on a category the app's
// edit dialog actually offers.
var INCOME_CATEGORIES = ["Salario", "Transferencia", "Reembolso", "Inversión", "Venta", "Ahorro", "Otro"]
var EXPENSE_CATEGORIES = ["Comida", "Transporte", "Servicios", "Entretenimiento", "Salud", "Educación", "Suscripción", "Compras", "Ahorro", "Retiro", "Otro"]

// Estas direcciones mandan comprobantes reales de transacciones. Buscar por
// todo el dominio bancoguayaquil.com también trae códigos de seguridad,
// casos de soporte y boletines — pero el remitente NO alcanza para filtrar:
// "Banco Guayaquil" manda tanto los consumos reales ("Consumo por $17.82 en
// SUPERCINES") como promociones de conciertos y viajes, desde la MISMA
// dirección. Por eso se combina con un filtro de asunto: solo se buscan
// correos cuyo asunto empiece con un patrón de transacción real CONFIRMADO.
//
// Ojo: "Transacción rechazada" se sacó a propósito — el script nunca crea
// un movimiento para una transacción que no se efectuó, así que no tiene
// sentido ni siquiera descargar ese correo. Por la misma razón no se
// incluyen "Retiro"/"Transferencia"/"Depósito" — nunca se vio un asunto real
// con esos patrones, solo se estaban adivinando. Si algún día aparece un
// tipo de comprobante nuevo (un depósito real, por ejemplo), agrega aquí el
// asunto EXACTO que llegó, no uno adivinado.
var REMITENTES_TRANSACCIONALES = ["BancoGuayaquil@bancoguayaquil.com", "bancavirtual@bancoguayaquil.com"]
var PATRONES_ASUNTO_TRANSACCION = [
  "Consumo por", // compra con tarjeta, ej. "Consumo por $17.82 en SUPERCINES"
  "Orden de", // "Orden de Ahorro Meta" y similares
]

function busquedaGmailTransaccional_(extra) {
  var remitentes = "from:(" + REMITENTES_TRANSACCIONALES.join(" OR ") + ")"
  var asuntos = "subject:(" + PATRONES_ASUNTO_TRANSACCION.map(function (p) { return "\"" + p + "\"" }).join(" OR ") + ")"
  return remitentes + " " + asuntos + (extra ? " " + extra : "")
}

// ==================== FIRESTORE (REST, autorización OAuth propia) ====================

function firestoreFetch_(method, path, payload) {
  var opciones = {
    method: method,
    contentType: "application/json",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    payload: payload ? JSON.stringify(payload) : undefined,
    muteHttpExceptions: true,
  }
  var respuesta = UrlFetchApp.fetch(config_().BASE_URL + "/" + path, opciones)
  return { code: respuesta.getResponseCode(), text: respuesta.getContentText() }
}

function obtenerDocumento_(path) {
  var resultado = firestoreFetch_("get", path)
  if (resultado.code === 404) return null
  if (resultado.code < 200 || resultado.code >= 300) {
    throw new Error("Firestore GET " + resultado.code + ": " + resultado.text)
  }
  return JSON.parse(resultado.text)
}

function guardarDocumento_(path, fields) {
  var resultado = firestoreFetch_("patch", path, { fields: fields })
  if (resultado.code < 200 || resultado.code >= 300) {
    throw new Error("Firestore PATCH " + resultado.code + ": " + resultado.text)
  }
  return JSON.parse(resultado.text)
}

/** PATCH de un solo campo (updateMask) — no toca el resto del documento. */
function actualizarCampoDocumento_(path, fieldName, fieldValue) {
  var campos = {}
  campos[fieldName] = fieldValue
  var resultado = firestoreFetch_("patch", path + "?updateMask.fieldPaths=" + encodeURIComponent(fieldName), {
    fields: campos,
  })
  if (resultado.code < 200 || resultado.code >= 300) {
    throw new Error("Firestore PATCH (mask) " + resultado.code + ": " + resultado.text)
  }
  return JSON.parse(resultado.text)
}

/** Lists every document in a collection (Firestore REST: GET on the collection path itself). */
function listarDocumentos_(path) {
  var resultado = firestoreFetch_("get", path)
  if (resultado.code === 404) return []
  if (resultado.code < 200 || resultado.code >= 300) {
    throw new Error("Firestore GET (lista) " + resultado.code + ": " + resultado.text)
  }
  var data = JSON.parse(resultado.text)
  return data.documents || []
}

// ==================== PUSH (Firebase Cloud Messaging) ====================
//
// Sends real background push via FCM's v1 HTTP API, authorized with this
// script's own OAuth token (needs the "firebase.messaging" scope in
// appsscript.json) — the same free auth mechanism already used for
// Firestore above. No Cloud Functions, no Blaze billing plan: sending FCM
// messages via the v1 API is free on any Firebase plan; only running a
// Cloud Function (a different way to trigger sends) requires Blaze, and
// nothing here uses one. Device tokens are written by the web app itself
// to users/{uid}/pushTokens when the user grants notification permission
// (see lib/push-notifications.ts).
//
// Best-effort: a failure here (no tokens yet, a stale/unregistered token,
// FCM being briefly unavailable) is logged and swallowed — it must never
// interrupt the bank-sync flow that calls it.
function enviarPush_(uid, titulo, cuerpo) {
  try {
    var tokenDocs = listarDocumentos_("users/" + encodeURIComponent(uid) + "/pushTokens")
    if (tokenDocs.length === 0) {
      Logger.log("[Push] Sin tokens registrados para " + uid + ", se omite el envío.")
      return
    }

    var url = "https://fcm.googleapis.com/v1/projects/" + config_().FIRESTORE_PROJECT_ID + "/messages:send"
    tokenDocs.forEach(function (doc) {
      var token = doc.fields && doc.fields.token && doc.fields.token.stringValue
      if (!token) return

      var respuesta = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
        payload: JSON.stringify({ message: { token: token, notification: { title: titulo, body: cuerpo } } }),
        muteHttpExceptions: true,
      })

      if (respuesta.getResponseCode() >= 300) {
        Logger.log("[Push] Error " + respuesta.getResponseCode() + " enviando a un token: " + respuesta.getContentText())
      } else {
        Logger.log("[Push] Enviado: \"" + titulo + "\" — " + cuerpo)
      }
    })
  } catch (error) {
    Logger.log("[Push] ERROR: " + error)
  }
}

function string_(v) { return { stringValue: String(v || "") } }
function number_(v) { return { doubleValue: Number(v) } }
function bool_(v) { return { booleanValue: Boolean(v) } }
function timestamp_(v) { return { timestampValue: new Date(v).toISOString() } }

function safeId_(value) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value))
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, "")
}

/** Milisegundos transcurridos desde un Date.now() capturado antes. Para medir cuánto tarda cada fase. */
function msDesde_(inicio) {
  return new Date().getTime() - inicio
}

// ==================== UBICAR AL USUARIO ====================

function obtenerUidPorEmail_(email) {
  var url = config_().BASE_URL + ":runQuery"
  var opciones = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    payload: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "email" },
            op: "EQUAL",
            value: { stringValue: email },
          },
        },
        limit: 1,
      },
    }),
    muteHttpExceptions: true,
  }
  Logger.log("[UID] Consultando Firestore por email=" + email)
  var respuesta = UrlFetchApp.fetch(url, opciones)
  if (respuesta.getResponseCode() < 200 || respuesta.getResponseCode() >= 300) {
    Logger.log("[UID] Error " + respuesta.getResponseCode() + ": " + respuesta.getContentText())
    throw new Error("Firestore runQuery " + respuesta.getResponseCode() + ": " + respuesta.getContentText())
  }
  var filas = JSON.parse(respuesta.getContentText())
  var nombreDoc = filas[0] && filas[0].document && filas[0].document.name
  var uid = nombreDoc ? nombreDoc.split("/").pop() : null
  Logger.log(uid ? "[UID] Encontrado: " + uid : "[UID] Ningún usuario registrado con ese email.")
  return uid
}

/** Comprueba credenciales y el mapeo de cuenta sin leer Gmail ni crear movimientos. */
function testConfiguration() {
  Logger.log("========== INICIO testConfiguration ==========")
  var c = config_()
  var email = Session.getEffectiveUser().getEmail().toLowerCase().trim()
  var uid = obtenerUidPorEmail_(email)
  var resultado = {
    success: true,
    projectId: c.FIRESTORE_PROJECT_ID,
    groqEnabled: Boolean(c.GROQ_API_KEY),
    groqModel: c.GROQ_MODEL,
    scriptEmail: email,
    userRegistered: Boolean(uid),
  }
  Logger.log("[Resultado] " + JSON.stringify(resultado, null, 2))
  Logger.log("========== FIN testConfiguration ==========")
  return resultado
}

// ==================== PARSEO NATIVO (respaldo sin IA) ====================

function extraerDatosBancoNativo_(texto) {
  var regexMonto = /\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/
  var matchMonto = texto.match(regexMonto)
  if (!matchMonto || !matchMonto[1]) return null

  var montoLimpio = matchMonto[1].replace(/,/g, "")
  var amount = parseFloat(montoLimpio)
  if (isNaN(amount) || amount <= 0) return null

  var description = "Transacción Banco Guayaquil"
  var type = "expense"
  var category = "Otro"

  var textoMinuscula = texto.toLowerCase()

  // Producto "Orden de Ahorro Meta" del banco: el texto trae "Orden de
  // {nombre} Meta" / "TRANSFERENCIA {nombre} META". No hay forma de saber
  // por el texto si fue un aporte o un retiro (ordenante y beneficiario
  // salen con la misma cuenta), así que solo se usa para categorizar el
  // movimiento como "Ahorro" — no se enlaza con nada más.
  var matchAhorroMeta = texto.match(/transferencia\s+(.+?)\s+meta\b/i) || texto.match(/orden de\s+(.+?)\s+meta\b/i)
  if (matchAhorroMeta) {
    var nombreOrdenMeta = matchAhorroMeta[1].trim()
    description = nombreOrdenMeta
      ? "Movimiento de Ahorro Meta: " + nombreOrdenMeta + " (revisa si fue aporte o retiro)"
      : "Movimiento de Ahorro Meta (revisa si fue aporte o retiro)"
    type = "expense"
    category = "Ahorro"
  } else if (
    textoMinuscula.indexOf("recibida") >= 0 ||
    textoMinuscula.indexOf("depósito") >= 0 ||
    textoMinuscula.indexOf("deposito") >= 0 ||
    textoMinuscula.indexOf("acreditación") >= 0 ||
    textoMinuscula.indexOf("acreditacion") >= 0 ||
    textoMinuscula.indexOf("transferencia de") >= 0 ||
    textoMinuscula.indexOf("ingreso") >= 0 ||
    textoMinuscula.indexOf("abono") >= 0
  ) {
    description = "Transferencia recibida / depósito"
    type = "income"
    category = "Transferencia"
  } else if (textoMinuscula.indexOf("retiro") >= 0) {
    description = "Retiro en efectivo"
    type = "expense"
    category = "Retiro"
  } else if (
    textoMinuscula.indexOf("compra") >= 0 ||
    textoMinuscula.indexOf("consumo") >= 0 ||
    textoMinuscula.indexOf("debito") >= 0 ||
    textoMinuscula.indexOf("débito") >= 0
  ) {
    description = "Consumo / compra con tarjeta"
    type = "expense"
    if (/restaurante|comida|delivery|supermercado|supermaxi|comisariato/.test(textoMinuscula)) {
      category = "Comida"
    } else if (/taxi|uber|cabify|gasolina|combustible/.test(textoMinuscula)) {
      category = "Transporte"
    } else if (/suscrip|mensualidad|streaming|netflix|spotify/.test(textoMinuscula)) {
      category = "Suscripción"
    }
  }

  return {
    amount: amount,
    description: description,
    type: type,
    category: category,
  }
}

// ==================== CATEGORIZACIÓN CON GROQ (opcional) ====================

/** Arma el objeto de petición (sin enviarlo) — reutilizable en UrlFetchApp.fetch y fetchAll. */
function construirPeticionGroq_(textoCorreo, datosBase, apiKey) {
  var categorias = datosBase.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  var prompt =
    "Analiza esta notificación bancaria de Banco Guayaquil y deduce el comercio o motivo.\n\n" +
    "Texto del correo:\n\"\"\"\n" + textoCorreo + "\n\"\"\"\n\n" +
    "Datos base detectados:\n- Monto: $" + datosBase.amount + "\n- Tipo: " + datosBase.type + "\n\n" +
    "Elige la categoría MÁS adecuada de esta lista exacta (responde el texto tal cual, sin traducir ni inventar otras):\n" +
    categorias.map(function (c) { return "\"" + c + "\"" }).join(", ") + "\n\n" +
    "Responde ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido, sin introducciones ni bloques markdown. Formato exacto:\n" +
    "{\n  \"category\": \"una de las categorías listadas\",\n  \"description\": \"descripción corta y limpia (ej: 'Compra en Supermaxi')\"\n}"

  var payload = {
    model: config_().GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
  }

  return {
    url: "https://api.groq.com/openai/v1/chat/completions",
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  }
}

/** Interpreta una HTTPResponse de Groq ya recibida (de fetch o fetchAll). */
function procesarRespuestaGroq_(respuesta, datosBase) {
  try {
    var codigo = respuesta.getResponseCode()
    if (codigo !== 200) {
      Logger.log("Error en Groq API (código " + codigo + "): " + respuesta.getContentText())
      return null
    }

    var jsonRespuesta = JSON.parse(respuesta.getContentText())
    if (!jsonRespuesta.choices || jsonRespuesta.choices.length === 0) {
      Logger.log("Groq no devolvió opciones válidas.")
      return null
    }

    var contenidoTexto = jsonRespuesta.choices[0].message.content.trim()
    contenidoTexto = contenidoTexto.replace(/```json|```/g, "").trim()

    var analisis = JSON.parse(contenidoTexto)

    // Nunca confiar ciegamente en la IA: si devuelve una categoría fuera de
    // la lista válida para este tipo, cae a "Otro" en vez de romper el
    // selector fijo de categorías de la app.
    var categorias = datosBase.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
    if (categorias.indexOf(analisis.category) === -1) {
      Logger.log("Groq devolvió una categoría fuera de lista ('" + analisis.category + "'), usando 'Otro'.")
      analisis.category = "Otro"
    }

    return analisis
  } catch (error) {
    Logger.log("Error al procesar respuesta de Groq: " + error.toString())
    return null
  }
}

/** Llamada individual a Groq (usada por el flujo de prueba de un solo correo). */
function analizarTransaccionConGroq_(textoCorreo, datosBase, apiKey) {
  var peticion = construirPeticionGroq_(textoCorreo, datosBase, apiKey)
  try {
    var respuesta = UrlFetchApp.fetch(peticion.url, peticion)
    return procesarRespuestaGroq_(respuesta, datosBase)
  } catch (error) {
    Logger.log("Error al procesar IA con Groq: " + error.toString())
    return null
  }
}

/** Ejecuta peticiones en tandas concurrentes (UrlFetchApp.fetchAll) — evita esperar una por una. */
function fetchAllChunked_(requests, chunkSize) {
  var respuestas = []
  for (var i = 0; i < requests.length; i += chunkSize) {
    var chunk = requests.slice(i, i + chunkSize)
    respuestas = respuestas.concat(UrlFetchApp.fetchAll(chunk))
  }
  return respuestas
}

// ==================== PROCESO PRINCIPAL ====================

// Frases que indican que el dinero NUNCA se movió: la transacción falló,
// fue rechazada o revertida. Estos correos no deben generar un movimiento,
// sin importar qué monto o palabras de "recibido"/"depósito" mencionen.
var FRASES_TRANSACCION_NO_EFECTIVA = [
  "rechazad", // rechazada / rechazado
  "declinad", // declinada / declinado
  "denegad", // denegada / denegado
  "no autorizad",
  "no exitosa",
  "no procesada",
  "no pudo ser procesada",
  "no se pudo procesar",
  "no se pudo completar",
  "no se pudo realizar",
  "fondos insuficientes",
  "saldo insuficiente",
  "transacción fallida",
  "transaccion fallida",
  "transacción reversada",
  "transaccion reversada",
  "reverso de",
]

function parseBankEmail_(message, apiKey) {
  var asunto = message.getSubject() || ""
  var cuerpo = message.getPlainBody() || ""
  var texto = asunto + "\n" + cuerpo
  var textoMinuscula = texto.toLowerCase()

  var asuntoMinuscula = asunto.toLowerCase()
  if (asuntoMinuscula.indexOf("acceso con exito") >= 0 || asuntoMinuscula.indexOf("activa") >= 0 || asuntoMinuscula.indexOf("clave") >= 0) {
    return { skip: true }
  }

  // Chequeo duro antes de cualquier otro análisis: si la transacción no se
  // efectuó, no hay movimiento real que registrar.
  for (var i = 0; i < FRASES_TRANSACCION_NO_EFECTIVA.length; i++) {
    if (textoMinuscula.indexOf(FRASES_TRANSACCION_NO_EFECTIVA[i]) >= 0) {
      return { skip: true }
    }
  }

  var datos = extraerDatosBancoNativo_(texto)
  if (!datos) return null

  if (apiKey) {
    var analisisIA = analizarTransaccionConGroq_(texto, datos, apiKey)
    if (analisisIA) {
      datos.category = analisisIA.category || datos.category
      datos.description = analisisIA.description || datos.description
    }
  }

  var fecha = message.getDate()
  var fechaTexto = Utilities.formatDate(fecha, "America/Guayaquil", "yyyy-MM-dd")

  return {
    type: datos.type,
    amount: datos.amount,
    category: datos.category,
    description: datos.description,
    date: fechaTexto,
    subject: asunto.slice(0, 200),
  }
}

function rutaMovimiento_(uid, message) {
  var documentId = "bg_" + safeId_(message.getId()).slice(0, 36)
  return "users/" + encodeURIComponent(uid) + "/financeMovements/" + documentId
}

function guardarMovimiento_(path, message, datos) {
  var campos = {
    type: string_(datos.type),
    amount: number_(datos.amount),
    category: string_(datos.category),
    description: string_(datos.description),
    date: string_(datos.date),
    createdAt: timestamp_(new Date()),
    source: string_("banco_guayaquil_email"),
    bankEmailId: string_(message.getId()),
    bankSubject: string_(datos.subject),
    automatic: bool_(true),
  }

  guardarDocumento_(path, campos)
}

function peticionGetDocumento_(path) {
  return {
    url: config_().BASE_URL + "/" + path,
    method: "get",
    headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  }
}

/**
 * Lee correos no leídos de Banco Guayaquil y crea movimientos en Firestore.
 *
 * Corre en fases por lotes en vez de un correo a la vez de punta a punta:
 * primero clasifica todo en memoria (gratis, sin red), luego revisa
 * duplicados de TODOS los candidatos en una sola tanda de peticiones
 * concurrentes, y solo llama a Groq (lo más lento, es una IA) para los que
 * de verdad hace falta guardar — nunca para uno que ya estaba duplicado.
 * Antes se hacía Groq -> chequeo de duplicado -> guardar, uno por uno, lo
 * que desperdiciaba llamadas a Groq en correos que ya estaban guardados y
 * hacía que todo avanzara correo por correo en vez de en paralelo.
 */
function procesarMailsBancoGuayaquil() {
  var inicio = new Date().getTime()
  Logger.log("========== INICIO procesarMailsBancoGuayaquil ==========")

  var c = config_()
  Logger.log("[Config] proyecto=" + c.FIRESTORE_PROJECT_ID + " groq=" + (c.GROQ_API_KEY ? "activado (" + c.GROQ_MODEL + ")" : "desactivado"))

  var miEmail = Session.getEffectiveUser().getEmail().toLowerCase().trim()
  Logger.log("Buscando cuenta registrada para: " + miEmail)

  var uidUsuario = obtenerUidPorEmail_(miEmail)
  if (!uidUsuario) {
    Logger.log("No se encontró un usuario registrado con este correo. Abre la app e inicia sesión primero.")
    Logger.log("========== FIN (" + msDesde_(inicio) + " ms) ==========")
    return
  }

  var query = busquedaGmailTransaccional_("is:unread newer_than:30d")
  Logger.log("[Gmail] Búsqueda: " + query)
  var threads = GmailApp.search(query, 0, 100)
  Logger.log("[Gmail] " + threads.length + " hilo(s) encontrado(s) (" + msDesde_(inicio) + " ms)")
  var resumen = { created: 0, duplicates: 0, skipped: 0, ignored: 0, errors: 0 }

  // ---- Fase 1: clasificar cada correo en memoria (sin red) ----
  Logger.log("---- Fase 1: clasificación en memoria ----")
  var candidatos = []
  var mensajesRevisados = 0
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      if (!message.isUnread()) return
      mensajesRevisados++
      try {
        var asunto = message.getSubject() || ""
        var cuerpo = message.getPlainBody() || ""
        var texto = asunto + "\n" + cuerpo
        var textoMinuscula = texto.toLowerCase()
        var asuntoMinuscula = asunto.toLowerCase()

        if (asuntoMinuscula.indexOf("acceso con exito") >= 0 || asuntoMinuscula.indexOf("activa") >= 0 || asuntoMinuscula.indexOf("clave") >= 0) {
          resumen.skipped++
          Logger.log("[Fase 1] Omitido (acceso/activación): \"" + asunto + "\"")
          message.markRead()
          return
        }

        var esNoEfectiva = false
        var fraseDetectada = null
        for (var i = 0; i < FRASES_TRANSACCION_NO_EFECTIVA.length; i++) {
          if (textoMinuscula.indexOf(FRASES_TRANSACCION_NO_EFECTIVA[i]) >= 0) {
            esNoEfectiva = true
            fraseDetectada = FRASES_TRANSACCION_NO_EFECTIVA[i]
            break
          }
        }
        if (esNoEfectiva) {
          resumen.skipped++
          Logger.log("[Fase 1] Omitido (transacción no efectiva, \"" + fraseDetectada + "\"): \"" + asunto + "\"")
          message.markRead()
          return
        }

        var datosBase = extraerDatosBancoNativo_(texto)
        if (!datosBase) {
          // Sin ningún monto "$" detectable, no es un comprobante de
          // movimiento (es un estado de cuenta, promoción, aviso, etc.).
          // Se marca como leído igual — dejarlo sin leer significaría
          // volver a descargarlo y reclasificarlo en CADA corrida de 5
          // minutos para siempre, un gasto de cupo que no lleva a nada. El
          // asunto queda en el log por si de verdad hacía falta revisarlo.
          resumen.ignored++
          Logger.log("[Fase 1] Ignorado (sin monto detectable): \"" + asunto + "\"")
          message.markRead()
          return
        }

        Logger.log(
          "[Fase 1] Candidato: \"" + asunto + "\" -> $" + datosBase.amount +
          " tipo=" + datosBase.type + " categoría=" + datosBase.category
        )

        candidatos.push({
          message: message,
          texto: texto,
          textoMinuscula: textoMinuscula,
          asunto: asunto,
          datosBase: datosBase,
          path: rutaMovimiento_(uidUsuario, message),
        })
      } catch (error) {
        resumen.errors++
        Logger.log("[Fase 1] ERROR en correo " + message.getId() + ": " + error)
      }
    })
  })
  Logger.log(
    "[Fase 1] Revisados " + mensajesRevisados + " correo(s) sin leer -> " +
    candidatos.length + " candidato(s), " + resumen.skipped + " omitido(s), " +
    resumen.ignored + " ignorado(s) (" + msDesde_(inicio) + " ms)"
  )

  if (candidatos.length === 0) {
    Logger.log("[Resumen] " + JSON.stringify(resumen))
    Logger.log("========== FIN (" + msDesde_(inicio) + " ms) ==========")
    return resumen
  }

  // ---- Fase 2: chequeo de duplicados de TODOS los candidatos, en tandas concurrentes ----
  Logger.log("---- Fase 2: chequeo de duplicados (" + candidatos.length + " petición/es en tandas de 20) ----")
  var dupRespuestas = fetchAllChunked_(
    candidatos.map(function (cand) { return peticionGetDocumento_(cand.path) }),
    20,
  )
  var pendientes = []
  candidatos.forEach(function (cand, i) {
    if (dupRespuestas[i].getResponseCode() === 200) {
      resumen.duplicates++
      Logger.log("[Fase 2] Ya existía (duplicado): \"" + cand.asunto + "\"")
      cand.message.markRead()
    } else {
      pendientes.push(cand)
    }
  })
  Logger.log("[Fase 2] " + resumen.duplicates + " duplicado(s), " + pendientes.length + " por guardar (" + msDesde_(inicio) + " ms)")

  if (pendientes.length === 0) {
    Logger.log("[Resumen] " + JSON.stringify(resumen))
    Logger.log("========== FIN (" + msDesde_(inicio) + " ms) ==========")
    return resumen
  }

  // ---- Fase 3: Groq en tandas concurrentes, solo para los que sí se van a guardar ----
  if (c.GROQ_API_KEY) {
    Logger.log("---- Fase 3: categorización con Groq (" + pendientes.length + " petición/es en tandas de 10) ----")
    var groqRespuestas = fetchAllChunked_(
      pendientes.map(function (cand) { return construirPeticionGroq_(cand.texto, cand.datosBase, c.GROQ_API_KEY) }),
      10,
    )
    var groqOk = 0
    pendientes.forEach(function (cand, i) {
      var analisis = procesarRespuestaGroq_(groqRespuestas[i], cand.datosBase)
      if (analisis) {
        groqOk++
        var categoriaAnterior = cand.datosBase.category
        cand.datosBase.category = analisis.category || cand.datosBase.category
        cand.datosBase.description = analisis.description || cand.datosBase.description
        Logger.log(
          "[Fase 3] \"" + cand.asunto + "\": categoría " + categoriaAnterior + " -> " + cand.datosBase.category +
          ", descripción=\"" + cand.datosBase.description + "\""
        )
      } else {
        Logger.log("[Fase 3] Sin respuesta útil de Groq para \"" + cand.asunto + "\", se usa el categorizador nativo.")
      }
    })
    Logger.log("[Fase 3] " + groqOk + "/" + pendientes.length + " categorizados por IA (" + msDesde_(inicio) + " ms)")
  } else {
    Logger.log("---- Fase 3: Groq desactivado, se usa el categorizador nativo para los " + pendientes.length + " candidato(s) ----")
  }

  // ---- Fase 4: guardar movimientos ----
  Logger.log("---- Fase 4: guardando " + pendientes.length + " movimiento(s) ----")
  pendientes.forEach(function (cand) {
    try {
      var fecha = cand.message.getDate()
      var datos = {
        type: cand.datosBase.type,
        amount: cand.datosBase.amount,
        category: cand.datosBase.category,
        description: cand.datosBase.description,
        date: Utilities.formatDate(fecha, "America/Guayaquil", "yyyy-MM-dd"),
        subject: cand.asunto.slice(0, 200),
      }

      guardarMovimiento_(cand.path, cand.message, datos)
      resumen.created++
      Logger.log(
        "[Fase 4] Guardado: " + datos.date + " · " + datos.type + " · $" + datos.amount +
        " · " + datos.category + " · \"" + datos.description + "\""
      )

      var signo = datos.type === "income" ? "+" : "-"
      enviarPush_(
        uidUsuario,
        datos.type === "income" ? "Nuevo ingreso" : "Nuevo gasto",
        signo + "$" + datos.amount + " · " + datos.description
      )

      cand.message.markRead()
    } catch (error) {
      resumen.errors++
      Logger.log("[Fase 4] ERROR guardando correo " + cand.message.getId() + ": " + error)
    }
  })

  Logger.log("[Resumen] " + JSON.stringify(resumen))
  Logger.log("========== FIN (" + msDesde_(inicio) + " ms) ==========")
  return resumen
}

// ==================== TRIGGER AUTOMÁTICO ====================

function createAutomaticTrigger() {
  var existentes = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === "procesarMailsBancoGuayaquil"
  })
  Logger.log("[Trigger] Eliminando " + existentes.length + " trigger(s) existente(s) de procesarMailsBancoGuayaquil.")
  existentes.forEach(function (trigger) { ScriptApp.deleteTrigger(trigger) })
  ScriptApp.newTrigger("procesarMailsBancoGuayaquil").timeBased().everyMinutes(5).create()
  Logger.log("[Trigger] Creado: procesarMailsBancoGuayaquil cada 5 minutos.")
}

function removeAutomaticTrigger() {
  var existentes = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === "procesarMailsBancoGuayaquil"
  })
  Logger.log("[Trigger] Eliminando " + existentes.length + " trigger(s) de procesarMailsBancoGuayaquil.")
  existentes.forEach(function (trigger) { ScriptApp.deleteTrigger(trigger) })
}

// ==================== PRUEBA MANUAL ====================

/** Analiza el correo más reciente de Banco Guayaquil sin guardar nada. */
function testLatestBancoGuayaquilEmail() {
  Logger.log("========== INICIO testLatestBancoGuayaquilEmail ==========")
  var c = config_()

  Logger.log("[Gmail] Buscando los 5 correos más recientes de remitentes transaccionales...")
  var threads = GmailApp.search(busquedaGmailTransaccional_("newer_than:30d"), 0, 5)
  if (!threads.length) {
    Logger.log("[Gmail] No se encontraron correos recientes.")
    throw new Error("No se encontraron correos recientes de Banco Guayaquil")
  }
  var todosLosMensajes = threads.reduce(function (acc, t) { return acc.concat(t.getMessages()) }, [])
  todosLosMensajes.sort(function (a, b) { return b.getDate() - a.getDate() })
  Logger.log("[Gmail] " + todosLosMensajes.length + " mensaje(s) encontrados. Analizando el más reciente: \"" + todosLosMensajes[0].getSubject() + "\"")
  var datos = parseBankEmail_(todosLosMensajes[0], c.GROQ_API_KEY)
  Logger.log("[Resultado] " + JSON.stringify(datos, null, 2))
  Logger.log("========== FIN testLatestBancoGuayaquilEmail ==========")
  return datos
}

// ==================== WEBHOOK SALUD (Apple Salud vía Atajos) ====================
//
// Recibe peso/estatura desde un Atajo de iOS y los guarda en Firestore, en
// las mismas colecciones que ya usa la pestaña Nutrición → Peso de la app
// (users/{uid}/bodyWeight) y el perfil (users/{uid}.nutritionProfile.heightCm).
//
// Para activarlo:
//   1. Agrega la propiedad de script HEALTH_WEBHOOK_SECRET con un valor
//      largo y aleatorio que solo tú conozcas.
//   2. Implementar > Nueva implementación > Tipo: Aplicación web.
//      "Ejecutar como": Yo (imprescindible — así el Atajo no necesita
//      iniciar sesión en Google, el script sigue usando tu identidad).
//      "Quién tiene acceso": Cualquier usuario.
//   3. Copia la URL de la implementación (termina en /exec) — es la que
//      usa el Atajo de iOS.
//
// El Atajo debe mandar un POST con JSON:
//   { "secret": "...", "weightKg": 70.5, "heightCm": 175, "date": "2026-08-18" }
// "date" es opcional (por defecto, hoy). "heightCm" es opcional — normalmente
// solo hace falta mandarlo una vez, no en cada corrida diaria.

function doPost(e) {
  try {
    var c = config_()
    if (!c.HEALTH_WEBHOOK_SECRET) {
      Logger.log("[Health] Falta la propiedad HEALTH_WEBHOOK_SECRET.")
      return respuestaJson_({ success: false, error: "Webhook no configurado (falta HEALTH_WEBHOOK_SECRET)" })
    }

    var body = {}
    try {
      body = JSON.parse((e.postData && e.postData.contents) || "{}")
    } catch (parseError) {
      return respuestaJson_({ success: false, error: "JSON inválido" })
    }

    if (body.secret !== c.HEALTH_WEBHOOK_SECRET) {
      Logger.log("[Health] Intento con secreto incorrecto.")
      return respuestaJson_({ success: false, error: "No autorizado" })
    }

    var miEmail = Session.getEffectiveUser().getEmail().toLowerCase().trim()
    var uidUsuario = obtenerUidPorEmail_(miEmail)
    if (!uidUsuario) {
      return respuestaJson_({ success: false, error: "Usuario no encontrado (" + miEmail + ")" })
    }

    var fecha = body.date || Utilities.formatDate(new Date(), "America/Guayaquil", "yyyy-MM-dd")
    var resultado = { success: true, date: fecha }

    if (typeof body.weightKg === "number" && body.weightKg > 0) {
      var pesoPath = "users/" + encodeURIComponent(uidUsuario) + "/bodyWeight/health_" + fecha
      guardarDocumento_(pesoPath, {
        date: string_(fecha),
        weightKg: number_(body.weightKg),
        createdAt: timestamp_(new Date()),
        source: string_("apple_health"),
      })
      resultado.weightKg = body.weightKg
      Logger.log("[Health] Peso guardado: " + body.weightKg + " kg (" + fecha + ")")
    }

    if (typeof body.heightCm === "number" && body.heightCm > 0) {
      actualizarAlturaPerfil_(uidUsuario, body.heightCm)
      resultado.heightCm = body.heightCm
      Logger.log("[Health] Estatura actualizada: " + body.heightCm + " cm")
    }

    if (!resultado.weightKg && !resultado.heightCm) {
      return respuestaJson_({ success: false, error: "No se envió weightKg ni heightCm válidos" })
    }

    if (resultado.weightKg) {
      enviarPush_(uidUsuario, "Peso actualizado", resultado.weightKg + " kg registrados desde Salud")
    }

    return respuestaJson_(resultado)
  } catch (error) {
    Logger.log("[Health] ERROR: " + error)
    return respuestaJson_({ success: false, error: String(error) })
  }
}

/** Actualiza SOLO users/{uid}.nutritionProfile.heightCm sin tocar el resto del perfil (sexo, edad, actividad). */
function actualizarAlturaPerfil_(uid, heightCm) {
  var path = "users/" + encodeURIComponent(uid)
  var resultado = firestoreFetch_("patch", path + "?updateMask.fieldPaths=" + encodeURIComponent("nutritionProfile.heightCm"), {
    fields: {
      nutritionProfile: {
        mapValue: {
          fields: {
            heightCm: number_(heightCm),
          },
        },
      },
    },
  })
  if (resultado.code < 200 || resultado.code >= 300) {
    throw new Error("Firestore PATCH altura " + resultado.code + ": " + resultado.text)
  }
}

/**
 * Apps Script no permite fijar el código de estado HTTP de una Aplicación
 * web (siempre responde 200 al llamador) — la señal real de éxito/error va
 * dentro del JSON, en el campo "success".
 */
function respuestaJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}