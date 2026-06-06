'use client';

import { useEffect, useState } from 'react';
import { errorEmitter } from '../error-emitter';

export function useCollection<T = any>(collectionQuery: any | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!collectionQuery || !collectionQuery.path) {
      setLoading(false);
      return;
    }

    const path = collectionQuery.path; // e.g. "deliveries" ou "stores"

    let isMounted = true;
    let interval: NodeJS.Timeout;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/${path}`);
        if (!res.ok) throw new Error('Failed to fetch data');
        const json = await res.json();
        
        // Emular o toDate() do Firestore timestamp para manter compatibilidade com a view
        const formattedData = json.map((item: any) => {
           if (item.timestamp) {
             const rawTimestamp = item.timestamp;
             item.timestamp = { 
               toDate: () => new Date(rawTimestamp),
               seconds: Math.floor(new Date(rawTimestamp).getTime() / 1000)
             };
           }
           return item;
        });

        if (isMounted) {
          setData(formattedData);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      }
    };

    // Executa imediatamente
    fetchData();
    
    // Polling a cada 5 segundos para simular "Real-Time" do Firestore
    interval = setInterval(fetchData, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [collectionQuery?.path]); // Depende do path

  return { data, loading, error };
}
