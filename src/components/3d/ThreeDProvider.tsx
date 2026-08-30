import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThreeDContextType {
  isSupported: boolean;
  prefersReducedMotion: boolean;
  isMobile: boolean;
}

const ThreeDContext = createContext<ThreeDContextType>({
  isSupported: false,
  prefersReducedMotion: false,
  isMobile: false,
});

export const useThreeD = () => useContext(ThreeDContext);

export const ThreeDProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect WebGL support
    const checkWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(
          window.WebGLRenderingContext &&
          (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        );
      } catch {
        return false;
      }
    };

    // 2. Detect reduced motion preference
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    motionQuery.addEventListener('change', handleMotionChange);

    // 3. Detect mobile viewport
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    setIsSupported(checkWebGL());

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return (
    <ThreeDContext.Provider value={{ isSupported, prefersReducedMotion, isMobile }}>
      {children}
    </ThreeDContext.Provider>
  );
};
