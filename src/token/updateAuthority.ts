import {
  AuthorityType,
  getSetAuthorityInstruction,
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
  let authorityType: AuthorityType;
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
      authorityType = AuthorityType.MintTokens;
      break;
    case "FreezeAccount":
      authorityType = AuthorityType.FreezeAccount;
      break;
    case "AccountOwner":
      authorityType = AuthorityType.AccountOwner;
      break;
    case "CloseAccount":
      authorityType = AuthorityType.CloseAccount;
      break;
    case "ConfidentialTransferMint":
      authorityType = AuthorityType.ConfidentialTransferMint;
      break;
    case "MetadataPointer":
      authorityType = AuthorityType.MetadataPointer;
      break;
    case "PermanentDelegate":
      authorityType = AuthorityType.PermanentDelegate;
      break;
    case "ScaledUiAmount":
      authorityType = AuthorityType.ScaledUiAmount;
      break;
    case "TransferHookProgramId":
      authorityType = AuthorityType.TransferHookProgramId;
      break;
    case "ConfidentialTransferFeeConfig":
      authorityType = AuthorityType.ConfidentialTransferFeeConfig;
      break;
    case "GroupPointer":
      authorityType = AuthorityType.GroupPointer;
      break;
    case "GroupMemberPointer":
      authorityType = AuthorityType.GroupMemberPointer;
      break;
    case "Pause":
      authorityType = AuthorityType.Pause;
      break;
    case "InterestRate":
      authorityType = AuthorityType.InterestRate;
      break;
    case "WithheldWithdraw":
      authorityType = AuthorityType.WithheldWithdraw;
      break;
    case "CloseMint":
      authorityType = AuthorityType.CloseMint;
      break;
    case "TransferFeeConfig":
      authorityType = AuthorityType.TransferFeeConfig;
      break;
    case "TransferHookProgramId":
      authorityType = AuthorityType.TransferHookProgramId;
      break;
    default:
      throw new Error(`Unsupported authority role: ${input.role}`);
  }
  instructions = [
    getSetAuthorityInstruction({
      owned: input.mint,
      owner: input.currentAuthority.address,
      newAuthority: input.newAuthority,
      authorityType,
    }),
  ];
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
