# NightForge Explorer

Privacy-first blockchain explorer for [Midnight Network](https://midnight.network) - Built in Japan.

## Live Sites

- **Mainnet**: [mainnet.nightforge.jp](https://mainnet.nightforge.jp)
- **Preprod**: [preprod.nightforge.jp](https://preprod.nightforge.jp)
- **Preview**: [preview.nightforge.jp](https://preview.nightforge.jp)

## Features

- **Privacy Dashboard** - Shielded/unshielded transaction ratio, ZK proof badges
- **On-Chain Governance** - Council proposals, votes, technical committee tracking
- **Cardano Anchor Points** - Cross-chain checkpoint visualization
- **Epoch Timeline** - Session tracking, validator rotations, countdown
- **Bridge Monitor** - Cardano - Midnight bridge operations
- **Contract Tracking** - Deployed contracts from on-chain events
- **DUST Explainer** - Midnight's unique fee mechanism
- **Japanese/English** - Full JP/EN language toggle
- **API Documentation** - Interactive docs at `/api/{network}/docs`
- **Live Block Pulse** - Chain heartbeat animation
- **Network Age** - Live uptime counter
- **Multi-Network** - Switch between mainnet, preprod, preview

## Architecture

```
explorers/
  mainnet/    # Node.js backend (port 3005)
  preprod/    # Node.js backend (port 3004)
  preview/    # Node.js backend (port 3000)

frontends/
  mainnet.html  # Self-contained HTML + JS + CSS
  preprod.html
  preview.html
  assets/       # Favicon, logos

nginx/            # Nginx site configs
systemd/          # Systemd service files
```

## Tech Stack

- **Backend**: Node.js + Express + SQLite (better-sqlite3) + Polkadot.js API
- **Frontend**: Self-contained HTML with Tailwind CSS + Chart.js
- **Indexer**: Real-time block/extrinsic/event indexing via WebSocket RPC
- **Transaction Decoder**: Midnight transaction classification (shielded/unshielded)

## API Endpoints

Full interactive documentation available at each site under `/api/{network}/docs`

## Setup

```bash
cd explorers/mainnet
npm install
npx tsx src/index.ts
```

## License

MIT
