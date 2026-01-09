import { BrowserRouter, Route, Routes } from "react-router-dom";
import * as pino from "pino";
import { MainLayout } from "./layouts/layout";
import { Home } from "./pages/home/";
import { Counter } from "./pages/counter";
import { WalletUI } from "./pages/wallet-ui";
import { NFTMinter } from "./pages/nft";
import { RealNFTMinter } from "./pages/real-nft";
import { Explorer } from "./pages/explorer";
import { ThemeProvider } from "./components/theme-provider";
import { MidnightMeshProvider } from "./modules/midnight/wallet-widget/contexts/wallet";
import { CounterAppProvider } from "./modules/midnight/counter-sdk/contexts";
import { NFTProvider } from "./modules/midnight/nft-sdk/contexts/nft-providers";
import { NFTDeployedProvider } from "./modules/midnight/nft-sdk/contexts/nft-deployment";
export const logger = pino.pino({
  level: "trace",
});
const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS!;
function App() {
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
                    <Route path="/wallet-ui" element={<WalletUI />} />
                    <Route path="/counter" element={<Counter />} />
                    <Route path="/nft" element={<NFTMinter />} />
                    <Route path="/real-nft" element={<RealNFTMinter />} />
                    <Route path="/explorer" element={<Explorer />} />
                    <Route path="/explorer/preview" element={<Explorer />} />
                    <Route path="/explorer/testnet" element={<Explorer />} />
                    <Route path="/explorer/block/:height" element={<Explorer />} />
                    <Route path="/explorer/tx/:hash" element={<Explorer />} />
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
