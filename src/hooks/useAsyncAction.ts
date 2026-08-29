import { useState, useCallback, useRef, useEffect } from 'react';
import { classifyAndMapError } from '../services/errorService';

interface UseAsyncActionResult<T, Args extends any[]> {
  isLoading: boolean;
  error: string | null;
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
}

/**
 * Custom React hook to wrap async operations.
 * Protects against double-submission / race conditions and handles centralized errors.
 */
export function useAsyncAction<T, Args extends any[]>(
  asyncFn: (...args: Args) => Promise<T>
): UseAsyncActionResult<T, Args> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const activeExecutionRef = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      // Prevent double submissions
      if (activeExecutionRef.current) return null;

      activeExecutionRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        const result = await asyncFn(...args);
        if (isMounted.current) {
          setIsLoading(false);
          activeExecutionRef.current = false;
        }
        return result;
      } catch (err: any) {
        const mapped = classifyAndMapError(err);
        if (isMounted.current) {
          setError(mapped.message);
          setIsLoading(false);
          activeExecutionRef.current = false;
        }
        return null;
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
    activeExecutionRef.current = false;
  }, []);

  return {
    isLoading,
    error,
    execute,
    reset,
  };
}
