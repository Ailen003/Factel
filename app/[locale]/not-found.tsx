import { useTranslations } from 'next-intl'

export default function NotFound() {
  const t = useTranslations('common')

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-muted-foreground mt-2">{t('notFound')}</p>
      </div>
    </div>
  )
}
