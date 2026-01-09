import { JSX } from "react";
import IconLace from "./icons/icon-lace";
import IconYamori from "./icons/icon-yamori";
import IconNocy from "./icons/icon-nocy";

export const walletsListFormat: {
    [key: string]: { key: string; displayName: string; icon: JSX.Element };
  } = {
    yamori: { key: "yamori", displayName: "Yamori", icon: <IconYamori /> },
    nocy: { key: "com.nocy.wallet", displayName: "Nocy", icon: <IconNocy /> },
    lace: { key: "mnLace", displayName: "LACE", icon: <IconLace /> },
  };

export enum networkID {
  UNDEPLOYED = "undeployed",
  PREVIEW = "preview", 
  PREPROD = "preprod",
  MAINNET = "mainnet"
}