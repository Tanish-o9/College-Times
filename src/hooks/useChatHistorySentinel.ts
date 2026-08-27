import { useEffect, useRef } from 'react';

interface UseChatHistorySentinelOptions {
  targetRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onLoadOlder: () => void;
  hasMore: boolean;
  isLoadingOlder: boolean;
}

export const useChatHistorySentinel = ({
  targetRef,
  scrollContainerRef,
  onLoadOlder,
  hasMore,
  isLoadingOlder,
}: UseChatHistorySentinelOptions) => {
  const onLoadOlderRef = useRef(onLoadOlder);

  useEffect(() => {
    onLoadOlderRef.current = onLoadOlder;
  }, [onLoadOlder]);

  useEffect(() => {
    const targetNode = targetRef.current;
    const rootNode = scrollContainerRef.current;

    if (!targetNode || !rootNode || !hasMore || isLoadingOlder) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingOlder) {
          onLoadOlderRef.current();
        }
      },
      {
        root: rootNode,
        rootMargin: '100px 0px 0px 0px', // Trigger slightly before user hits exact top edge
        threshold: 0.1,
      }
    );

    observer.observe(targetNode);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, scrollContainerRef, hasMore, isLoadingOlder]);
};
