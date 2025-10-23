import { describe, it, expect } from 'vitest';
import {
	createComputeBudgetInstructions,
	estimateComputeUnits,
	DEFAULT_COMPUTE_UNIT_LIMIT,
	DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS,
} from '../src/compute';

describe('compute', () => {
	it('createComputeBudgetInstructions should return two instructions', () => {
		const ixs = createComputeBudgetInstructions();
		expect(ixs).toHaveLength(2);
		expect(ixs[0]).toBeDefined();
		expect(ixs[1]).toBeDefined();
	});

	it('createComputeBudgetInstructions should use custom config', () => {
		const customConfig = {
			units: 300000,
			microLamports: 10000,
		};
		const ixs = createComputeBudgetInstructions(customConfig);
		expect(ixs).toHaveLength(2);
	});

	it('estimateComputeUnits should calculate based on instruction count', () => {
		const instructionCount = 5;
		const estimate = estimateComputeUnits(instructionCount);

		expect(estimate).toBeGreaterThan(0);
		expect(estimate).toBe(5000 + instructionCount * 10_000);
	});

	it('DEFAULT_COMPUTE_UNIT_LIMIT should be positive', () => {
		expect(DEFAULT_COMPUTE_UNIT_LIMIT).toBeGreaterThan(0);
	});

	it('DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS should be positive', () => {
		expect(DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS).toBeGreaterThan(0);
	});
});
