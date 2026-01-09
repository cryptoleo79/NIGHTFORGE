import { SimpleNFT, type NFTPrivateState, createPrivateState } from '@meshsdk/nft-contract';
import type { FoundContract, DeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { PrivateStateProvider, PublicDataProvider, MidnightProvider, WalletProvider, ZKConfigProvider, ProofProvider } from '@midnight-ntwrk/midnight-js-types';

type NFTCircuits = 'mint' | 'getTokenURI';

export const NFTPrivateStateId = 'nftPrivateState';

export type NFTContract = InstanceType<typeof SimpleNFT.Contract>;
export type DeployedNFTContract = DeployedContract<NFTContract> | FoundContract<NFTContract>;

export type NFTProviders = {
  privateStateProvider: PrivateStateProvider<typeof NFTPrivateStateId, NFTPrivateState>;
  publicDataProvider: PublicDataProvider;
  zkConfigProvider: ZKConfigProvider<NFTCircuits>;
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
  proofProvider: ProofProvider<NFTCircuits>;
};

export type NFTLedgerState = {
  state: SimpleNFT.State;
  tokenURI: { is_some: boolean; value: string };
  owner: Uint8Array;
  tokenId: bigint;
};

export type UserAction = {
  mint: string | undefined;
};

export type DerivedState = {
  ledger: NFTLedgerState;
  privateState: NFTPrivateState;
  turns: UserAction;
};

export const emptyState: DerivedState = {
  ledger: {
    state: SimpleNFT.State.AVAILABLE,
    tokenURI: { is_some: false, value: '' },
    owner: new Uint8Array(32),
    tokenId: 0n,
  },
  privateState: createPrivateState(new Uint8Array(32)),
  turns: { mint: undefined },
};

export { createPrivateState, type NFTPrivateState };
