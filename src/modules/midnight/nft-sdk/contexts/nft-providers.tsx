import * as ledger from "@midnight-ntwrk/ledger-v6";
import {
  type MidnightProvider,
  type WalletProvider,
  type BalancedProvingRecipe,
  PrivateStateProvider,
  ZKConfigProvider,
  ProofProvider,
  PublicDataProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { Logger } from "pino";
import { NFTProviders, NFTPrivateStateId } from "../api/common-types";
import { WalletContext } from "../../wallet-widget/contexts/wallet";
import {
  ActionMessages,
  ProviderAction,
  WrappedPublicDataProvider,
} from "../../wallet-widget/utils/providersWrappers/publicDataProvider";
import { CachedFetchZkConfigProvider } from "../../wallet-widget/utils/providersWrappers/zkConfigProvider";
import {
  noopProofClient,
  proofClient,
} from "../../wallet-widget/utils/providersWrappers/proofClient";
import { inMemoryPrivateStateProvider } from "../../wallet-widget/utils/customImplementations/in-memory-private-state-provider";
import { NFTPrivateState } from "@meshsdk/nft-contract";
import {
  fromHex,
  ShieldedCoinInfo,
  toHex,
} from "@midnight-ntwrk/compact-runtime";

type NFTCircuits = 'mint' | 'getTokenURI';

export interface NFTProvidersState {
  privateStateProvider: PrivateStateProvider<typeof NFTPrivateStateId>;
  zkConfigProvider?: ZKConfigProvider<NFTCircuits>;
  proofProvider: ProofProvider<NFTCircuits>;
  publicDataProvider?: PublicDataProvider;
  walletProvider?: WalletProvider;
  midnightProvider?: MidnightProvider;
  providers?: NFTProviders;
  flowMessage?: string;
}

interface ProviderProps {
  children: React.ReactNode;
  logger: Logger;
}

export const NFTProvidersContext = createContext<NFTProvidersState | undefined>(undefined);

export const NFTProvider = ({ children, logger }: ProviderProps) => {
  const [flowMessage, setFlowMessage] = useState<string | undefined>(undefined);
  const { wallet, walletInfo, status } = useContext(WalletContext);
  const isConnected = status === 'connected';

  // Get service config from wallet or use defaults
  const serviceUriConfig = wallet?.config || {
    indexerUri: "https://indexer.preview.midnight.network/api/v1/graphql",
    indexerWsUri: "wss://indexer.preview.midnight.network/api/v1/graphql/ws",
    proverServerUri: "https://prover.preview.midnight.network",
    nodeUri: "https://rpc.preview.midnight.network",
  };

  const actionMessages = useMemo<ActionMessages>(
    () => ({
      proveTxStarted: "Proving NFT transaction...",
      proveTxDone: undefined,
      balanceTxStarted: "Signing with Lace wallet...",
      balanceTxDone: undefined,
      downloadProverStarted: "Downloading NFT prover key...",
      downloadProverDone: undefined,
      submitTxStarted: "Submitting NFT transaction...",
      submitTxDone: undefined,
      watchForTxDataStarted: "Waiting for NFT transaction finalization...",
      watchForTxDataDone: undefined,
    }),
    []
  );

  const providerCallback = useCallback(
    (action: ProviderAction): void => {
      setFlowMessage(actionMessages[action]);
    },
    [actionMessages]
  );

  const privateStateProvider: PrivateStateProvider<typeof NFTPrivateStateId> = useMemo(
    () => inMemoryPrivateStateProvider<string, NFTPrivateState>(),
    [status]
  );

  const publicDataProvider: PublicDataProvider | undefined = useMemo(
    () =>
      serviceUriConfig
        ? new WrappedPublicDataProvider(
            indexerPublicDataProvider(
              serviceUriConfig.indexerUri,
              serviceUriConfig.indexerWsUri
            ),
            providerCallback,
            logger
          )
        : undefined,
    [serviceUriConfig, providerCallback, logger, status]
  );

  // KEY DIFFERENCE: Use /midnight/simplenft for NFT keys!
  const zkConfigProvider = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return new CachedFetchZkConfigProvider<NFTCircuits>(
      `${window.location.origin}/midnight/simplenft`,
      fetch.bind(window),
      providerCallback
    );
  }, [status, providerCallback]);

  const proofProvider = useMemo(
    () =>
      serviceUriConfig?.proverServerUri
        ? proofClient(serviceUriConfig.proverServerUri, providerCallback)
        : noopProofClient(),
    [serviceUriConfig, providerCallback, status]
  );

  const walletProvider: WalletProvider = useMemo(
    () =>
      isConnected && wallet
        ? {
            getCoinPublicKey(): ledger.CoinPublicKey {
              const raw = wallet.getRawApi?.();
              return (raw?.coinPublicKey || walletInfo?.shieldedAddress || "") as unknown as ledger.CoinPublicKey;
            },
            getEncryptionPublicKey(): ledger.EncPublicKey {
              const raw = wallet.getRawApi?.();
              return (raw?.encryptionPublicKey || walletInfo?.shieldedAddress || "") as unknown as ledger.EncPublicKey;
            },
            async balanceTx(
              tx: ledger.UnprovenTransaction,
              _newCoins?: ShieldedCoinInfo[],
              _ttl?: Date
            ): Promise<BalancedProvingRecipe> {
              const serializedTx = toHex(tx.serialize());
              const received = await wallet.balanceUnsealedTransaction(serializedTx);
              const transaction = ledger.Transaction.deserialize(
                "signature",
                "pre-proof",
                "pre-binding",
                fromHex(received.tx)
              );
              return { type: "TransactionToProve", transaction } as BalancedProvingRecipe;
            },
          }
        : {
            getCoinPublicKey: () => "" as unknown as ledger.CoinPublicKey,
            getEncryptionPublicKey: () => "" as unknown as ledger.EncPublicKey,
            balanceTx: () => Promise.reject(new Error("readonly")),
          },
    [isConnected, wallet, walletInfo, status]
  );

  const midnightProvider: MidnightProvider = useMemo(
    () =>
      isConnected && wallet
        ? {
            submitTx: async (tx: ledger.FinalizedTransaction): Promise<ledger.TransactionId> => {
              await wallet.submitTransaction(toHex(tx.serialize()));
              return tx.identifiers()[0];
            },
          }
        : { submitTx: () => Promise.reject(new Error("readonly")) },
    [isConnected, wallet, status]
  );

  const combinedProviders: NFTProvidersState = useMemo(() => ({
    privateStateProvider,
    publicDataProvider,
    proofProvider,
    zkConfigProvider,
    walletProvider,
    midnightProvider,
    providers:
      publicDataProvider && zkConfigProvider
        ? {
            privateStateProvider,
            publicDataProvider,
            zkConfigProvider,
            proofProvider,
            walletProvider,
            midnightProvider,
          }
        : undefined,
    flowMessage,
  }), [
    privateStateProvider,
    publicDataProvider,
    proofProvider,
    zkConfigProvider,
    walletProvider,
    midnightProvider,
    flowMessage,
  ]);

  return (
    <NFTProvidersContext.Provider value={combinedProviders}>
      {children}
    </NFTProvidersContext.Provider>
  );
};
