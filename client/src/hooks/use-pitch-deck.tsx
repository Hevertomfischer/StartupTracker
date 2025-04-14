import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

type PitchDeckInfo = {
  exists: boolean;
  path: string | null;
};

// Cria um cache para armazenar informações sobre os PitchDecks das startups
const pitchDeckCache = new Map<string, PitchDeckInfo>();

export function usePitchDeck(startupId: string) {
  const [pitchDeckInfo, setPitchDeckInfo] = useState<PitchDeckInfo>(() => {
    // Se já temos a informação no cache, usamos ela
    return pitchDeckCache.get(startupId) || { exists: false, path: null };
  });
  
  const [isLoading, setIsLoading] = useState(!pitchDeckCache.has(startupId));
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Se já temos a informação no cache, não precisamos fazer a requisição
    if (pitchDeckCache.has(startupId)) {
      setPitchDeckInfo(pitchDeckCache.get(startupId)!);
      setIsLoading(false);
      return;
    }

    async function checkPitchDeck() {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/startups/${startupId}/attachments`);
        
        if (!response.ok) {
          throw new Error('Falha ao verificar anexos');
        }
        
        const data = await response.json();
        const info: PitchDeckInfo = {
          exists: !!data.pitchDeck,
          path: data.pitchDeck ? data.pitchDeck.path : null
        };
        
        // Armazena no cache
        pitchDeckCache.set(startupId, info);
        setPitchDeckInfo(info);
      } catch (err) {
        console.error('Erro ao verificar PitchDeck:', err);
        setError(err instanceof Error ? err : new Error('Erro desconhecido'));
      } finally {
        setIsLoading(false);
      }
    }
    
    checkPitchDeck();
  }, [startupId]);

  // Função para abrir o PitchDeck
  const openPitchDeck = () => {
    if (pitchDeckInfo.exists && pitchDeckInfo.path) {
      window.open(pitchDeckInfo.path, '_blank');
    } else {
      toast({
        title: "PitchDeck não disponível",
        description: "Esta startup não possui um PitchDeck anexado.",
        variant: "destructive"
      });
    }
  };

  // Função para invalidar o cache (útil após um upload ou exclusão)
  const invalidateCache = () => {
    pitchDeckCache.delete(startupId);
    setPitchDeckInfo({ exists: false, path: null });
    setIsLoading(true);
  };

  return {
    hasPitchDeck: pitchDeckInfo.exists,
    pitchDeckPath: pitchDeckInfo.path,
    isLoading,
    error,
    openPitchDeck,
    invalidateCache
  };
}