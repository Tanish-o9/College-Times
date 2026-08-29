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

      if (customFallback) {
        navigate(customFallback);
        return;
      }

      // Logical parent fallback mappings
      if (currentPath.includes('/members')) {
        navigate(currentPath.replace('/members', ''));
      } else if (currentPath.includes('/settings')) {
        navigate(currentPath.split('/settings')[0] || '/settings');
      } else if (currentPath.includes('/moderation')) {
        navigate(currentPath.replace('/moderation', ''));
      } else if (currentPath.includes('/dashboard')) {
        navigate(currentPath.replace('/dashboard', ''));
      } else if (currentPath.includes('/insights')) {
        navigate(currentPath.replace('/insights', ''));
      } else if (currentPath.startsWith('/groups/')) {
        navigate('/groups');
      } else if (currentPath.startsWith('/clubs/')) {
        navigate('/clubs');
      } else if (currentPath.startsWith('/marketplace/')) {
        navigate('/marketplace');
      } else if (currentPath.startsWith('/events/')) {
        navigate('/events');
      } else if (currentPath.startsWith('/incidents/')) {
        navigate('/my-reports');
      } else if (currentPath.startsWith('/my-reports/')) {
        navigate('/my-reports');
      } else if (currentPath.includes('/questions/')) {
        const subjectPath = currentPath.split('/questions/')[0];
        navigate(subjectPath || '/academic');
      } else if (currentPath.startsWith('/academic/subjects/')) {
        navigate('/academic');
      } else if (currentPath.startsWith('/chat/')) {
        navigate('/channels');
      } else if (currentPath.startsWith('/messages/')) {
        navigate('/messages');
      } else if (currentPath.startsWith('/profile/')) {
        navigate('/discover');
      } else {
        navigate('/');
      }
    }
  };

  return goBack;
};
