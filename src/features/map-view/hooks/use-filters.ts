import { useState, useCallback, useRef } from 'react';
import { Carrier, NetworkType, FilterState } from '../../../types/signal';

// PH network groups — brands that share the same towers
export const NETWORK_GROUPS: Record<string, Carrier[]> = {
  'Smart Network': ['Smart', 'TNT', 'Sun'],
  'Globe Network': ['Globe', 'GOMO'],
  'DITO': ['DITO'],
};

export const CARRIER_TO_NETWORK: Record<string, string> = {
  Smart: 'Smart Network',
  TNT: 'Smart Network',
  Sun: 'Smart Network',
  Globe: 'Globe Network',
  GOMO: 'Globe Network',
  DITO: 'DITO',
};

function getNetworkGroup(carrier: string): Carrier[] {
  const network = CARRIER_TO_NETWORK[carrier];
  return network ? NETWORK_GROUPS[network] : [carrier as Carrier];
}

export function useFilters() {
  const [filters, setFilters] = useState<FilterState>({
    carriers: [],
    networkTypes: [],
  });
  const defaultSet = useRef(false);

  const setDefaultCarrier = useCallback((carrier: string) => {
    if (defaultSet.current) return;
    defaultSet.current = true;
    // Select the entire network group for the user's carrier
    const group = getNetworkGroup(carrier);
    setFilters((prev) => ({
      ...prev,
      carriers: prev.carriers.length === 0 ? group : prev.carriers,
    }));
  }, []);

  const toggleCarrier = useCallback((carrier: Carrier) => {
    setFilters((prev) => {
      const group = getNetworkGroup(carrier);
      // Check if any brand in the group is already selected
      const groupSelected = group.some((c) => prev.carriers.includes(c));
      if (groupSelected) {
        // Deselect entire group
        return { ...prev, carriers: prev.carriers.filter((c) => !group.includes(c)) };
      } else {
        // Select entire group
        return { ...prev, carriers: [...prev.carriers, ...group] };
      }
    });
  }, []);

  const toggleNetworkType = useCallback((type: NetworkType) => {
    setFilters((prev) => {
      const isSame = prev.networkTypes.length === 1 && prev.networkTypes[0] === type;
      return { ...prev, networkTypes: isSame ? [] : [type] };
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
