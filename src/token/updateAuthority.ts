import {
  AuthorityType,
  getSetAuthorityInstruction,
  getUpdateTokenMetadataUpdateAuthorityInstruction,
} from "@solana-program/token-2022";
import {
  Address,
  compileTransaction,
  getBase58Decoder,
  IInstruction,
  Rpc,
  SolanaRpcApi,
  TransactionSigner,
} from "@solana/kit";
import { createSolanaClient, createTransaction } from "gill";
import { loadKeypairSignerFromFile } from "gill/node";

const { rpc } = createSolanaClient({
  urlOrMoniker: "devnet",
});

const getUpdateAuthorityInstructions = (input: {
  mint: Address;
  role: string | AuthorityType;
  currentAuthority: TransactionSigner<string>;
  newAuthority: Address;
}) => {
  let instructions: IInstruction<string>[] = [];
  if (input.role === "Metadata") {
    return [
      getUpdateTokenMetadataUpdateAuthorityInstruction({
        metadata: input.mint,
        updateAuthority: input.currentAuthority,
        newUpdateAuthority: input.newAuthority,
      }),
    ];
  }
  switch (input.role as AuthorityType) {
    case AuthorityType.MintTokens:
    case AuthorityType.FreezeAccount:
      // NOTE: the following authorityTypes require a new version of the token-2022 sdk to be released
      // https://github.com/solana-program/token-2022/pull/434
      // case AuthorityType.ConfidentialTransferMint:
      // case AuthorityType.MetadataPointer:
      // case AuthorityType.PermanentDelegate:
      // case AuthorityType.ScaledUiAmount:
      // case AuthorityType.TransferHookProgramId:
      instructions = [
        getSetAuthorityInstruction({
          owned: input.mint,
          owner: input.currentAuthority,
          newAuthority: input.newAuthority,
          authorityType: input.role as AuthorityType,
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
  role: string | AuthorityType;
  payer: TransactionSigner<string>;
  currentAuthority: TransactionSigner<string>;
  newAuthority: Address;
}) => {
  const instructions = getUpdateAuthorityInstructions(input);
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
  const payer = await loadKeypairSignerFromFile();
  const currentAuthority = await loadKeypairSignerFromFile();
  const mint = "5cxLoRgCAcPUCwwnfqmbTKVEDeq2TCaDUN3Cej39QanB";
  const newAuthority = "8VGGybCZ4PRpJyJKD9NWTPcuprzJR4fkziWWWAhwg5fc";
  const role = AuthorityType.MintTokens;

  const tx = await updateAuthority({
    rpc,
    mint: mint as Address,
    role,
    payer,
    currentAuthority,
    newAuthority: newAuthority as Address,
  });

  console.log(tx);
})();
