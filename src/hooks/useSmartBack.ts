import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Custom hook for smart, loops-free back navigation.
 * Uses window.history.state to trace internal stack or redirects to logical fallback paths.
 */
export const useSmartBack = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = (customFallback?: string) => {
    // If the index in the history stack is > 0, we can safely navigate(-1) internally.
    const historyIndex = window.history.state?.idx ?? 0;

    if (historyIndex > 0) {
      navigate(-1);
    } else {
      const currentPath = location.pathname;
      const search = location.search || '';
      const state = location.state;

      const navigateFallback = (targetPath: string) => {
        navigate(targetPath + search, { state });
      };

      if (customFallback) {
        navigateFallback(customFallback);
        return;
      }

      // Logical parent fallback mappings
      if (currentPath.includes('/members')) {
        navigateFallback(currentPath.replace('/members', ''));
      } else if (currentPath.includes('/settings')) {
        navigateFallback(currentPath.split('/settings')[0] || '/settings');
      } else if (currentPath.includes('/moderation')) {
        navigateFallback(currentPath.replace('/moderation', ''));
      } else if (currentPath.includes('/dashboard')) {
        navigateFallback(currentPath.replace('/dashboard', ''));
      } else if (currentPath.includes('/insights')) {
        navigateFallback(currentPath.replace('/insights', ''));
      } else if (currentPath.startsWith('/groups/')) {
        navigateFallback('/groups');
      } else if (currentPath.startsWith('/clubs/')) {
        navigateFallback('/clubs');
      } else if (currentPath.startsWith('/marketplace/')) {
        navigateFallback('/marketplace');
      } else if (currentPath.startsWith('/events/')) {
        navigateFallback('/events');
      } else if (currentPath.startsWith('/incidents/')) {
        navigateFallback('/my-reports');
      } else if (currentPath.startsWith('/my-reports/')) {
        navigateFallback('/my-reports');
      } else if (currentPath.includes('/questions/')) {
        const subjectPath = currentPath.split('/questions/')[0];
        navigateFallback(subjectPath || '/academic');
      } else if (currentPath.startsWith('/academic/subjects/')) {
        navigateFallback('/academic');
      } else if (currentPath.startsWith('/chat/')) {
        navigateFallback('/channels');
      } else if (currentPath.startsWith('/messages/')) {
        navigateFallback('/messages');
      } else if (currentPath.startsWith('/profile/')) {
        navigateFallback('/discover');
      } else {
        navigateFallback('/');
      }
    }
  };

  return goBack;
};
