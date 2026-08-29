import { useEffect, useRef } from 'react';

/**
 * Custom hook to intercept browser back button (popstate) when an overlay/modal is open.
 * Pushes a dummy state to history when opened and closes the overlay on popstate.
 */
export const useOverlayBackHandler = (isOpen: boolean, onClose: () => void) => {
  const isPushedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    // Push state so back button pops this state first
    window.history.pushState({ overlayOpen: true }, '');
    isPushedRef.current = true;

    const handlePopState = () => {
      if (isPushedRef.current) {
        isPushedRef.current = false;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (isPushedRef.current) {
        isPushedRef.current = false;
        // Clean up history stack if overlay was closed via UI button instead of back button
        if (window.history.state?.overlayOpen) {
          window.history.back();
        }
      }
    };
  }, [isOpen]);
};
