import { BrowserRouter, Route, Routes } from "react-router-dom";
import * as pino from "pino";
import { MainLayout } from "./layouts/layout";
import { Home } from "./pages/home/";
import { Counter } from "./pages/counter";
import { WalletUI } from "./pages/wallet-ui";
import { NFTMinter } from "./pages/nft";
import { RealNFTMinter } from "./pages/real-nft";
import { ExplorerLite as Explorer } from "./pages/explorer-lite";
import { HomeRouter } from "./pages/home-router";
import { ThemeProvider } from "./components/theme-provider";
import { MidnightMeshProvider } from "./modules/midnight/wallet-widget/contexts/wallet";
import { CounterAppProvider } from "./modules/midnight/counter-sdk/contexts";
import { NFTProvider } from "./modules/midnight/nft-sdk/contexts/nft-providers";
import { NFTDeployedProvider } from "./modules/midnight/nft-sdk/contexts/nft-deployment";

export const logger = pino.pino({
  level: "trace",
});

const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS!;

// Check if we're on explorer subdomain
const isExplorerSubdomain = () => {
  const host = window.location.hostname;
  return host.startsWith('preview.') || host.startsWith('testnet.');
};

function App() {
  // For explorer subdomains, render Explorer directly without MainLayout
  if (isExplorerSubdomain()) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <BrowserRouter basename="/">
          <Routes>
            <Route path="/" element={<Explorer />} />
            <Route path="/block/:height" element={<Explorer />} />
            <Route path="/tx/:hash" element={<Explorer />} />
            <Route path="/contract/:address" element={<Explorer />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    );
  }

  // For main site, use full layout with all features
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <MidnightMeshProvider>
        <CounterAppProvider logger={logger} contractAddress={contractAddress}>
          <NFTProvider logger={logger}>
            <NFTDeployedProvider>
              <BrowserRouter basename="/">
                <Routes>
                  <Route element={<MainLayout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/block/:height" element={<Explorer />} />
                    <Route path="/tx/:hash" element={<Explorer />} />
            <Route path="/contract/:address" element={<Explorer />} />
                    <Route path="/wallet-ui" element={<WalletUI />} />
                    <Route path="/counter" element={<Counter />} />
                    <Route path="/nft" element={<NFTMinter />} />
                    <Route path="/real-nft" element={<RealNFTMinter />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </NFTDeployedProvider>
          </NFTProvider>
        </CounterAppProvider>
      </MidnightMeshProvider>
    </ThemeProvider>
  );
}

export default App;
