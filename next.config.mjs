import createNextIntlPlugin from 'next-intl/plugin'
import { withWorkflow } from 'workflow/next'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default withWorkflow(withNextIntl(nextConfig))
