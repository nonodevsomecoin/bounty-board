'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

type VotesMap = Record<string, number>; // bounty id -> -1 | 0 | 1

const VotesContext = createContext<{
  votes: VotesMap;
  setVote: (id: string, v: number) => void;
}>({ votes: {}, setVote: () => {} });

export function useVotes() {
  return useContext(VotesContext);
}

// On wallet connect, fetches the user's current vote for every visible bounty
// in one request, so each row can highlight the right arrow.
export function VotesProvider({
  ids,
  children,
}: {
  ids: string[];
  children: React.ReactNode;
}) {
  const { publicKey } = useWallet();
  const [votes, setVotes] = useState<VotesMap>({});
  const key = ids.join(',');

  useEffect(() => {
    if (!publicKey || ids.length === 0) {
      setVotes({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/my-votes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ wallet: publicKey.toBase58(), ids }),
        });
        const data = await res.json();
        if (!cancelled && data.ok) setVotes(data.data.votes ?? {});
      } catch {
        /* ignore — arrows just won't be pre-highlighted */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, key]);

  const setVote = useCallback(
    (id: string, v: number) => setVotes((prev) => ({ ...prev, [id]: v })),
    [],
  );

  return (
    <VotesContext.Provider value={{ votes, setVote }}>
      {children}
    </VotesContext.Provider>
  );
}
