import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

interface ParsedTokenAccounts {
  value: Array<{
    account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } };
  }>;
}

// Pure, testable: sum uiAmount across a wallet's token accounts.
export function sumTokenUiAmount(parsed: ParsedTokenAccounts): number {
  return parsed.value.reduce((acc, a) => {
    const ui = a.account.data.parsed.info.tokenAmount.uiAmount;
    return acc + (ui ?? 0);
  }, 0);
}

// Network call: fetch the wallet's token accounts for the mint and sum them.
export async function getTokenBalance(
  rpcUrl: string,
  wallet: string,
  mint: string,
): Promise<number> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const owner = new PublicKey(wallet);
  const res = await connection.getParsedTokenAccountsByOwner(owner, {
    mint: new PublicKey(mint),
    programId: TOKEN_PROGRAM_ID,
  });
  return sumTokenUiAmount(res as unknown as ParsedTokenAccounts);
}
