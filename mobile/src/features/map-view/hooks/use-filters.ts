import { useState, useCallback } from 'react';
import { Carrier, NetworkType, FilterState } from '../../../types/signal';

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>({
    carriers: [],
    networkTypes: [],
  });

  const toggleCarrier = useCallback((carrier: Carrier) => {
    setFilters((prev) => {
      const exists = prev.carriers.includes(carrier);
      return {
        ...prev,
        carriers: exists
          ? prev.carriers.filter((c) => c !== carrier)
          : [...prev.carriers, carrier],
      };
    });
  }, []);

  const toggleNetworkType = useCallback((type: NetworkType) => {
    setFilters((prev) => {
      const exists = prev.networkTypes.includes(type);
      return {
        ...prev,
        networkTypes: exists
          ? prev.networkTypes.filter((t) => t !== type)
          : [...prev.networkTypes, type],
      };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ carriers: [], networkTypes: [] });
  }, []);

  const hasActiveFilters = filters.carriers.length > 0 || filters.networkTypes.length > 0;

  return {
    filters,
    toggleCarrier,
    toggleNetworkType,
    clearFilters,
    hasActiveFilters,
  };
}
