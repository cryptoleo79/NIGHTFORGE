import { createContext, useCallback, useEffect, useState, useRef } from "react";
import { MidnightWallet, MidnightBrowserWallet, WalletConfig } from "../api/walletController";

export type WalletStatus = 'checking' | 'not_installed' | 'locked' | 'ready' | 'connecting' | 'connected' | 'error';

export interface WalletInfo {
  type: string;
  network: string;
  shieldedAddress: string;
  unshieldedAddress: string;
  shieldedBalance: string;
  unshieldedBalance: string;
}

export interface AvailableWallet {
  name: string;
  rdns: string;
  uuid: string;
  icon: string;
}

export interface WalletContextType {
  // Status
  status: WalletStatus;
  error: string | null;

  // Wallet instance
  wallet: MidnightWallet | null;
  walletInfo: WalletInfo | null;

  // Available wallets
  availableWallets: AvailableWallet[];

  // Actions
  connect: (walletIdentifier?: string, network?: string) => Promise<void>;
  disconnect: () => void;
  checkStatus: () => Promise<void>;

  // Legacy compatibility
  connectedAPI: any;
  connectWallet: ((rdns: string, networkID: string) => Promise<void>) | undefined;
  connectingWallet: boolean;
  serviceUriConfig: WalletConfig | undefined;
}

const defaultContext: WalletContextType = {
  status: 'checking',
  error: null,
  wallet: null,
  walletInfo: null,
  availableWallets: [],
  connect: async () => {},
  disconnect: () => {},
  checkStatus: async () => {},
  connectedAPI: undefined,
  connectWallet: undefined,
  connectingWallet: false,
  serviceUriConfig: undefined,
};

export const WalletContext = createContext<WalletContextType>(defaultContext);

interface Props {
  children: React.ReactNode;
}

export const MidnightMeshProvider = ({ children }: Props) => {
  const [status, setStatus] = useState<WalletStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [availableWallets, setAvailableWallets] = useState<AvailableWallet[]>([]);
  const walletRef = useRef<MidnightWallet | null>(null);

  // Check wallet status
  const checkStatus = useCallback(async () => {
    console.log('[WalletContext] Checking status...');

    // Check if any wallet is installed
    if (!MidnightWallet.isInstalled()) {
      console.log('[WalletContext] No wallet installed');
      setStatus('not_installed');
      setAvailableWallets([]);
      return;
    }

    // Get available wallets
    const wallets = MidnightWallet.getAvailableWallets();
    setAvailableWallets(wallets.map(w => ({
      name: w.name,
      rdns: w.rdns,
      uuid: w.uuid,
      icon: w.icon
    })));
    console.log('[WalletContext] Available wallets:', wallets);

    // If already connected, don't change status
    if (walletRef.current?.connected) {
      return;
    }

    // Wallet is installed and ready
    console.log('[WalletContext] Wallet ready to connect');
    setStatus('ready');
  }, []);

  // Connect to wallet
  const connect = useCallback(async (walletIdentifier?: string, network: string = 'preview') => {
    console.log('[WalletContext] Connecting...', walletIdentifier, network);
    setStatus('connecting');
    setError(null);

    try {
      const wallet = new MidnightWallet();
      await wallet.connect(network, walletIdentifier);

      walletRef.current = wallet;
      setWalletInfo(wallet.getDisplayInfo());
      setStatus('connected');
      console.log('[WalletContext] Connected!', wallet.getDisplayInfo());
    } catch (e: any) {
      console.error('[WalletContext] Connect error:', e);
      const msg = e?.message || e?.reason || 'Connection failed';
      setError(msg);

      if (msg.includes('LOCKED') || msg.includes('locked')) {
        setStatus('locked');
      } else if (msg.includes('rejected') || msg.includes('Rejected')) {
        setStatus('ready');
        setError('Connection was rejected. Please try again.');
      } else {
        setStatus('error');
      }
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    console.log('[WalletContext] Disconnecting...');
    walletRef.current?.disconnect();
    walletRef.current = null;
    setWalletInfo(null);
    setStatus('ready');
    setError(null);
  }, []);

  // Initial check and polling
  useEffect(() => {
    // Initial check after small delay for extension to inject
    const initialCheck = setTimeout(() => {
      checkStatus();
    }, 500);

    // Poll for wallet installation when not connected
    const interval = setInterval(() => {
      if (status !== 'connected' && status !== 'connecting') {
        checkStatus();
      }
    }, 3000);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [checkStatus, status]);

  // Try auto-connect on mount
  useEffect(() => {
    const tryAuto = async () => {
      const saved = MidnightBrowserWallet.getMidnightWalletConnected();
      if (saved.rdns && saved.networkID && status === 'ready') {
        console.log('[WalletContext] Trying auto-connect...');
        await connect(saved.rdns, saved.networkID);
      }
    };

    if (status === 'ready') {
      tryAuto();
    }
  }, [status, connect]);

  // Listen for wallet installation events
  useEffect(() => {
    const handleWalletInstalled = (event: CustomEvent) => {
      console.log('[WalletContext] Wallet installed event:', event.detail);
      checkStatus();
    };

    window.addEventListener('midnight:walletInstalled', handleWalletInstalled as EventListener);
    return () => {
      window.removeEventListener('midnight:walletInstalled', handleWalletInstalled as EventListener);
    };
  }, [checkStatus]);

  const value: WalletContextType = {
    status,
    error,
    wallet: walletRef.current,
    walletInfo,
    availableWallets,
    connect,
    disconnect,
    checkStatus,
    // Legacy compatibility
    connectedAPI: status === 'connected' ? walletRef.current?.getConnectedAPI() : undefined,
    connectWallet: connect,
    connectingWallet: status === 'connecting',
    serviceUriConfig: walletRef.current?.config,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

// Legacy hook for compatibility
export const useWalletStore = () => {
  return {};
};
