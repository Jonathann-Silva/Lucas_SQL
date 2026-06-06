'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useAuth } from '../provider';

const ADMIN_EMAILS = ['jonathan.silva.992.js@gmail.com'];

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
  }, [auth]);

  const isAdmin = user ? ADMIN_EMAILS.includes(user.email || '') : false;

  return { 
    user, 
    isAdmin,
    isLoading: user === undefined 
  };
}
