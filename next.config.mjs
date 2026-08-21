/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // firebase-admin (used by the multi-user Gmail sync server routes) pulls
  // in `jose`/`jwks-rsa` for token verification, which ships ESM-only
  // subpaths that serverless bundlers (Netlify Functions, Vercel) choke on
  // when they try to bundle it — "ERR_REQUIRE_ESM ... jose ... jwks-rsa" at
  // runtime, even though a plain `next build && next start` works fine
  // locally. Marking it external tells Next.js to leave it for Node's own
  // require/import resolution at runtime instead of bundling it.
  serverExternalPackages: ["firebase-admin"],
  // Empty on purpose: only used by `npm run dev:turbo` (Turbopack). Declaring
  // it explicitly stops Next from complaining about the webpack config below
  // being ambiguous between the two bundlers.
  //
  // `npm run dev` (the default) uses webpack instead — on this machine,
  // Turbopack's dev server reliably deadlocks in its PostCSS transform
  // worker (confirmed via idle CPU across the whole process tree while
  // stuck on "Compiling /"). If a future Next.js release fixes it, `npm run
  // dev:turbo` still works to try Turbopack again.
  turbopack: {},
  // Polling file watch — fallback for when Windows file-watch events get
  // dropped and normal hot reload stops picking up changes.
  webpack: (config) => {
    config.watchOptions = {
      poll: 800,
      aggregateTimeout: 300,
    }
    return config
  },
}

export default nextConfig
