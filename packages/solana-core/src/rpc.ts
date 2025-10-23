import { Connection, clusterApiUrl } from '@solana/web3.js';
import type { NetworkConfig, SolanaNetwork } from './types.js';

const DEFAULT_NETWORK: SolanaNetwork = 'devnet';

export function getNetworkConfig(
	network: SolanaNetwork = DEFAULT_NETWORK,
	customEndpoint?: string,
): NetworkConfig {
	const rpcEndpoint = customEndpoint || clusterApiUrl(network);
	return {
		network,
		rpcEndpoint,
	};
}

export function createConnection(
	network: SolanaNetwork = DEFAULT_NETWORK,
	customEndpoint?: string,
): Connection {
	const config = getNetworkConfig(network, customEndpoint);
	return new Connection(config.rpcEndpoint, 'confirmed');
}

export function getConnectionFromEnv(
	env?: Record<string, string | undefined>,
): Connection {
	const endpoint = env?.SOLANA_RPC_ENDPOINT;
	const network = (env?.SOLANA_NETWORK as SolanaNetwork) || DEFAULT_NETWORK;

	if (network === 'mainnet-beta' && !endpoint) {
		throw new Error(
			'Mainnet requires explicit RPC endpoint via SOLANA_RPC_ENDPOINT',
		);
	}

	return createConnection(network, endpoint);
}
