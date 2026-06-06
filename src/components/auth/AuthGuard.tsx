
'use client';

import { useUser } from '@/firebase';
import { LoginScreen } from './LoginScreen';
import { Loader2 } from 'lucide-react';

/**
 * Provedor que bloqueia o acesso ao conteúdo se o usuário não estiver logado.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <Loader2 className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
          Validando Credenciais...
        </p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
