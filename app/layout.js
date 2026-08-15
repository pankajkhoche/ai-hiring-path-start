import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'

const SITE_URL = 'https://aihiringpath.in';
const TITLE = 'AI Hiring Path — The AI Career Intelligence Platform';
const DESCRIPTION = 'Beat the ATS, ace interviews, and land your dream job with AI. Resume analysis, AI career coach, AI interview simulator, timed aptitude/communication/technical assessments, and a personalized career roadmap. Start with 3 months free.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s — AI Hiring Path' },
  description: DESCRIPTION,
  keywords: ['ATS resume checker', 'AI interview practice', 'resume score', 'career roadmap', 'job search AI', 'technical assessment practice', 'AI career coach', 'placement preparation India'],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: 'AI Hiring Path',
    locale: 'en_IN',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/opengraph-image'],
  },
}

const ORG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'AI Hiring Path',
  url: SITE_URL,
  logo: `${SITE_URL}/icon`,
  sameAs: [],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&display=swap" rel="stylesheet" />
        <style>{`:root { --font-display: 'Fraunces', Georgia, serif; }`}</style>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }} />
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
