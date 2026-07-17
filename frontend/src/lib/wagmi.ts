import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { monadTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "ShipStake",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [monadTestnet],
  ssr: true,
});
