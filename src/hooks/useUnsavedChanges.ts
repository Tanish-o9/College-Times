import { useEffect } from 'react';

/**
 * Reusable hook to protect against unsaved changes in forms.
 * Triggers browser-native beforeunload for refresh/tab-close,
 * and provides a helper function to confirm inside-app navigation.
 */
export const useUnsavedChanges = (hasChanges: boolean) => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges]);

  const confirmNavigation = (onConfirm: () => void) => {
    if (hasChanges) {
      const confirm = window.confirm('Discard unsaved changes?');
      if (confirm) {
        onConfirm();
      }
    } else {
      onConfirm();
    }
  };

  return { confirmNavigation };
};
