import { Suspense } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import LoginFormContainer from "./form/login-form-container";
import { LanguageToggle } from '@/components/language-toggle';
import { Logo } from '@/modules/landing/components/logo';

export default function LoginContent() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="p-4 flex items-center justify-between">
        <Logo />
        <div className='flex items-center gap-2'>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <Suspense fallback={<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />}>
          <LoginFormContainer />
        </Suspense>
      </main>
    </div>
  );
}
