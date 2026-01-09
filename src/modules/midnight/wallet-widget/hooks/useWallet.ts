import { useContext, useState } from "react";
import { WalletContext } from "../contexts/wallet";

export const useWallet = () => {
  const context = useContext(WalletContext);
  const [open, setOpen] = useState(false);

  // Legacy status compatibility
  const legacyStatus = context.status === 'connected'
    ? { status: 'connected', networkId: context.walletInfo?.network || 'preview' }
    : undefined;

  return {
    // New API
    ...context,

    // Legacy compatibility
    open,
    setOpen,
    connectingWallet: context.status === 'connecting',
    status: legacyStatus,
    connectedAPI: context.wallet,
    connectWallet: context.connect,
    initialAPI: undefined,
    dustAddress: undefined,
    dustBalance: undefined,
    shieldedAddresses: context.walletInfo?.shieldedAddress ? [context.walletInfo.shieldedAddress] : undefined,
    shieldedBalances: context.walletInfo?.shieldedBalance,
    unshieldedAddress: context.walletInfo?.unshieldedAddress,
    unshieldedBalances: context.walletInfo?.unshieldedBalance ? { total: BigInt(context.walletInfo.unshieldedBalance) } : undefined,
    proofServerOnline: true,
    refresh: () => {},
  };
};
