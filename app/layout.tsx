import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
})

const DESCRIPTION =
  'Convierte tus hábitos en un juego. Gana XP, sube de nivel y controla tus hábitos, gastos e hidratación. Olvídate de las hojas de cálculo.'

export const metadata: Metadata = {
  metadataBase: new URL('https://ach.podsio.online'),
  title: 'StarkLab — Convierte tus hábitos en un juego',
  description: DESCRIPTION,
  generator: 'v0.app',
  applicationName: 'StarkLab',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'StarkLab',
  },
  verification: {
    google: '1YeGhEuiB9OdYOMFJKk8WAcZNILQ-ViCdCejxG7GGBQ',
  },
  // Explicit, machine-readable name/purpose — added because Google's OAuth
  // brand verification kept flagging a name mismatch / missing purpose even
  // though the homepage's own text clearly says both; automated checks like
  // that one likely read structured Open Graph data rather than parsing
  // free-form marketing copy.
  openGraph: {
    title: 'StarkLab',
    description: DESCRIPTION,
    siteName: 'StarkLab',
    url: 'https://ach.podsio.online',
    locale: 'es_419',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'StarkLab',
    description: DESCRIPTION,
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#131315',
  userScalable: false,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${plexMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
