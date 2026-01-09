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
// import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { Logger } from "pino";
import type {
  CounterCircuits,
  CounterPrivateStateId,
} from "../api/common-types";
import { CounterProviders } from "../api/common-types";
import { WalletContext } from "../../wallet-widget/contexts/wallet";
// import { WrappedPrivateStateProvider } from "../../wallet-widget/utils/providersWrappers/privateStateProvider";
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
import { CounterPrivateState } from "@meshsdk/counter-contract";
import {
  fromHex,
  ShieldedCoinInfo,
  toHex,
} from "@midnight-ntwrk/compact-runtime";

export interface ProvidersState {
  privateStateProvider: PrivateStateProvider<typeof CounterPrivateStateId>;
  zkConfigProvider?: ZKConfigProvider<CounterCircuits>;
  proofProvider: ProofProvider<CounterCircuits>;
  publicDataProvider?: PublicDataProvider;
  walletProvider?: WalletProvider;
  midnightProvider?: MidnightProvider;
  providers?: CounterProviders;
  flowMessage?: string;
}

interface ProviderProps {
  children: React.ReactNode;
  logger: Logger;
}

export const ProvidersContext = createContext<ProvidersState | undefined>(
  undefined
);

export const Provider = ({ children, logger }: ProviderProps) => {
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
      proveTxStarted: "Proving transaction...",
      proveTxDone: undefined,
      balanceTxStarted: "Signing the transaction with Midnight Lace wallet...",
      balanceTxDone: undefined,
      downloadProverStarted: "Downloading prover key...",
      downloadProverDone: undefined,
      submitTxStarted: "Submitting transaction...",
      submitTxDone: undefined,
      watchForTxDataStarted:
        "Waiting for transaction finalization on blockchain...",
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

  const privateStateProvider: PrivateStateProvider<
    typeof CounterPrivateStateId
  > = useMemo(
    () =>
      // new WrappedPrivateStateProvider(
      //   levelPrivateStateProvider({
      //     privateStateStoreName: "counter-private-state",
      //   }),
      //   logger
      // ),
      inMemoryPrivateStateProvider<string, CounterPrivateState>(),
    [logger, status]
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

  const zkConfigProvider = useMemo(() => {
    if (typeof window === "undefined") {
      // Return undefined (or an appropriate fallback) if running on the server.
      return undefined;
    }
    return new CachedFetchZkConfigProvider<CounterCircuits>(
      `${window.location.origin}/midnight/counter`,
      fetch.bind(window),
      () => {}
    );
  }, [status]);

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
              // For Yamori, we get this from the raw API state
              const raw = wallet.getRawApi?.();
              return (raw?.coinPublicKey || walletInfo?.shieldedAddress || "") as unknown as ledger.CoinPublicKey;
            },
            getEncryptionPublicKey(): ledger.EncPublicKey {
              const raw = wallet.getRawApi?.();
              return (raw?.encryptionPublicKey || walletInfo?.shieldedAddress || "") as unknown as ledger.EncPublicKey;
            },
            async balanceTx(
              tx: ledger.UnprovenTransaction,
              newCoins?: ShieldedCoinInfo[],
              ttl?: Date
            ): Promise<BalancedProvingRecipe> {
              try {
                logger.info(
                  { tx, newCoins, ttl },
                  "Balancing transaction via wallet"
                );
                const serializedTx = toHex(tx.serialize());
                const received = await wallet.balanceUnsealedTransaction(serializedTx);
                const transaction: ledger.Transaction<
                  ledger.SignatureEnabled,
                  ledger.PreProof,
                  ledger.PreBinding
                > = ledger.Transaction.deserialize<
                  ledger.SignatureEnabled,
                  ledger.PreProof,
                  ledger.PreBinding
                >(
                  "signature",
                  "pre-proof",
                  "pre-binding",
                  fromHex(received.tx)
                );
                return {
                  type: "TransactionToProve",
                  transaction: transaction,
                };
              } catch (e) {
                logger.error(
                  { error: e },
                  "Error balancing transaction via wallet"
                );
                throw e;
              }
            },
          }
        : {
            getCoinPublicKey(): ledger.CoinPublicKey {
              return "" as unknown as ledger.CoinPublicKey;
            },
            getEncryptionPublicKey(): ledger.EncPublicKey {
              return "" as unknown as ledger.EncPublicKey;
            },
            balanceTx: () => Promise.reject(new Error("readonly")),
          },
    [isConnected, wallet, walletInfo, providerCallback, status]
  );

  const midnightProvider: MidnightProvider = useMemo(
    () =>
      isConnected && wallet
        ? {
            submitTx: async (
              tx: ledger.FinalizedTransaction
            ): Promise<ledger.TransactionId> => {
              await wallet.submitTransaction(toHex(tx.serialize()));
              const txIdentifiers = tx.identifiers();
              const txId = txIdentifiers[0]; // Return the first transaction ID
              logger.info(
                { txIdentifiers },
                "Submitted transaction via wallet"
              );
              return txId;
            },
          }
        : {
            submitTx: (): Promise<ledger.TransactionId> =>
              Promise.reject(new Error("readonly")),
          },
    [isConnected, wallet, providerCallback, status]
  );

  const combinedProviders: ProvidersState = useMemo(() => {
    return {
      privateStateProvider,
      publicDataProvider,
      proofProvider,
      zkConfigProvider,
      walletProvider,
      midnightProvider,
      // Only set the nested providers object if publicDataProvider (and others, if needed) are defined.
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
    };
  }, [
    privateStateProvider,
    publicDataProvider,
    proofProvider,
    zkConfigProvider,
    walletProvider,
    midnightProvider,
    flowMessage,
  ]);

  return (
    <ProvidersContext.Provider value={combinedProviders}>
      {children}
    </ProvidersContext.Provider>
  );
};
