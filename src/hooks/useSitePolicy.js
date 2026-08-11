import { useContext } from 'react';
import { SitePolicyContext } from '../context/SitePolicyContext';

export function useSitePolicy() {
  const context = useContext(SitePolicyContext);
  if (!context) {
    throw new Error('useSitePolicy must be used within SitePolicyProvider');
  }
  return context;
}

export default useSitePolicy;

