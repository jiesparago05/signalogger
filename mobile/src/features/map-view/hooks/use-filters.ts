import { useState, useCallback, useRef } from 'react';
import { Carrier, NetworkType, FilterState } from '../../../types/signal';

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>({
    carriers: [],
    networkTypes: [],
  });
  const defaultSet = useRef(false);

  const setDefaultCarrier = useCallback((carrier: string) => {
    if (defaultSet.current) return;
    defaultSet.current = true;
    const normalized = carrier as Carrier;
    setFilters((prev) => ({
      ...prev,
      carriers: prev.carriers.length === 0 ? [normalized] : prev.carriers,
    }));
  }, []);

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
      // Single-select: tap same = deselect, tap different = switch
      const isSame = prev.networkTypes.length === 1 && prev.networkTypes[0] === type;
      return {
        ...prev,
        networkTypes: isSame ? [] : [type],
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
    setDefaultCarrier,
  };
}
