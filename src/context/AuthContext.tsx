import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ensureUserDocument, signOutUser } from '../services/authService';
import { initUserPresence } from '../services/presenceService';
import type { User } from '../types';
import toast from 'react-hot-toast';

import { isEmailAdmin } from '../services/adminNotificationService';

export interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  isAdmin: boolean;
  isBlocked: boolean;
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

const getInitialDevUser = () => {
  try {
    const stored = localStorage.getItem('college_times_dev_session');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialDevUser = getInitialDevUser();

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(initialDevUser);
  const [userProfile, setUserProfile] = useState<User | null>(() => {
    if (!initialDevUser) return null;
    return {
      uid: initialDevUser.uid,
      displayName: initialDevUser.displayName || 'Student',
      email: initialDevUser.email,
      role: 'student',
      points: 10,
      joinedChannelIds: ['general', 'admin-announcements'],
      createdAt: new Date() as any,
      lastLoginAt: new Date() as any,
    };
  });
  const [loading, setLoading] = useState<boolean>(!initialDevUser);

  const fetchProfile = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data() as User;
        if (data.profileStatus === 'suspended') {
          await signOutUser();
          setCurrentUser(null);
          setUserProfile(null);
          localStorage.removeItem('college_times_dev_session');
          toast.error('Your account has been suspended by campus administration.');
          return;
        }
        setUserProfile(data);
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
    localStorage.removeItem('college_times_dev_session');
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
          // Check local stored session fallback for email OTP dev mode
          const storedDevUser = localStorage.getItem('college_times_dev_session');
          if (storedDevUser) {
            try {
              const devUserData = JSON.parse(storedDevUser);
              setCurrentUser(devUserData as any);
              setUserProfile({
                uid: devUserData.uid,
                displayName: devUserData.displayName || 'Student',
                email: devUserData.email,
                role: 'student',
                points: 10,
                joinedChannelIds: ['general', 'admin-announcements'],
                createdAt: new Date() as any,
                lastLoginAt: new Date() as any,
              });
            } catch (pErr) {
              setCurrentUser(null);
              setUserProfile(null);
            }
          } else {
            setCurrentUser(null);
            setUserProfile(null);
          }
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

  const isAdmin = Boolean(
    currentUser &&
      (userProfile?.role === 'admin' || isEmailAdmin(currentUser.email))
  );

  const isBlocked = Boolean(
    userProfile?.moderationStatus === 'blocked' || userProfile?.profileStatus === 'suspended'
  );

  return (
    <AuthContext.Provider 
      value={{ 
        currentUser, 
        userProfile, 
        isAdmin,
        isBlocked,
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



