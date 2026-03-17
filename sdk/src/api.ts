import { NETWORK_CONFIG, NetworkId, TokenConfig, getEnvConfig } from './config';

async function getEvmBalance(rpcUrl: string, address: string, token: TokenConfig): Promise<number> {
  try {
    const data = "0x70a08231000000000000000000000000" + address.replace("0x", "");
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ to: token.address, data }, "latest"],
      }),
    });
    const json = await res.json();
    if (json.result && json.result !== "0x") {
      return typeof BigInt !== "undefined"
        ? Number(BigInt(json.result)) / 10 ** token.decimals
        : parseInt(json.result, 16) / 10 ** token.decimals;
    }
  } catch (e) { console.warn("EVMBalance fetch error", e); }
  return 0;
}

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
  const { type } = NETWORK_CONFIG[networkId];
  const { rpcUrl, tokens } = getEnvConfig(networkId);

  const result: Record<string, number> = {};

  await Promise.all(
    Object.entries(tokens).map(async ([symbol, tokenCfg]) => {
      result[symbol] = type === "solana"
        ? await getSolanaBalance(address, tokenCfg, rpcUrl)
        : await getEvmBalance(rpcUrl, address, tokenCfg);
    })
  );

  return result;
}
