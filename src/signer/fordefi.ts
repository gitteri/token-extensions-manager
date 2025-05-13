
import { SignatureBytes, Transaction, address, TransactionSendingSigner } from "@solana/kit";
import { FordefiClient } from "../fordefi/client";

const fordefiSigner = (
  addr: string,
  vaultId: string,
  chain: string,
  options: {
    note?: string;
    idempotenceId?: string;
    signMode?: "auto" | "manual";
    pushMode?: "auto" | "manual";
    timeout?: number; // Timeout in milliseconds
  },
) => {
  const fordefiClient = new FordefiClient({
    apiKey: process.env.FORDEFI_API_KEY!,
    apiSecret: process.env.FORDEFI_API_SECRET!,
  });
  const fordefiTransactionSendingSigner: TransactionSendingSigner<string> = {
    address: address(addr),
    signAndSendTransactions: async (
      transactions: Transaction[],
    ): Promise<SignatureBytes[]> => {
      const fordefiClient = new FordefiClient({
        apiKey: process.env.FORDEFI_API_KEY!,
        apiSecret: process.env.FORDEFI_API_SECRET!,
      });

      // Process all transactions in parallel and wait for all to complete
      const signaturePromises = transactions.map(async (tx, index) => {
        // Convert transaction message bytes to proper Uint8Array format for Fordefi
        const txBuffer = Buffer.from(tx.messageBytes);

        const response = await fordefiClient.createAndWaitTransaction(
          vaultId,
          txBuffer,
          chain,
          {
            ...options,
            // Append index to idempotenceId if provided to make it unique per transaction
            idempotenceId: options.idempotenceId
              ? `${options.idempotenceId}-${index}`
              : undefined,
          },
        );

        // Extract the signature from the response
        if (!response.signatures || response.signatures.length === 0) {
          throw new Error(`No signature returned for transaction ${index}`);
        }

        // Get the base64 signature from the response and convert to bytes
        const signatureBase64 = response.signatures[0].signature;
        const signatureBuffer = Buffer.from(signatureBase64, "base64");

        // In Solana, a signature is a 64-byte value
        if (signatureBuffer.length !== 64) {
          throw new Error(
            `Invalid signature length: ${signatureBuffer.length}, expected 64 bytes`,
          );
        }

        // Use the proper SignatureBytes type - we need to return it as a Uint8Array with the
        // correct type brand to satisfy TypeScript
        return new Uint8Array(signatureBuffer) as SignatureBytes;
      });

      // Wait for all transactions to be processed
      return Promise.all(signaturePromises);
    },
  };
  return fordefiTransactionSendingSigner;
};

export default fordefiSigner;
