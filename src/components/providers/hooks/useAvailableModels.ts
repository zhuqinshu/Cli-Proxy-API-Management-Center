import { useCallback, useRef, useState } from 'react';
import { providersApi } from '@/services/api';
import type { ChannelModelsGroup } from '@/types';

export const useAvailableModels = () => {
  const [availableModels, setAvailableModels] = useState<Record<string, ChannelModelsGroup[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadAvailableModels = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);
    try {
      const result = await providersApi.getAllAvailableModels();
      setAvailableModels(result);
    } catch {
      // silent fail
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  return { availableModels, loadAvailableModels, isLoading };
};
