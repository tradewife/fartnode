import { describe, it, expect } from 'vitest';
import {
	createPriorityFeeInstruction,
	getPriorityFeeLamports,
	DEFAULT_PRIORITY_FEE_MICROLAMPORTS,
} from '../src/fees';

describe('fees', () => {
	it('createPriorityFeeInstruction should return ComputeBudgetProgram instruction', () => {
		const ix = createPriorityFeeInstruction();
		expect(ix).toBeDefined();
		expect(ix.programId).toBeDefined();
		expect(ix.keys).toBeDefined();
		expect(ix.data).toBeDefined();
	});

	it('createPriorityFeeInstruction should use custom microLamports', () => {
		const customFee = 10000;
		const ix = createPriorityFeeInstruction({ microLamports: customFee });
		expect(ix).toBeDefined();
	});

	it('getPriorityFeeLamports should calculate fee correctly', () => {
		const computeUnits = 200000;
		const microLamports = 5000;
		const feeLamports = getPriorityFeeLamports(computeUnits, microLamports);

		const expected = Math.ceil((computeUnits * microLamports) / 1_000_000);
		expect(feeLamports).toBe(expected);
	});

	it('getPriorityFeeLamports should use default microLamports', () => {
		const computeUnits = 100000;
		const feeLamports = getPriorityFeeLamports(computeUnits);

		const expected = Math.ceil(
			(computeUnits * DEFAULT_PRIORITY_FEE_MICROLAMPORTS) / 1_000_000,
		);
		expect(feeLamports).toBe(expected);
	});
});
