import type { PublicKey } from '@solana/web3.js';

export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'testnet';

export interface NetworkConfig {
	network: SolanaNetwork;
	rpcEndpoint: string;
}

export interface ActionMetadata {
	title: string;
	description: string;
	icon?: string;
	inputs: ActionInput[];
	links?: {
		actions: ActionLink[];
	};
}

export interface ActionInput {
	name: string;
	type: 'text' | 'email' | 'url' | 'number' | 'date' | 'datetime' | 'time';
	label?: string;
	required?: boolean;
	placeholder?: string;
	min?: number | string;
	max?: number | string;
	pattern?: string;
	options?: ActionInputOption[];
}

export interface ActionInputOption {
	label: string;
	value: string;
	selected?: boolean;
}

export interface ActionLink {
	label: string;
	href: string;
	parameters?: ActionParameter[];
}

export interface ActionParameter {
	name: string;
	label?: string;
	required?: boolean;
}

export interface ComposeInput {
	account: string;
	[key: string]: unknown;
}

export interface ComposeResult {
	transaction: string;
	message?: string;
}

export interface PriorityFeeConfig {
	microLamports: number;
}

export interface ComputeBudgetConfig {
	units: number;
	microLamports: number;
}

export interface TransactionBuilderOptions {
	payer: PublicKey | string;
	blockhash: string;
	instructions: unknown[];
	lookupTables?: unknown[];
	priorityFee?: PriorityFeeConfig;
	computeBudget?: ComputeBudgetConfig;
}

export interface SimulationResult {
	success: boolean;
	error?: string;
	logs?: string[];
	unitsConsumed?: number;
}

export interface ActionError {
	message: string;
}

export interface ActionResponse {
	transaction?: string;
	message?: string;
	error?: ActionError;
}
