import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ensureUserDocument, signOutUser } from '../services/authService';
import { initUserPresence } from '../services/presenceService';
import type { User } from '../types';

export interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  refreshProfile: (targetUid?: string) => Promise<void>;
  signOut: () => Promise<void>;
  setCurrentUser: React.Dispatch<React.SetStateAction<FirebaseUser | null>>;
  setUserProfile: React.Dispatch<React.SetStateAction<User | null>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setUserProfile(snap.data() as User);
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setUserProfile(null);
    }
  };

  const refreshProfile = async (targetUid?: string) => {
    const uid = targetUid || currentUser?.uid;
    if (!uid) {
      setUserProfile(null);
      return;
    }
    await fetchProfile(uid);
  };

  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
    setUserProfile(null);
  };

  useEffect(() => {
    let presenceCleanup: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (presenceCleanup) {
        presenceCleanup();
        presenceCleanup = null;
      }

      try {
        if (user) {
          setCurrentUser(user);
          presenceCleanup = initUserPresence(user.uid);
          await ensureUserDocument(user);
          await fetchProfile(user.uid);
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
      } catch (err) {
        console.error('Error in auth state listener:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (presenceCleanup) presenceCleanup();
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider 
      value={{ 
        currentUser, 
        userProfile, 
        loading, 
        refreshProfile, 
        signOut: handleSignOut,
        setCurrentUser, 
        setUserProfile 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};



