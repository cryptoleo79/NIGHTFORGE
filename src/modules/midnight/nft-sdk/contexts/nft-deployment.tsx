import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import type { DeployedAPIProvider } from './nft-deployment-class';
import { NFTDeploymentManager } from './nft-deployment-class';
import { NFTProvidersContext } from './nft-providers';
import { logger } from '../../../../App';

const DeployedContext = createContext<DeployedAPIProvider | null>(null);

export const useDeployed = (): DeployedAPIProvider | null => useContext(DeployedContext);

export const useNFTProviders = () => useContext(NFTProvidersContext);

export const NFTDeployedProvider = ({ children }: PropsWithChildren) => {
  const providersState = useContext(NFTProvidersContext);
  
  const deployedAPIProvider = useMemo<DeployedAPIProvider | null>(() => {
    if (!providersState?.providers) return null;
    return new NFTDeploymentManager(logger, '', providersState.providers as any);
  }, [providersState?.providers]);
  
  return <DeployedContext.Provider value={deployedAPIProvider}>{children}</DeployedContext.Provider>;
};
