import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

/**
 * Midnight DApp Connector API Types
 * Following the official specification
 */

// Initial API - what's installed under window.midnight[uuid]
export interface InitialAPI {
  rdns: string;
  name: string;
  icon: string;
  apiVersion: string;
  connect: (networkId: string) => Promise<ConnectedAPI>;
}

// Connected API - returned after successful connection
export interface ConnectedAPI {
  // Balances
  getShieldedBalances(): Promise<Record<string, string>>;
  getUnshieldedBalances(): Promise<Record<string, string>>;
  getDustBalance(): Promise<string>;

  // Addresses
  getShieldedAddresses(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>;
  getDustAddress(): Promise<{ dustAddress: string }>;

  // Configuration
  getConfiguration(): Promise<WalletConfig>;
  getConnectionStatus(): Promise<ConnectionStatus>;

  // Transactions
  balanceUnsealedTransaction(tx: string): Promise<{ tx: string }>;
  balanceSealedTransaction(tx: string): Promise<{ tx: string }>;
  submitTransaction(tx: string): Promise<void>;
  makeTransfer(desiredOutputs: DesiredOutput[]): Promise<{ tx: string }>;
  makeIntent(
    desiredInputs: DesiredInput[],
    desiredOutputs: DesiredOutput[],
    options: { intentId: number | "random"; payFees: boolean }
  ): Promise<{ tx: string }>;

  // Signing
  signData(data: string, options: SignDataOptions): Promise<Signature>;

  // History
  getTxHistory(pageNumber: number, pageSize: number): Promise<HistoryEntry[]>;

  // Proving
  getProvingProvider(keyMaterialProvider: KeyMaterialProvider): Promise<ProvingProvider>;

  // Hints
  hintUsage(methodNames: string[]): Promise<void>;
}

export interface WalletConfig {
  indexerUri: string;
  indexerWsUri: string;
  proverServerUri?: string;
  substrateNodeUri: string;
  networkId: string;
}

export interface ConnectionStatus {
  status: 'connected' | 'disconnected';
  networkId?: string;
}

export interface DesiredOutput {
  kind: 'shielded' | 'unshielded';
  type: string;
  value: bigint;
  recipient: string;
}

export interface DesiredInput {
  kind: 'shielded' | 'unshielded';
  type: string;
  value: bigint;
}

export interface SignDataOptions {
  encoding: 'hex' | 'base64' | 'text';
  keyType: 'unshielded';
}

export interface Signature {
  data: string;
  signature: string;
  verifyingKey: string;
}

export interface HistoryEntry {
  txHash: string;
  txStatus: TxStatus;
}

export interface TxStatus {
  status: 'finalized' | 'confirmed' | 'pending' | 'discarded';
  executionStatus?: Record<number, 'Success' | 'Failure'>;
}

export interface KeyMaterialProvider {
  getZKIR(circuitKeyLocation: string): Promise<Uint8Array>;
  getProverKey(circuitKeyLocation: string): Promise<Uint8Array>;
  getVerifierKey(circuitKeyLocation: string): Promise<Uint8Array>;
}

export interface ProvingProvider {
  check(serializedPreimage: Uint8Array, keyLocation: string): Promise<(bigint | undefined)[]>;
  prove(serializedPreimage: Uint8Array, keyLocation: string, overwriteBindingInput?: bigint): Promise<Uint8Array>;
}

// Wallet state types
export type WalletType = 'yamori' | 'lace' | 'nocy' | 'unknown';

export interface WalletState {
  networkId: string;
  address?: string;
}

export interface WalletBalances {
  shielded?: bigint;
  unshielded?: bigint;
  dust?: bigint;
}

// Default config for Preview network (fallback)
const PREVIEW_CONFIG: WalletConfig = {
  indexerUri: "https://indexer.preview.midnight.network/api/v1/graphql",
  indexerWsUri: "wss://indexer.preview.midnight.network/api/v1/graphql/ws",
  proverServerUri: "https://prover.preview.midnight.network",
  substrateNodeUri: "wss://rpc.preview.midnight.network",
  networkId: "preview"
};

// Get window.midnight safely
const getMidnight = (): Record<string, InitialAPI> | undefined => (window as any).midnight;

/**
 * Midnight Wallet Controller
 * Implements the official DApp Connector API specification
 */
export class MidnightWallet {
  public walletType: WalletType = 'unknown';
  public state: WalletState | null = null;
  public config: WalletConfig = PREVIEW_CONFIG;
  public connected: boolean = false;

  // The connected API from the wallet
  private connectedAPI: ConnectedAPI | null = null;
  private initialAPI: InitialAPI | null = null;

  // Addresses
  public shieldedAddress: string | null = null;
  public unshieldedAddress: string | null = null;
  public dustAddress: string | null = null;

  // Keys
  public coinPublicKey: string | null = null;
  public encryptionPublicKey: string | null = null;

  // Balances
  public shieldedBalance: string | null = null;
  public unshieldedBalance: string | null = null;
  public dustBalance: string | null = null;

  /**
   * Check if any wallet is installed
   */
  static isInstalled(): boolean {
    const midnight = getMidnight();
    if (!midnight) return false;
    return Object.keys(midnight).length > 0;
  }

  /**
   * Get all available wallets following the spec
   */
  static getAvailableWallets(): { name: string; rdns: string; uuid: string; icon: string; apiVersion: string }[] {
    const midnight = getMidnight();
    if (!midnight) return [];

    const wallets: { name: string; rdns: string; uuid: string; icon: string; apiVersion: string }[] = [];

    for (const [uuid, api] of Object.entries(midnight)) {
      if (api && typeof api === 'object' && api.name && api.rdns && typeof api.connect === 'function') {
        wallets.push({
          name: api.name,
          rdns: api.rdns,
          uuid,
          icon: api.icon || '',
          apiVersion: api.apiVersion || '1.0.0'
        });
      }
    }

    return wallets;
  }

  /**
   * Check what type of wallet is installed (for backwards compatibility)
   */
  static getWalletType(): WalletType {
    const wallets = MidnightWallet.getAvailableWallets();
    if (wallets.length === 0) return 'unknown';

    const first = wallets[0];
    if (first.rdns.includes('yamori')) return 'yamori';
    if (first.rdns.includes('lace')) return 'lace';
    if (first.rdns.includes('nocy')) return 'nocy';
    return 'unknown';
  }

  /**
   * Check if wallet is locked
   * Note: In the new API, we discover this by attempting to connect
   */
  static async isLocked(): Promise<boolean> {
    const wallets = MidnightWallet.getAvailableWallets();
    if (wallets.length === 0) return true;

    // Try a quick connect to see if wallet is available
    const midnight = getMidnight();
    if (!midnight) return true;

    const api = midnight[wallets[0].uuid];
    if (!api) return true;

    try {
      // This will fail if wallet is locked
      const connectedApi = await api.connect('preview');
      const status = await connectedApi.getConnectionStatus();
      return status.status !== 'connected';
    } catch (e: any) {
      // If error contains "locked", return true
      return e?.message?.toLowerCase().includes('locked') ||
             e?.reason?.toLowerCase().includes('locked') ||
             true;
    }
  }

  /**
   * Connect to a wallet by UUID or rdns
   */
  async connect(networkId: string = 'preview', walletIdentifier?: string): Promise<boolean> {
    const midnight = getMidnight();
    if (!midnight) throw new Error('No wallet found');

    const wallets = MidnightWallet.getAvailableWallets();
    if (wallets.length === 0) throw new Error('No wallet found');

    // Find the wallet to connect to
    let targetWallet = wallets[0];
    if (walletIdentifier) {
      const found = wallets.find(w => w.uuid === walletIdentifier || w.rdns === walletIdentifier || w.name.toLowerCase() === walletIdentifier.toLowerCase());
      if (found) targetWallet = found;
    }

    const api = midnight[targetWallet.uuid];
    if (!api) throw new Error(`Wallet ${targetWallet.name} not found`);

    console.log(`[Wallet] Connecting to ${targetWallet.name} (${targetWallet.rdns}) on ${networkId}...`);

    try {
      // Call connect as per spec
      this.connectedAPI = await api.connect(networkId);
      this.initialAPI = api;
      this.connected = true;

      // Determine wallet type from rdns
      if (targetWallet.rdns.includes('yamori')) {
        this.walletType = 'yamori';
      } else if (targetWallet.rdns.includes('lace')) {
        this.walletType = 'lace';
      } else if (targetWallet.rdns.includes('nocy')) {
        this.walletType = 'nocy';
      } else {
        this.walletType = 'unknown';
      }

      // Get configuration with validation
      try {
        const walletConfig = await this.connectedAPI.getConfiguration();

        // Validate indexer URIs - some wallets return invalid URLs
        const isValidHttpUrl = (url: string) => {
          try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
          } catch {
            return false;
          }
        };

        const isValidWsUrl = (url: string) => {
          try {
            const parsed = new URL(url);
            return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
          } catch {
            return false;
          }
        };

        // Use wallet config if valid, otherwise use defaults
        this.config = {
          indexerUri: isValidHttpUrl(walletConfig.indexerUri)
            ? walletConfig.indexerUri
            : PREVIEW_CONFIG.indexerUri,
          indexerWsUri: isValidWsUrl(walletConfig.indexerWsUri)
            ? walletConfig.indexerWsUri
            : PREVIEW_CONFIG.indexerWsUri,
          proverServerUri: walletConfig.proverServerUri && isValidHttpUrl(walletConfig.proverServerUri)
            ? walletConfig.proverServerUri
            : PREVIEW_CONFIG.proverServerUri,
          substrateNodeUri: walletConfig.substrateNodeUri && isValidWsUrl(walletConfig.substrateNodeUri)
            ? walletConfig.substrateNodeUri
            : PREVIEW_CONFIG.substrateNodeUri || 'wss://rpc.preview.midnight.network',
          networkId: walletConfig.networkId || networkId,
        };

        console.log('[Wallet] Configuration loaded:', this.config);
      } catch (e) {
        console.warn('[Wallet] Failed to get configuration, using defaults:', e);
        this.config = { ...PREVIEW_CONFIG, networkId };
      }

      // Get addresses
      await this.refreshAddresses();

      // Get balances
      await this.refreshBalances();

      // Update state
      this.state = { networkId, address: this.shieldedAddress || undefined };

      // Save connection
      localStorage.setItem('wallet-connected', targetWallet.uuid);
      localStorage.setItem('wallet-network', networkId);
      setNetworkId(networkId);

      console.log('[Wallet] Connected!', this.getDisplayInfo());
      return true;

    } catch (e: any) {
      console.error('[Wallet] Connect error:', e);

      if (e?.code === 'Rejected') {
        throw new Error('Connection rejected by user');
      }
      if (e?.reason?.toLowerCase().includes('locked')) {
        throw new Error('LOCKED: Please unlock your wallet first');
      }
      throw e;
    }
  }

  /**
   * Refresh addresses from the connected wallet
   */
  async refreshAddresses(): Promise<void> {
    if (!this.connectedAPI) return;

    // First try to get state if available (MeshJS/Lace style)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = this.connectedAPI as any;
      if (typeof api.state === 'function') {
        const walletState = await api.state();
        console.log('[Wallet] state() response:', walletState);
        if (walletState.address) {
          this.shieldedAddress = walletState.address;
        }
        if (walletState.coinPublicKey) {
          this.coinPublicKey = walletState.coinPublicKey;
        }
        if (walletState.encryptionPublicKey) {
          this.encryptionPublicKey = walletState.encryptionPublicKey;
        }
      }
    } catch (e) {
      console.log('[Wallet] state() not available or failed:', e);
    }

    try {
      const shielded = await this.connectedAPI.getShieldedAddresses();
      console.log('[Wallet] getShieldedAddresses response:', shielded);

      // Handle different wallet implementations
      if (Array.isArray(shielded)) {
        // YAMORI returns array of strings
        this.shieldedAddress = shielded[0] || null;
        // Only set empty if we didn't get them from state()
        if (!this.coinPublicKey) this.coinPublicKey = '';
        if (!this.encryptionPublicKey) this.encryptionPublicKey = '';
      } else if (typeof shielded === 'string') {
        // Some wallets might return plain string
        this.shieldedAddress = shielded;
        if (!this.coinPublicKey) this.coinPublicKey = '';
        if (!this.encryptionPublicKey) this.encryptionPublicKey = '';
      } else {
        // Standard object format
        this.shieldedAddress = shielded.shieldedAddress;
        this.coinPublicKey = shielded.shieldedCoinPublicKey || this.coinPublicKey || '';
        this.encryptionPublicKey = shielded.shieldedEncryptionPublicKey || this.encryptionPublicKey || '';
      }
    } catch (e) {
      console.log('[Wallet] getShieldedAddresses error:', e);
    }

    try {
      const unshielded = await this.connectedAPI.getUnshieldedAddress();

      // Handle different wallet implementations
      if (typeof unshielded === 'string') {
        // YAMORI returns plain string
        this.unshieldedAddress = unshielded;
      } else {
        // Standard object format
        this.unshieldedAddress = unshielded.unshieldedAddress;
      }
    } catch (e) {
      console.log('[Wallet] getUnshieldedAddress error:', e);
    }

    try {
      const dust = await this.connectedAPI.getDustAddress();

      // Handle different wallet implementations
      if (typeof dust === 'string') {
        // YAMORI returns plain string
        this.dustAddress = dust;
      } else {
        // Standard object format
        this.dustAddress = dust.dustAddress;
      }
    } catch (e) {
      console.log('[Wallet] getDustAddress error:', e);
    }
  }

  /**
   * Refresh balances from the connected wallet
   */
  async refreshBalances(): Promise<void> {
    if (!this.connectedAPI) return;

    try {
      const shielded = await this.connectedAPI.getShieldedBalances();
      // NIGHT token type is empty string
      this.shieldedBalance = shielded[''] || '0';
    } catch (e) {
      console.log('[Wallet] getShieldedBalances error:', e);
    }

    try {
      const unshielded = await this.connectedAPI.getUnshieldedBalances();
      this.unshieldedBalance = unshielded[''] || '0';
    } catch (e) {
      console.log('[Wallet] getUnshieldedBalances error:', e);
    }

    try {
      const dust = await this.connectedAPI.getDustBalance();
      this.dustBalance = dust;
    } catch (e) {
      console.log('[Wallet] getDustBalance error:', e);
    }
  }

  /**
   * Disconnect from wallet
   */
  disconnect(): void {
    this.connected = false;
    this.connectedAPI = null;
    this.initialAPI = null;
    this.state = null;
    this.shieldedAddress = null;
    this.unshieldedAddress = null;
    this.dustAddress = null;
    this.coinPublicKey = null;
    this.encryptionPublicKey = null;
    this.shieldedBalance = null;
    this.unshieldedBalance = null;
    this.dustBalance = null;

    localStorage.removeItem('wallet-connected');
    localStorage.removeItem('wallet-network');
  }

  /**
   * Try to auto-connect using saved connection
   */
  async tryAutoConnect(): Promise<boolean> {
    const savedWallet = localStorage.getItem('wallet-connected');
    const savedNetwork = localStorage.getItem('wallet-network');

    if (!savedWallet || !savedNetwork) return false;

    try {
      return await this.connect(savedNetwork, savedWallet);
    } catch (e) {
      console.log('[Wallet] Auto-connect failed:', e);
      return false;
    }
  }

  /**
   * Get wallet info for display
   */
  getDisplayInfo(): {
    type: string;
    network: string;
    shieldedAddress: string;
    unshieldedAddress: string;
    shieldedBalance: string;
    unshieldedBalance: string;
  } {
    return {
      type: this.walletType,
      network: this.state?.networkId || 'preview',
      shieldedAddress: this.shieldedAddress || 'Not available',
      unshieldedAddress: this.unshieldedAddress || 'Not available',
      shieldedBalance: this.shieldedBalance || '0',
      unshieldedBalance: this.unshieldedBalance || '0',
    };
  }

  /**
   * Balance an unsealed transaction
   */
  async balanceUnsealedTransaction(serializedTx: string): Promise<{ tx: string }> {
    if (!this.connectedAPI) throw new Error('Not connected');
    return this.connectedAPI.balanceUnsealedTransaction(serializedTx);
  }

  /**
   * Submit a transaction
   */
  async submitTransaction(serializedTx: string): Promise<void> {
    if (!this.connectedAPI) throw new Error('Not connected');
    return this.connectedAPI.submitTransaction(serializedTx);
  }

  /**
   * Get the raw connected API for advanced operations
   */
  getConnectedAPI(): ConnectedAPI | null {
    return this.connectedAPI;
  }

  /**
   * Get raw wallet API (for backwards compatibility)
   */
  getRawApi(): any {
    return this.connectedAPI;
  }
}

// Legacy export for compatibility
export class MidnightBrowserWallet {
  static getAvailableWallets() {
    return MidnightWallet.getAvailableWallets().map(w => ({
      name: w.name,
      apiVersion: w.apiVersion,
      connect: () => {},
      icon: w.icon,
      rdns: w.rdns,
    }));
  }

  static getMidnightWalletConnected() {
    return {
      rdns: localStorage.getItem('wallet-connected'),
      networkID: localStorage.getItem('wallet-network'),
    };
  }

  static setMidnightWalletConnected(rdns: string, networkID: string) {
    localStorage.setItem('wallet-connected', rdns);
    localStorage.setItem('wallet-network', networkID);
  }

  static deleteMidnightWalletConnected() {
    localStorage.removeItem('wallet-connected');
    localStorage.removeItem('wallet-network');
  }
}
