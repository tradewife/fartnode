import {
	ComputeBudgetProgram,
	type TransactionInstruction,
} from '@solana/web3.js';
import type { ComputeBudgetConfig } from './types.js';

export const DEFAULT_COMPUTE_UNIT_LIMIT = 200_000;
export const DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS = 5000;

export function createComputeBudgetInstructions(
	config?: ComputeBudgetConfig,
): TransactionInstruction[] {
	const units = config?.units || DEFAULT_COMPUTE_UNIT_LIMIT;
	const microLamports = config?.microLamports || DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS;

	return [
		ComputeBudgetProgram.setComputeUnitLimit({ units }),
		ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
	];
}

export function estimateComputeUnits(instructionCount: number): number {
	const baseUnits = 5000;
	const perInstructionUnits = 10_000;
	return baseUnits + instructionCount * perInstructionUnits;
}
