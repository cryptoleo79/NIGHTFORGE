import { useCallback, useState } from 'react';
import { useDeployed } from '../contexts/nft-deployment';
import { useProviders } from '../../counter-sdk/hooks/use-providers';
import { type NFTContractControllerInterface } from '../api/contractController';
import { type DerivedState } from '../api/common-types';

export const useNFTSubscription = () => {
  const deployed = useDeployed();
  const providersState = useProviders();
  const [deployedContractAPI, setDeployedContractAPI] = useState<NFTContractControllerInterface | undefined>();
  const [derivedState, setDerivedState] = useState<DerivedState | undefined>();

  const onDeploy = useCallback(async () => {
    if (!deployed) return { address: undefined };
    const { observable, address } = await deployed.deployContract();
    
    observable.subscribe((state) => {
      if (state.status === 'deployed') {
        setDeployedContractAPI(state.api);
        state.api.state$.subscribe(setDerivedState);
      }
    });
    
    return { address };
  }, [deployed]);

  return {
    deployedContractAPI,
    derivedState,
    onDeploy,
    providers: providersState,
  };
};
