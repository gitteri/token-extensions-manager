import {
  getUpdateTokenMetadataUpdateAuthorityInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "@solana-program/token-2022";
import {
  Address,
  compileTransaction,
  createNoopSigner,
  getBase58Decoder,
  IInstruction,
  Rpc,
  SolanaRpcApi,
  TransactionSigner,
} from "@solana/kit";
import { createSolanaClient, createTransaction } from "gill";
import { getSetAuthorityInstruction } from "./setAuthority";

const { rpc } = createSolanaClient({
  urlOrMoniker: "devnet",
});

const getUpdateAuthorityInstructions = (input: {
  mint: Address;
  role: string;
  currentAuthority: TransactionSigner<string>;
  newAuthority: Address;
}) => {
  let instructions: IInstruction<string>[] = [];
  if (input.role === "Metadata") {
    return [
      getUpdateTokenMetadataUpdateAuthorityInstruction(
        {
          metadata: input.mint,
          updateAuthority: input.currentAuthority,
          newUpdateAuthority: input.newAuthority,
        },
        {
          programAddress: TOKEN_2022_PROGRAM_ADDRESS,
        }
      ),
    ];
  }
  switch (input.role) {
    case "MintTokens":
    case "FreezeAccount":
    // NOTE: the following authorityTypes require a new version of the token-2022 sdk to be released
    // https://github.com/solana-program/token-2022/pull/434
    case "ConfidentialTransferMint":
    case "MetadataPointer":
    case "PermanentDelegate":
    case "ScaledUiAmount":
    case "TransferHookProgramId":
      instructions = [
        getSetAuthorityInstruction({
          mint: input.mint,
          authority: input.currentAuthority.address,
          newAuthority: input.newAuthority,
          authorityType: input.role,
        }),
      ];
      break;
    default:
      throw new Error(`Unsupported authority role: ${input.role}`);
  }
  return instructions;
};

const updateAuthority = async (input: {
  rpc: Rpc<SolanaRpcApi>;
  mint: Address;
  role: string;
  payer: TransactionSigner<string>;
  currentAuthority: TransactionSigner<string>;
  newAuthority: Address;
}) => {
  const instructions = getUpdateAuthorityInstructions({
    mint: input.mint,
    role: input.role,
    currentAuthority: input.currentAuthority,
    newAuthority: input.newAuthority,
  });
  const { value: latestBlockhash } = await input.rpc
    .getLatestBlockhash()
    .send();
  const tx = createTransaction({
    feePayer: input.payer,
    version: "legacy",
    latestBlockhash,
    instructions,
  });

  const compiledTx = compileTransaction(tx);
  return getBase58Decoder().decode(compiledTx.messageBytes);
};

(async () => {

  const payer = "DmatrEXUzjvGRQeQAUwefktx78f5a8ZU2gTUvDv6Zmca";
  const mint = "5cxLoRgCAcPUCwwnfqmbTKVEDeq2TCaDUN3Cej39QanB";
  const currentAuthority = "8VGGybCZ4PRpJyJKD9NWTPcuprzJR4fkziWWWAhwg5fc";
  const newAuthority = "8VGGybCZ4PRpJyJKD9NWTPcuprzJR4fkziWWWAhwg5fc";
  const role = "ScaledUiAmount";

  const tx = await updateAuthority({
    rpc,
    mint: mint as Address,
    role,
    payer: createNoopSigner(payer as Address),
    currentAuthority: createNoopSigner(currentAuthority as Address),
    newAuthority: newAuthority as Address,
  });

  console.log(tx);
})();
