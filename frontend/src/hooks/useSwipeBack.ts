import { useRef, useCallback, useState, useEffect } from 'react';

interface UseSwipeBackOptions {
  onSwipeBack: () => void;
  threshold?: number;
  edgeWidth?: number;
}

interface SwipeState {
  translateX: number;
  opacity: number;
  isTransitioning: boolean;
}

export function useSwipeBack({
  onSwipeBack,
  threshold = 50,
  edgeWidth = 30,
}: UseSwipeBackOptions) {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const currentXRef = useRef<number>(0);
  const isSwipingRef = useRef(false);
  const directionLockedRef = useRef(false);

  const [swipeState, setSwipeState] = useState<SwipeState>({
    translateX: 0,
    opacity: 1,
    isTransitioning: false,
  });

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    // Only start swipe if touch begins near left edge
    if (touch.clientX <= edgeWidth) {
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      currentXRef.current = 0;
      isSwipingRef.current = false;
      directionLockedRef.current = false;
    }
  }, [edgeWidth]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startXRef.current === null || startYRef.current === null) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    // Lock direction on first significant movement
    if (!directionLockedRef.current && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      directionLockedRef.current = true;
      // Only continue if horizontal swipe (right direction)
      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 0) {
        isSwipingRef.current = true;
      } else {
        startXRef.current = null;
        startYRef.current = null;
        return;
      }
    }

    if (!isSwipingRef.current) return;

    // Prevent scroll while swiping
    e.preventDefault();

    // Calculate translation (only positive = right)
    const translateX = Math.max(0, deltaX);
    currentXRef.current = translateX;

    // Calculate opacity based on progress (fade from 1 to 0.3)
    const progress = Math.min(translateX / (window.innerWidth * 0.5), 1);
    const opacity = 1 - progress * 0.7;

    setSwipeState({
      translateX,
      opacity,
      isTransitioning: false,
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) {
      startXRef.current = null;
      startYRef.current = null;
      return;
    }

    const translateX = currentXRef.current;

    if (translateX >= threshold) {
      // Complete the swipe animation then navigate
      setSwipeState({
        translateX: window.innerWidth,
        opacity: 0,
        isTransitioning: true,
      });

      setTimeout(() => {
        onSwipeBack();
      }, 200);
    } else {
      // Snap back
      setSwipeState({
        translateX: 0,
        opacity: 1,
        isTransitioning: true,
      });

      setTimeout(() => {
        setSwipeState(prev => ({ ...prev, isTransitioning: false }));
      }, 200);
    }

    startXRef.current = null;
    startYRef.current = null;
    isSwipingRef.current = false;
    directionLockedRef.current = false;
  }, [threshold, onSwipeBack]);

  // Attach event listeners to document for broader capture
  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const containerStyle: React.CSSProperties = {
    transform: swipeState.translateX > 0 ? `translateX(${swipeState.translateX}px)` : undefined,
    opacity: swipeState.opacity,
    transition: swipeState.isTransitioning ? 'transform 200ms ease-out, opacity 200ms ease-out' : undefined,
  };

  return {
    containerStyle,
    isSwiping: swipeState.translateX > 0,
  };
}
