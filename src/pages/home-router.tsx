import { ExplorerLite as Explorer } from "./explorer-lite";
import { RealNFTMinter } from "./real-nft";

export const HomeRouter = () => {
  const host = window.location.hostname;
  
  // nft.nightforge.jp shows NFT minter
  if (host.startsWith("nft.")) {
    return <RealNFTMinter />;
  }
  
  // All other subdomains show Explorer
  return <Explorer />;
};
