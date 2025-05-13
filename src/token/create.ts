/**
 * This module provides functionality for creating and initializing Solana Token-2022 tokens
 * with various extensions and metadata.
 */

import {
  generateKeyPairSigner,
  signTransactionMessageWithSigners,
  SolanaRpcApi,
  Rpc,
  Address,
  TransactionSigner,
  IInstruction,
} from "@solana/kit";
import {
  getCreateAccountInstruction,
  SYSTEM_PROGRAM_ADDRESS,
} from "@solana-program/system";
import {
  Extension,
  extension,
  ExtensionArgs,
  getInitializeMintInstruction,
  getInitializeTokenMetadataInstruction,
  getMintSize,
  getUpdateTransferHookInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
  getPreInitializeInstructionsForMintExtensions,
} from "@solana-program/token-2022";
import { createSolanaClient, createTransaction } from "gill";
import { loadKeypairSignerFromFile } from "gill/node";

/**
 * Generates instructions for creating and initializing a new token mint
 * @param input Configuration parameters for mint creation
 * @returns Array of instructions for creating and initializing the mint
 */
export const getCreateMintInstructions = async (input: {
  rpc: Rpc<SolanaRpcApi>;
  decimals?: number;
  extensions?: ExtensionArgs[];
  freezeAuthority?: Address;
  mint: TransactionSigner<string>;
  payer: TransactionSigner<string>;
  programAddress?: Address;
}): Promise<IInstruction<string>[]> => {
  // Calculate required space for mint account including extensions
  const space = getMintSize(input.extensions);
  const postInitializeExtensions: Extension["__kind"][] = ["TokenMetadata"];

  // Calculate space excluding post-initialization extensions
  const spaceWithoutPostInitializeExtensions = input.extensions
    ? getMintSize(
        input.extensions.filter(
          (e) => !postInitializeExtensions.includes(e.__kind),
        ),
      )
    : space;

  // Get minimum rent-exempt balance
  const rent = await input.rpc
    .getMinimumBalanceForRentExemption(BigInt(space))
    .send();

  // Return create account and initialize mint instructions
  return [
    getCreateAccountInstruction({
      payer: input.payer,
      newAccount: input.mint,
      lamports: rent,
      space: spaceWithoutPostInitializeExtensions,
      programAddress: input.programAddress ?? TOKEN_2022_PROGRAM_ADDRESS,
    }),
    getInitializeMintInstruction(
      {
        mint: input.mint.address,
        decimals: input.decimals ?? 0,
        freezeAuthority: input.freezeAuthority,
        mintAuthority: input.payer.address,
      },
      {
        programAddress: input.programAddress ?? TOKEN_2022_PROGRAM_ADDRESS,
      },
    ),
  ];
};

/**
 * Generates instructions for creating a Token-2022 token with multiple extensions
 * @param rpc RPC client for Solana network
 * @param feePayer Account that will pay for the transaction
 * @param authority Address that will have authority over the token
 * @param decimals Number of decimal places for the token
 * @param metadata Token metadata including name, symbol and URI
 * @returns Array of instructions for creating the token with all extensions
 */
async function createBackedMintInstructions(
  rpc: Rpc<SolanaRpcApi>,
  feePayer: TransactionSigner<string>,
  authority: Address,
  decimals: number,
  metadata: {
    name: string;
    symbol: string;
    uri: string;
  },
) {
  const tokenProgram = TOKEN_2022_PROGRAM_ADDRESS;
  const mint = await generateKeyPairSigner();

  // Initialize token extensions
  const metadataPointer = extension("MetadataPointer", {
    metadataAddress: mint.address,
    authority: authority,
  });

  const metadataExtensionData = extension("TokenMetadata", {
    updateAuthority: authority,
    mint: mint.address,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    additionalMetadata: new Map(),
  });

  // Permanent delegate extension - allows specified delegate to transfer tokens
  const permanentDelegateExtension = extension("PermanentDelegate", {
    delegate: authority,
  });

  // Scaled UI amount extension - for displaying scaled token amounts in UI
  const scaledUiAmountMintExtension = extension("ScaledUiAmountConfig", {
    authority: authority,
    multiplier: 1,
    newMultiplierEffectiveTimestamp: 0,
    newMultiplier: 1,
  });

  // Confidential balances extension - enables confidential token transfers and balances
  const confidentialBalancesExtension = extension("ConfidentialTransferMint", {
    authority: authority,
    autoApproveNewAccounts: false,
    auditorElgamalPubkey: null,
  });

  // Transfer hooks extension - enables custom logic on token transfers
  const transferHooksExtension = extension("TransferHook", {
    authority: authority,
    programId: SYSTEM_PROGRAM_ADDRESS, // Will be disabled after deployment
  });

  // Get instructions for creating and initializing the mint account
  const [createMintAccountInstruction, initMintInstruction] =
    await getCreateMintInstructions({
      rpc: rpc,
      decimals,
      extensions: [
        metadataPointer,
        metadataExtensionData,
        permanentDelegateExtension,
        scaledUiAmountMintExtension,
        confidentialBalancesExtension,
        transferHooksExtension,
      ],
      freezeAuthority: feePayer.address,
      mint: mint,
      payer: feePayer,
      programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    });

  // Initialize token metadata
  const initMetadataInstruction = getInitializeTokenMetadataInstruction({
    metadata: mint.address,
    mint: mint.address,
    mintAuthority: feePayer,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    updateAuthority: feePayer.address,
  });

  // Disable transfer hook program
  const updateTransferHookInstruction = getUpdateTransferHookInstruction({
    mint: mint.address,
    authority: feePayer.address,
    programId: null,
  });

  // Get pre-initialization instructions for all extensions
  const extensionsList = [
    metadataPointer,
    metadataExtensionData,
    permanentDelegateExtension,
    scaledUiAmountMintExtension,
    confidentialBalancesExtension,
    transferHooksExtension,
  ];

  const preInitializeInstructions = extensionsList.flatMap((ext) =>
    getPreInitializeInstructionsForMintExtensions(mint.address, [ext]),
  );

  // Return all instructions in the correct order
  return [
    createMintAccountInstruction,
    ...preInitializeInstructions,
    initMintInstruction,
    initMetadataInstruction,
    updateTransferHookInstruction,
  ];
}

/**
 * Creates a new Token-2022 token with all extensions and metadata
 * @param rpc RPC client for Solana network
 * @param symbol Token symbol
 * @param uri URI for token metadata
 * @param name Token name
 * @param decimals Number of decimal places
 * @param payer Account that will pay for the transaction
 * @returns Transaction signature
 */
async function createMint(
  rpc: Rpc<SolanaRpcApi>,
  symbol: string,
  uri: string,
  name: string,
  decimals: number,
  payer: TransactionSigner<string>,
) {
  // Get latest blockhash for transaction
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

  // Get all instructions for creating the token
  const createMintInstructions = await createBackedMintInstructions(
    rpc,
    payer,
    payer.address,
    decimals,
    {
      name,
      symbol,
      uri,
    },
  );

  // Create and sign transaction
  const tx = createTransaction({
    feePayer: payer,
    version: "legacy",
    latestBlockhash,
    instructions: createMintInstructions,
  });

  const signedTransaction = await signTransactionMessageWithSigners(tx);

  // Send and confirm transaction
  return await sendAndConfirmTransaction(signedTransaction);
}

// Initialize Solana client for devnet
const { rpc, sendAndConfirmTransaction } = createSolanaClient({
  urlOrMoniker: "devnet",
});

// Example usage
(async () => {
  const payer = await loadKeypairSignerFromFile();
  const symbol = "SST";
  const uri =
    "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/Climate/metadata.json";
  const name = "super sweet token";
  const decimals = 6;

  const tx = await createMint(rpc, symbol, uri, name, decimals, payer);

  console.log(tx);
})();
