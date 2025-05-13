import axios, { AxiosInstance, AxiosResponse } from "axios";
import { createHmac } from "crypto";
import { Buffer } from "buffer";

export interface FordefiConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
}

// Transaction types supported by Fordefi
export enum TransactionType {
  SolanaTransaction = "solana_transaction",
  SolanaMessage = "solana_message",
  EvmTransaction = "evm_transaction",
  EvmMessage = "evm_message",
}

// Transaction state in Fordefi
export enum TransactionState {
  Created = "created",
  WaitingForApproval = "waiting_for_approval",
  WaitingForSignature = "waiting_for_signature",
  ReadyForPush = "ready_for_push",
  Pushed = "pushed",
  Completed = "completed",
  Failed = "failed",
  Aborted = "aborted",
}

// Base transaction request
export interface TransactionRequest {
  type: TransactionType;
  vault_id: string;
  idempotence_id?: string;
  note?: string;
  sign_mode?: "auto" | "manual";
  push_mode?: "auto" | "manual";
}

// Solana transaction specific request
export interface SolanaTransactionRequest extends TransactionRequest {
  type: TransactionType.SolanaTransaction;
  transaction: string; // Base64 encoded transaction
  chain: string; // E.g., "solana_mainnet"
}

// Transaction response from Fordefi
export interface TransactionResponse {
  id: string;
  creation_time: string;
  modification_time: string;
  state: TransactionState;
  vault_id: string;
  type: TransactionType;
  chain: {
    unique_id: string;
    name: string;
  };
  transaction_hash?: string;
  signatures?: Array<{
    signature: string;
    public_key: string;
  }>;
}

export class FordefiClient {
  private readonly api: AxiosInstance;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private accessToken: string | null = null;

  constructor(config: FordefiConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.api = axios.create({
      baseURL: config.baseUrl || "https://api.fordefi.com",
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Creates signature for Fordefi API requests
   * @param body - The request body
   * @returns Object with signature and timestamp
   */
  private createSignature(body: string): {
    signature: string;
    timestamp: number;
  } {
    const timestamp = Date.now();
    const message = `${timestamp}${body}`;
    const signature = createHmac("sha256", this.apiSecret)
      .update(message)
      .digest("hex");

    return { signature, timestamp };
  }

  /**
   * Authenticates with Fordefi to get an access token
   * @returns Access token
   */
  private async authenticate(): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const requestBody = JSON.stringify({
      apiKey: this.apiKey,
    });

    const { signature, timestamp } = this.createSignature(requestBody);

    try {
      const response = await this.api.post("/auth", requestBody, {
        headers: {
          "x-signature": signature,
          "x-timestamp": timestamp,
        },
      });

      this.accessToken = response.data.accessToken;
      if (!this.accessToken) {
        throw new Error("No access token received from Fordefi");
      }
      return this.accessToken;
    } catch (error) {
      console.error("Authentication failed:", error);
      throw new Error("Failed to authenticate with Fordefi");
    }
  }

  /**
   * Performs a request to the Fordefi API with proper authentication and error handling
   * @param method - HTTP method
   * @param path - API path
   * @param body - Request body (optional)
   * @returns Response data
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: any,
  ): Promise<T> {
    const accessToken = await this.authenticate();
    const url = `${this.api.defaults.baseURL}${path}`;
    const requestBody = body ? JSON.stringify(body) : "";

    try {
      let response: AxiosResponse;

      if (method === "GET") {
        response = await axios.request({
          method,
          url,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          validateStatus: () => true,
        });
      } else {
        const { signature, timestamp } = this.createSignature(requestBody);

        response = await axios.post(url, requestBody, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "x-signature": signature,
            "x-timestamp": timestamp,
            "Content-Type": "application/json",
          },
          validateStatus: () => true,
        });
      }

      if (response.status < 200 || response.status >= 300) {
        let errorMessage = `HTTP error occurred: status = ${response.status}`;
        try {
          const errorDetail = response.data;
          errorMessage += `\nError details: ${JSON.stringify(errorDetail)}`;
        } catch {
          errorMessage += `\nRaw response: ${response.data}`;
        }
        throw new Error(errorMessage);
      }

      return method === "GET" ? response.data : response.data;
    } catch (error: any) {
      // If we have an Axios error with a response, parse it
      if (error.response) {
        let errorMessage = `HTTP error occurred: status = ${error.response.status}`;
        try {
          const errorDetail = error.response.data;
          errorMessage += `\nError details: ${JSON.stringify(errorDetail)}`;
        } catch {
          errorMessage += `\nRaw response: ${error.response.data}`;
        }
        throw new Error(errorMessage);
      }
      // Otherwise, it's a network or unknown error
      throw new Error(`Network error occurred: ${error.message ?? error}`);
    }
  }

  /**
   * Signs a transaction using Fordefi
   * @param transaction - Transaction data as Uint8Array
   * @returns Signed transaction as Uint8Array
   */
  async signTransaction(transaction: Uint8Array): Promise<Uint8Array> {
    try {
      // Convert transaction to base64
      const serializedTx = Buffer.from(transaction).toString("base64");

      // Send to Fordefi for signing
      const response = await this.request<{ signedTransaction: string }>(
        "POST",
        "/v1/transactions/sign",
        {
          transaction: serializedTx,
          network: "solana",
        },
      );

      // Parse the signed transaction
      return Buffer.from(response.signedTransaction, "base64");
    } catch (error) {
      console.error("Error signing transaction with Fordefi:", error);
      throw error;
    }
  }

  /**
   * Creates a transaction and waits for it to complete or reach a terminal state
   * This is a streamlined alternative to creating and then polling for completion
   *
   * @param vaultId - ID of the vault to use for signing
   * @param transaction - Base64 encoded transaction
   * @param chain - Chain identifier (e.g., "solana_mainnet")
   * @param options - Additional options for the transaction
   * @returns Transaction response with completion status
   */
  async createAndWaitTransaction(
    vaultId: string,
    transaction: Uint8Array,
    chain: string,
    options: {
      note?: string;
      idempotenceId?: string;
      signMode?: "auto" | "manual";
      pushMode?: "auto" | "manual";
      timeout?: number; // Timeout in milliseconds
    } = {},
  ): Promise<TransactionResponse> {
    try {
      // Convert transaction to base64
      const serializedTx = Buffer.from(transaction).toString("base64");

      // Prepare the transaction request
      const txRequest: SolanaTransactionRequest = {
        type: TransactionType.SolanaTransaction,
        vault_id: vaultId,
        transaction: serializedTx,
        chain: chain,
        idempotence_id: options.idempotenceId,
        note: options.note,
        sign_mode: options.signMode,
        push_mode: options.pushMode,
      };

      // Use the create-and-wait endpoint with timeout option if specified
      const requestOptions: Record<string, any> = {};
      if (options.timeout) {
        requestOptions.timeout = options.timeout;
      }

      const response = await this.request<TransactionResponse>(
        "POST",
        "/v1/transactions/create-and-wait",
        {
          ...txRequest,
          ...requestOptions,
        },
      );

      return response;
    } catch (error) {
      console.error("Error creating and waiting for transaction:", error);
      throw error;
    }
  }

  /**
   * Gets the wallet address from Fordefi
   * @returns Wallet address
   */
  async getWalletAddress(): Promise<string> {
    try {
      const response = await this.request<{ address: string }>(
        "GET",
        "/v1/wallets/solana",
      );
      return response.address;
    } catch (error) {
      console.error("Error getting Fordefi wallet address:", error);
      throw error;
    }
  }

  /**
   * Gets transaction status from Fordefi
   * @param txId - Transaction ID
   * @returns Transaction status
   */
  async getTransactionStatus(txId: string): Promise<string> {
    try {
      const response = await this.request<{ status: string }>(
        "GET",
        `/v1/transactions/${txId}`,
      );
      return response.status;
    } catch (error) {
      console.error("Error getting transaction status:", error);
      throw error;
    }
  }
}
