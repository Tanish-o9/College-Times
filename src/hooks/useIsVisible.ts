import { useEffect, useState, useRef, type RefObject } from 'react';

/**
 * Custom hook using IntersectionObserver to detect when an element enters the viewport.
 * Used for Infinite Scroll sentinel triggers.
 */
export const useIsVisible = <T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit
): [RefObject<T | null>, boolean] => {
  const containerRef = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
    }, options);

    observer.observe(target);

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [options]);

  return [containerRef, isVisible];
};

export default useIsVisible;
