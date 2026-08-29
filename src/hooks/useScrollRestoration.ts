import { useEffect } from 'react';

/**
 * Reusable hook to preserve list scroll position.
 * Caches window scroll position on scroll in sessionStorage,
 * and restores it automatically once data is resolved (isLoaded === true).
 */
export const useScrollRestoration = (key: string, isLoaded: boolean) => {
  useEffect(() => {
    if (!isLoaded) return;

    const savedPos = sessionStorage.getItem(`scroll_${key}`);
    if (savedPos) {
      const pos = parseInt(savedPos, 10);
      if (!isNaN(pos) && pos > 0) {
        // Delay slightly to let React finish rendering the elements in the DOM
        const timer = setTimeout(() => {
          window.scrollTo(0, pos);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [key, isLoaded]);

  useEffect(() => {
    const handleScroll = () => {
      // Save scroll position when scrolled down
      sessionStorage.setItem(`scroll_${key}`, window.scrollY.toString());
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [key]);
};
