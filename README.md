# Solana Token Management Example Scripts

This repository contains example scripts in `src/token` for managing Solana tokens using the Token-2022 program. These scripts are designed to be compatible with Squads multisig workflows, allowing you to perform advanced token operations securely via a multisig.

## Key Concepts

- **Authority**: For each operation, you can specify a Squads multisig address as the authority. This means the multisig will be required to approve and execute the transaction.
- **Fee Payer**: One of the multisig signers (or any account with enough SOL) should be specified as the fee payer. This account will pay the transaction fees.
- **Output**: Each script logs a base58-encoded transaction to the console. You can copy this output and paste it into the Squads UI to import the transaction for review, approval, and on-chain execution by the multisig.

## Example Scripts

### 1. `create.ts`
Creates a new token mint with various Token-2022 extensions (metadata, freeze authority, permanent delegate, confidential balances, transfer hooks, etc.).
- **Usage**: Specify the multisig address as the authority and a signer as the fee payer.
- **Output**: Base58-encoded transaction for mint creation.

### 2. `mint.ts`
Mints new tokens to a specified account.
- **Usage**: Use the multisig as the mint authority and a signer as the fee payer.
- **Output**: Base58-encoded transaction for minting tokens.

### 3. `updateAuthority.ts`
Updates the authority for various roles (mint, freeze, etc.) on a token mint.
- **Usage**: Specify the multisig as the new authority or the current authority, depending on the operation. Use a signer as the fee payer.
- **Output**: Base58-encoded transaction for updating authorities.

### 4. `updateScaledUI.ts`
Updates the multiplier for the Scaled UI Amount extension on a mint.
- **Usage**: Use the multisig as the authority and a signer as the fee payer.
- **Output**: Base58-encoded transaction for updating the scaled UI multiplier.

## How to Use with Squads Multisig
These scripts currently print out base58-encoded transactions that you can import directly into Squads for multisig usage. If you are using the Squads UI you can follow these steps to execute a transaction assigned to the multisig:

1. **Edit the script**: Set the `authority` parameter to your Squads multisig address and the `payer` to a signer with enough SOL. We will use the `mint.ts` script as the example here.
    1. Payer: the address that will sign and pay for transaction fees
    1. Mint: the token address that is being minted
    1. Authority: the address that has authority to mint new tokens. In this example it is the Squads multisig smart contract wallet. 
    1. Destination: the destination address for minting. Note: this is the top level account as the script will automatically derive the associated token account for the address provided.
    1. Amount: the integer amount to send onchain. If your token uses 6 decimals then 1_000_000 = 1 token.
2. **Run the script**: Execute the script using Node.js. The script will log a base58-encoded transaction to the console. `npx ts-node ./src/token/mint.ts`
3. **Import to Squads**: Copy the base58 transaction and paste it into the Squads UI (https://app.squads.so/squads) using the "Import Transaction" feature. This is available at "Developers" -> "TX Builder" -> "import"
    1. To test in devnet you can use [this link](https://devnet.squads.so/developers/builder)
4. **Approve and Execute**: The multisig can now review, approve, and execute the transaction on-chain.
    1. You can run a simulation of the transaction and review all instructions in order to ensure the validity and processing of the transaction. 

## Notes
- The fee payer must have enough SOL to cover transaction fees.
- The scripts are designed for flexibility and can be adapted for other authorities or workflows as needed.
- Make sure to review and test transactions on devnet before using on mainnet.

---

For more details on each script, see the comments and code in the respective files in `src/token/`.
