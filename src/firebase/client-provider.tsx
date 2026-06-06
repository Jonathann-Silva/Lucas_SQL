
'use client';

import { ReactNode, useMemo } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';

/**
 * Provedor do lado do cliente que inicializa o Firebase apenas uma vez.
 * Isso evita erros de serialização ao tentar passar instâncias do Firebase
 * de Server Components para Client Components.
 */
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const { firebaseApp, firestore, auth } = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseProvider firebaseApp={firebaseApp} firestore={firestore} auth={auth}>
      {children}
    </FirebaseProvider>
  );
}
