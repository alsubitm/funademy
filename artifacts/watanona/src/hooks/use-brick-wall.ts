import { useState, useEffect, useRef, useCallback } from 'react';
import { useGetBrickCount, usePlaceBrick } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

export function useBrickWall() {
  const { data: serverCountData } = useGetBrickCount({
    query: {
      queryKey: ['brick-count'],
      retry: false
    }
  });
  
  const placeBrickMutation = usePlaceBrick();
  const { toast } = useToast();
  
  const [localCount, setLocalCount] = useState(0);
  const [, setPendingTaps] = useState(0);
  
  useEffect(() => {
    if (serverCountData?.count && localCount === 0) {
      setLocalCount(serverCountData.count);
    }
  }, [serverCountData, localCount]);

  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const mutateFnRef = useRef(placeBrickMutation.mutate);
  mutateFnRef.current = placeBrickMutation.mutate;

  const handlePlaceBrick = useCallback(() => {
    setLocalCount(prev => prev + 1);
    setPendingTaps(prev => prev + 1);
    
    toast({
      description: "مكعّبك أصبح جزءاً من الوطن!",
      className: "bg-secondary text-secondary-foreground border-none font-bold text-center justify-center text-lg shadow-xl shadow-secondary/20",
      duration: 2000,
    });

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    tapTimerRef.current = setTimeout(() => {
      setPendingTaps(currentPending => {
        if (currentPending > 0) {
          const amount = Math.min(currentPending, 20);
          mutateFnRef.current(
            { data: { amount } },
            {
              onSuccess: (res) => {
                if (res?.count) {
                  setLocalCount(res.count);
                }
              },
              onError: (err) => {
                console.error("API Error, relying on local optimistic count", err);
              }
            }
          );
        }
        return 0;
      });
    }, 800);
    
  }, [toast]);

  return {
    count: localCount,
    goal: serverCountData?.goal ?? null,
    handlePlaceBrick
  };
}
