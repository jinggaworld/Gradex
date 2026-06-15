"use client";

interface CasperWalletProvider {
  requestConnection: () => Promise<{ publicKey: string }>;
  disconnect: () => Promise<void>;
  isConnected: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string | null>;
  sign: (deployJson: any, publicKey: string) => Promise<any>;
}

interface CasperWalletState {
  isConnected: boolean;
  publicKey: string | null;
  balance: string;
  isConnecting: boolean;
  error: string | null;
}

class CasperWalletService {
  private state: CasperWalletState = {
    isConnected: false,
    publicKey: null,
    balance: "0",
    isConnecting: false,
    error: null,
  };

  private listeners: Set<(state: CasperWalletState) => void> = new Set();

  async connect(): Promise<void> {
    this.setState({ isConnecting: true, error: null });

    try {
      const provider = this.getProvider();
      const { publicKey } = await provider.requestConnection();

      this.setState({
        isConnected: true,
        publicKey,
        isConnecting: false,
        error: null,
      });
    } catch (error) {
      this.setState({
        isConnecting: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to connect wallet",
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const provider = this.getProvider();
      await provider.disconnect();
    } catch {
      // Ignore disconnect errors
    }

    this.setState({
      isConnected: false,
      publicKey: null,
      balance: "0",
      isConnecting: false,
      error: null,
    });
  }

  async signDeploy(deployJson: any): Promise<any> {
    const provider = this.getProvider();
    if (!this.state.publicKey) throw new Error("Wallet not connected");
    return provider.sign(deployJson, this.state.publicKey);
  }

  /** Update the balance in wallet state and notify subscribers */
  updateBalance(balance: string) {
    this.setState({ balance });
  }

  private getProvider(): CasperWalletProvider {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    const provider = (window as any).CasperWalletProvider;
    if (!provider) {
      throw new Error(
        "Casper Wallet not detected. Please install the Casper Wallet browser extension."
      );
    }

    return provider;
  }

  private setState(partial: Partial<CasperWalletState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: (state: CasperWalletState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): CasperWalletState {
    return { ...this.state };
  }
}

export const walletService = new CasperWalletService();
