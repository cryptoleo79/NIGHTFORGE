// Midnight Mainnet Network Configuration
export const config = {
  // Network
  network: {
    name: 'Midnight Mainnet',
    rpcEndpoint: 'wss://rpc.mainnet.midnight.network',
    httpEndpoint: 'https://rpc.mainnet.midnight.network',
    genesisHash: '', // Will be populated on first connect
    chainType: 'Live',
  },

  // Node Info (populated dynamically on connect)
  node: {
    name: 'Midnight Node',
    version: '',
    ledgerVersion: '',
    specVersion: 0,
    transactionVersion: 0,
  },

  // Indexer Settings
  indexer: {
    batchSize: 100,
    startFromRecent: false,
    reconnectDelay: 5000,
    maxReconnectDelay: 60000,
  },

  // API Server
  api: {
    port: 3005,
    corsOrigins: ['http://localhost:3000', 'http://localhost:5173', 'https://nightforge.jp', 'https://mainnet.nightforge.jp', 'https://preprod.nightforge.jp', 'https://preview.nightforge.jp'],
  },

  // Database
  database: {
    path: './data/mainnet.db',
  },

  // Sidechain (Cardano Partner Chain - Mainnet)
  sidechain: {
    mainchainEpoch: 0,
    dParameter: {
      numPermissionedCandidates: 0,
      numRegisteredCandidates: 0,
    },
  },
};

export default config;
