import { TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";
import {
  Address,
  IInstruction,
  AccountRole,
  getAddressCodec,
} from "@solana/kit";

// This is a workaround to set authorities that are not supported by the SDK.
// This is a manual implementation of the SetAuthority instruction.
export const getSetAuthorityInstruction = (input: {
  mint: Address;
  authority: Address;
  newAuthority: Address;
  authorityType: string;
}): IInstruction<string> => {
  const AuthorityType = {
    MintTokens: 0,
    FreezeAccount: 1,
    AccountOwner: 2,
    CloseAccount: 3,
    TransferFeeConfig: 4,
    WithheldWithdraw: 5,
    CloseMint: 6,
    InterestRate: 7,
    PermanentDelegate: 8,
    ConfidentialTransferMint: 9,
    TransferHookProgramId: 10,
    ConfidentialTransferFeeConfig: 11,
    MetadataPointer: 12,
    GroupPointer: 13,
    GroupMemberPointer: 14,
    ScaledUiAmount: 15,
    Pause: 16,
  };
  const authorityType = AuthorityType[input.authorityType as keyof typeof AuthorityType];
  if (isNaN(authorityType)) {
    throw new Error(`Invalid authority type: ${input.authorityType}`);
  }

  // Encode instruction data manually: discriminator (6) | authorityType | newAuthorityOption (1) | newAuthority (32 bytes)
  const addressCodec = getAddressCodec();
  const newAuthorityBytes = addressCodec.encode(input.newAuthority);

  const data = new Uint8Array(1 + 1 + 1 + 32); // 35 bytes
  data[0] = 6; // discriminator for SetAuthority
  data[1] = authorityType; // authorityType
  data[2] = 1; // newAuthorityOption = Some
  data.set(newAuthorityBytes, 3); // newAuthority

  return {
    // Account metas must match the canonical order for SetAuthority: [owned, owner]
    accounts: [
      { address: input.mint, role: AccountRole.WRITABLE },
      { address: input.authority, role: AccountRole.READONLY_SIGNER },
    ],
    programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    data,
  };
};
