import {
  Address,
  Rpc,
  SolanaRpcApi,
  compileTransaction,
  getBase58Decoder,
  createNoopSigner,
} from "@solana/kit";
import { getUpdateMultiplierScaledUiMintInstruction } from "@solana-program/token-2022";
import { createSolanaClient, createTransaction } from "gill";

const { rpc } = createSolanaClient({
  urlOrMoniker: "devnet",
});

async function updateScaledUI(
  rpc: Rpc<SolanaRpcApi>,
  mint: Address,
  payer: Address,
  authority: Address,
  newMultiplier: number,
  newMultiplierEffectiveTimestamp: bigint,
) {
  const authoritySigner = createNoopSigner(authority);
  const updateIx = getUpdateMultiplierScaledUiMintInstruction({
    mint,
    authority: authoritySigner,
    multiplier: newMultiplier,
    effectiveTimestamp: newMultiplierEffectiveTimestamp,
  });
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
  const newMultiplier = 1.1;
  const newMultiplierEffectiveTimestamp = BigInt(
    Math.floor(Date.now() / 1000) + 180,
  );

  const tx = await updateScaledUI(
    rpc,
    mint as Address,
    payer as Address,
    authority as Address,
    newMultiplier,
    newMultiplierEffectiveTimestamp,
  );

  console.log(tx);
})();
