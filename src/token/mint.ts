/**
 * This module provides functionality for minting tokens to associated token accounts
 * using the Token-2022 program.
 */

import {
  Address,
  Rpc,
  SolanaRpcApi,
  getBase58Decoder,
  createNoopSigner,
  compileTransaction,
} from "@solana/kit";
import {
  getMintToInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
  getCreateAssociatedTokenIdempotentInstruction,
} from "@solana-program/token-2022";
import { createSolanaClient, createTransaction } from "gill";
import { getAssociatedTokenAccountAddress } from "gill/programs/token";

// Initialize Solana client for devnet
const { rpc } = createSolanaClient({
  urlOrMoniker: "devnet",
});

/**
 * Mints tokens to a destination address's associated token account
 * @param rpc RPC client for Solana network
 * @param mint Address of the token mint
 * @param payer Address that will pay for the transaction
 * @param authority Address with minting authority
 * @param destination Address to receive the minted tokens
 * @param amount Amount of tokens to mint
 * @returns Compiled transaction message bytes
 */
async function mintTo(
  rpc: Rpc<SolanaRpcApi>,
  mint: Address,
  payer: Address,
  authority: Address,
  destination: Address,
  amount: bigint,
) {
  // Get the associated token account address for the destination
  const token = await getAssociatedTokenAccountAddress(
    mint,
    destination,
    TOKEN_2022_PROGRAM_ADDRESS,
  );

  // Create a no-op signer for the payer
  const payerSigner = createNoopSigner(payer);

  // Create instruction to ensure the associated token account exists
  // This is only needed if the token account hasn't been created yet
  const createIdempotentIx = getCreateAssociatedTokenIdempotentInstruction({
    payer: payerSigner,
    ata: token,
    mint,
    owner: destination,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  // Create a no-op signer for the mint authority
  const authoritySigner = createNoopSigner(authority);

  // Create instruction to mint tokens to the associated token account
  const mintToIx = getMintToInstruction(
    {
      mint,
      token,
      mintAuthority: authoritySigner,
      amount,
    },
    {
      programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    },
  );

  // Get latest blockhash for transaction
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Create and compile transaction
  const tx = createTransaction({
    feePayer: payer,
    version: "legacy",
    latestBlockhash,
    instructions: [mintToIx],
  });

  const compiledTx = compileTransaction(tx);
  return getBase58Decoder().decode(compiledTx.messageBytes);
}

// Example usage
(async () => {
  // For quick testing you can uncomment this line to use a keypair
  // for the payer and authority created by the solana-keygen tool
  // loadKeypairSignerFromFile is available in the gill/node package
  // const payer = await loadKeypairSignerFromFile();

  // Test parameters
  const payer = "DmatrEXUzjvGRQeQAUwefktx78f5a8ZU2gTUvDv6Zmca";
  const mint = "5cxLoRgCAcPUCwwnfqmbTKVEDeq2TCaDUN3Cej39QanB";
  const authority = "8VGGybCZ4PRpJyJKD9NWTPcuprzJR4fkziWWWAhwg5fc";
  const destination = "8VGGybCZ4PRpJyJKD9NWTPcuprzJR4fkziWWWAhwg5fc";
  const amount = 100_000_000n;

  // Execute mint operation
  const tx = await mintTo(
    rpc,
    mint as Address,
    payer as Address,
    authority as Address,
    destination as Address,
    amount,
  );

  console.log(tx);
})();
