"use client";

import { Component, createContext, useContext, useEffect, useState, type ReactNode } from "react";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();

const RainbowKitReadyContext = createContext(false);

export function useRainbowKitReady() {
  return useContext(RainbowKitReadyContext);
}

// RainbowKit's wallet UI has occasionally thrown on mount when a browser
// carries stale persisted wagmi state from an earlier wagmi major version.
// Fall back to unwrapped children instead of blanking the whole page.
class RainbowKitBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("RainbowKitProvider failed to mount:", error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitReadyContext.Provider value={mounted}>
          {mounted ? (
            <RainbowKitBoundary fallback={children}>
              <RainbowKitProvider>{children}</RainbowKitProvider>
            </RainbowKitBoundary>
          ) : (
            children
          )}
        </RainbowKitReadyContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
