import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { 
  getChatFeatureFlag, 
  isChatEnabledForUser, 
  type ChatFeatureFlag 
} from '../services/featureFlagService';

export interface ChatAccessState {
  loading: boolean;
  isEligible: boolean;
  flag: ChatFeatureFlag | null;
  rolloutPercentage: number;
}

export const useChatAccess = (): ChatAccessState => {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [isEligible, setIsEligible] = useState<boolean>(false);
  const [flag, setFlag] = useState<ChatFeatureFlag | null>(null);

  useEffect(() => {
    if (authLoading) return;

    let isMounted = true;
    setLoading(true);

    getChatFeatureFlag()
      .then((f) => {
        if (!isMounted) return;
        setFlag(f);
        const eligible = isChatEnabledForUser(currentUser?.uid, userProfile?.role, f);
        setIsEligible(eligible);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsEligible(userProfile?.role === 'admin');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid, userProfile?.role, authLoading]);

  return {
    loading: loading || authLoading,
    isEligible,
    flag,
    rolloutPercentage: flag?.rolloutPercentage ?? 0,
  };
};
