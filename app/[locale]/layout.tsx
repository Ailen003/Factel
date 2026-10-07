import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations } from 'next-intl/server'
import { Analytics } from '@vercel/analytics/next'
import { routing } from '@/i18n/routing'
import ProgressBar from '@/components/progress-bar/progress-bar'
import { ThemeProvider } from '@/components/theme-provider'
import '../globals.css'

function resolveMetadataBase(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  return new URL(configuredUrl ?? (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000'))
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#242423' },
  ],
  colorScheme: 'light dark',
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })

  return {
    metadataBase: resolveMetadataBase(),
    title: {
      default: t('title'),
      template: `%s — ${t('title')}`,
    },
    description: t('description'),
    applicationName: t('title'),
    generator: 'Next.js',
    openGraph: {
      type: 'website',
      siteName: t('title'),
      title: t('title'),
      description: t('description'),
      locale,
      images: {
        url: '/conversation-processing-demo-social.png',
        width: 1746,
        height: 909,
        alt: t('title'),
      },
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: {
        url: '/conversation-processing-demo-social.png',
        width: 1746,
        height: 909,
        alt: t('title'),
      },
    },
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <html lang={locale} className="bg-background" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <ProgressBar>{children}</ProgressBar>
          </NextIntlClientProvider>
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}
