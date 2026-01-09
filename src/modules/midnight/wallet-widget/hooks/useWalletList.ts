import { useEffect, useState } from "react";
import { MidnightBrowserWallet } from "../api/walletController";

export const useWalletList = () => {
  const [wallets, setWallets] = useState<any[]>([]);
  useEffect(() => {
    async function get() {
      setWallets(MidnightBrowserWallet.getAvailableWallets());
    }
    get();
  }, []);

  return wallets;
};
