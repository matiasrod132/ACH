/**
 * The app's canonical public origin, e.g. "https://ach.podsio.online".
 *
 * Deliberately NOT derived from the incoming request on platforms like
 * Netlify/Vercel — behind their proxy, `request.url`'s origin can resolve to
 * an internal deploy subdomain (e.g. "master--your-site.netlify.app")
 * instead of the custom domain, which breaks Google OAuth's exact-match
 * redirect_uri requirement. Set APP_URL in production; falls back to the
 * request's own origin only when unset (convenient for local dev, where
 * that's genuinely correct — http://localhost:3000).
 */
export function getAppOrigin(request: Request): string {
  return process.env.APP_URL || new URL(request.url).origin
}
