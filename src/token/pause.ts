import {
  Address,
  Rpc,
  SolanaRpcApi,
  compileTransaction,
  getBase58Decoder,
  createNoopSigner,
  IInstruction,
} from "@solana/kit";
import {
  getPauseInstruction,
  getResumeInstruction,
} from "@solana-program/token-2022";
import { createSolanaClient, createTransaction } from "gill";

const { rpc } = createSolanaClient({
  urlOrMoniker: "devnet",
});

async function pause(
  rpc: Rpc<SolanaRpcApi>,
  mint: Address,
  payer: Address,
  authority: Address,
  paused: boolean,
) {
  const authoritySigner = createNoopSigner(authority);
  let updateIx: IInstruction<string>;
  if (paused) {
    updateIx = getPauseInstruction({
      mint,
      authority: authoritySigner,
    });
  } else {
    updateIx = getResumeInstruction({
      mint,
      authority: authoritySigner,
    });
  }
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const tx = createTransaction({
    feePayer: payer,
    version: "legacy",
    latestBlockhash,
    instructions: [updateIx],
  });

  const compiledTx = compileTransaction(tx);
  return getBase58Decoder().decode(compiledTx.messageBytes);
}

(async () => {
  const payer = "DmatrEXUzjvGRQeQAUwefktx78f5a8ZU2gTUvDv6Zmca";
  const mint = "5cxLoRgCAcPUCwwnfqmbTKVEDeq2TCaDUN3Cej39QanB";
  const authority = "8VGGybCZ4PRpJyJKD9NWTPcuprzJR4fkziWWWAhwg5fc";
  const paused = true;

  const tx = await pause(
    rpc,
    mint as Address,
    payer as Address,
    authority as Address,
    paused,
  );

  console.log(tx);
})();
