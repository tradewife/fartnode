import {
	ComputeBudgetProgram,
	type TransactionInstruction,
} from '@solana/web3.js';
import type { PriorityFeeConfig } from './types.js';

export const DEFAULT_PRIORITY_FEE_MICROLAMPORTS = 5000;

export function createPriorityFeeInstruction(
	config?: PriorityFeeConfig,
): TransactionInstruction {
	const microLamports = config?.microLamports || DEFAULT_PRIORITY_FEE_MICROLAMPORTS;
	return ComputeBudgetProgram.setComputeUnitPrice({
		microLamports,
	});
}

export function getPriorityFeeLamports(
	computeUnits: number,
	microLamports: number = DEFAULT_PRIORITY_FEE_MICROLAMPORTS,
): number {
	return Math.ceil((computeUnits * microLamports) / 1_000_000);
}
