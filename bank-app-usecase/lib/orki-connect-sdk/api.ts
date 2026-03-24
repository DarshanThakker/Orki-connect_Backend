import { NETWORK_CONFIG, NetworkId, TokenConfig, getEnvConfig } from './config';

async function getSolanaBalance(address: string, token: TokenConfig, rpcUrl: string): Promise<number> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
        params: [address, { mint: token.address }, { encoding: "jsonParsed" }],
      }),
    });
    const json = await res.json();
    if (json.result?.value?.length > 0) {
      return json.result.value[0].account.data.parsed.info.tokenAmount.uiAmount ?? 0;
    }
  } catch (e) { console.warn("SolanaBalance fetch error", e); }
  return 0;
}

/**
 * Returns a map of token symbol → balance for the given network and address.
 * The active environment (mainnet / testnet) is read from config — set it
 * once at startup via setEnvironment().
 */
export async function fetchBalances(
  networkId: NetworkId,
  address: string
): Promise<Record<string, number>> {
  const { rpcUrl, tokens } = getEnvConfig(networkId);

  const result: Record<string, number> = {};

  await Promise.all(
    Object.entries(tokens).map(async ([symbol, tokenCfg]) => {
      result[symbol] = await getSolanaBalance(address, tokenCfg, rpcUrl);
    })
  );

  return result;
}
