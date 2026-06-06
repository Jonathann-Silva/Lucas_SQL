
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  type Firestore 
} from 'firebase/firestore';
import { firebaseConfig } from './config';

/**
 * Inicializa os serviços do Firebase com cache persistente ativado.
 * Isso salva os dados localmente no navegador, reduzindo drasticamente as leituras no servidor
 * e economizando a quota diária do plano gratuito/pago.
 */
export function initializeFirebase() {
  const apps = getApps();
  const firebaseApp = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  
  let firestore: Firestore;
  
  // Se o app já estiver inicializado, pegamos a instância existente.
  // Caso contrário, inicializamos com as configurações de cache persistente.
  if (apps.length > 0) {
    firestore = getFirestore(firebaseApp);
  } else {
    firestore = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager() // Permite cache compartilhado entre várias abas
      })
    });
  }

  return { firebaseApp, auth, firestore };
}

export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-doc';
export * from './firestore/use-collection';
