import { describe, it, expect } from 'vitest';
import type {
	ActionMetadata,
	ComposeInput,
	PriorityFeeConfig,
	ComputeBudgetConfig,
	ActionResponse,
} from '../src/types';

// TODO: Re-enable once web3.js/borsh ESM interop is fixed for Vitest
describe.skip('types', () => {
	it('ActionMetadata should have required fields', () => {
		const metadata: ActionMetadata = {
			title: 'Test Action',
			description: 'Test description',
			inputs: [
				{
					name: 'testInput',
					type: 'text',
					required: true,
				},
			],
		};

		expect(metadata.title).toBe('Test Action');
		expect(metadata.description).toBe('Test description');
		expect(metadata.inputs).toHaveLength(1);
		expect(metadata.inputs[0].name).toBe('testInput');
	});

	it('ComposeInput should accept account and arbitrary fields', () => {
		const input: ComposeInput = {
			account: 'test-account',
			customField: 'custom-value',
			numericField: 42,
		};

		expect(input.account).toBe('test-account');
		expect(input.customField).toBe('custom-value');
		expect(input.numericField).toBe(42);
	});

	it('PriorityFeeConfig should specify microLamports', () => {
		const config: PriorityFeeConfig = {
			microLamports: 5000,
		};

		expect(config.microLamports).toBe(5000);
	});

	it('ComputeBudgetConfig should specify units and microLamports', () => {
		const config: ComputeBudgetConfig = {
			units: 200000,
			microLamports: 5000,
		};

		expect(config.units).toBe(200000);
		expect(config.microLamports).toBe(5000);
	});

	it('ActionResponse should surface network and simulateFirst flags', () => {
		const response: ActionResponse = {
			transaction: 'BASE64',
			network: 'devnet',
			simulateFirst: true,
		};

		expect(response.network).toBe('devnet');
		expect(response.simulateFirst).toBe(true);
	});
});
