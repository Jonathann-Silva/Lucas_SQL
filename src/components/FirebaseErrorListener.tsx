
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * Componente que ouve erros de permissão do Firestore globalmente e exibe toasts
 * ou lança exceções capturáveis pelo overlay de desenvolvimento.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Em desenvolvimento, lançar o erro para o Next.js exibir o overlay detalhado
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }

      // Em produção, exibir um toast amigável
      toast({
        variant: "destructive",
        title: "Erro de Permissão",
        description: `Você não tem autorização para realizar esta operação em ${error.context.path}.`,
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => errorEmitter.off('permission-error', handlePermissionError);
  }, [toast]);

  return null;
}
