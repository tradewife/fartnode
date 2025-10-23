import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
	getDevnetAirdropMetadata,
	composeDevnetAirdropTransaction,
} from '../solanaController';
import type {
	ActionMetadata,
	ActionResponse,
} from '@fartnode/solana-core';
import type { AppEnv } from '../../../types/appenv';

const mockRequestAirdrop = vi.fn();
const mockConfirmTransaction = vi.fn();
const mockGetLatestBlockhash = vi.fn();
const mockBuildVersionedTransaction = vi.fn();
const mockSerializeTransaction = vi.fn();
const mockCreateConnection = vi.fn(() => ({
	requestAirdrop: mockRequestAirdrop,
	confirmTransaction: mockConfirmTransaction,
	getLatestBlockhash: mockGetLatestBlockhash,
}));

vi.mock('@fartnode/solana-core', () => ({
	createConnection: mockCreateConnection,
	buildVersionedTransaction: mockBuildVersionedTransaction,
	serializeTransaction: mockSerializeTransaction,
}));

function createMockEnv(): Env {
	const store = new Map<string, string>();
	const kv = {
		async get(key: string) {
			return store.has(key) ? store.get(key)! : null;
		},
		async put(
			key: string,
			value: string,
			_options?: { expirationTtl?: number },
		) {
			store.set(key, value);
		},
		async delete(key: string) {
			store.delete(key);
		},
		async list() {
			return { keys: [] };
		},
	};

	return {
		VibecoderStore: kv as unknown as KVNamespace,
	} as unknown as Env;
}

function createApp() {
	const app = new Hono<AppEnv>();
	app.get('/api/solana/actions/devnet-airdrop', getDevnetAirdropMetadata);
	app.post(
		'/api/solana/actions/devnet-airdrop',
		composeDevnetAirdropTransaction,
	);
	return app;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockRequestAirdrop.mockResolvedValue('mock-signature');
	mockConfirmTransaction.mockResolvedValue(null);
	mockGetLatestBlockhash.mockResolvedValue({
		blockhash: 'mock-blockhash',
		lastValidBlockHeight: 100,
	});
	mockBuildVersionedTransaction.mockResolvedValue({});
	mockSerializeTransaction.mockReturnValue('BASE64_TX');
});

// TODO: Re-enable once web3.js/borsh ESM interop is fixed for Vitest
describe.skip('solanaController', () => {
	it('returns action metadata', async () => {
		const env = createMockEnv();
		const app = createApp();

		const res = await app.request(
			'/api/solana/actions/devnet-airdrop',
			undefined,
			env,
		);

		expect(res.status).toBe(200);
		const data = await res.json<ActionMetadata>();
		expect(data.title).toBe('Devnet SOL Airdrop');
		expect(data.inputs).toHaveLength(2);
		expect(data.inputs[0]?.name).toBe('publicKey');
	});

	it('composes transaction for valid payload', async () => {
		const env = createMockEnv();
		const app = createApp();

		const amountSol = 1.5;
		const response = await app.request(
			'/api/solana/actions/devnet-airdrop',
			{
				method: 'POST',
				body: JSON.stringify({
					publicKey: '9we6kjtbcZ2vy3GSLLsZTEhbAqXPTRvEyoxa8wxSqKp5',
					amountSol,
				}),
				headers: {
					'Content-Type': 'application/json',
					'CF-Connecting-IP': '127.0.0.1',
				},
			},
			env,
		);

		expect(response.status).toBe(200);
		const payload = await response.json<ActionResponse>();
		expect(payload.transaction).toBe('BASE64_TX');
		expect(payload.network).toBe('devnet');
		expect(payload.simulateFirst).toBe(true);

		expect(mockRequestAirdrop).toHaveBeenCalledWith(
			expect.any(Object),
			Math.round(amountSol * LAMPORTS_PER_SOL),
		);
		expect(mockBuildVersionedTransaction).toHaveBeenCalled();
	});

	it('rejects missing public key input', async () => {
		const env = createMockEnv();
		const app = createApp();

		const response = await app.request(
			'/api/solana/actions/devnet-airdrop',
			{
				method: 'POST',
				body: JSON.stringify({ amountSol: 1 }),
				headers: {
					'Content-Type': 'application/json',
					'CF-Connecting-IP': '127.0.0.1',
				},
			},
			env,
		);

		expect(response.status).toBe(400);
		const payload = await response.json<ActionResponse>();
		expect(payload.error?.message).toContain('Missing recipient');
	});

	it('uses idempotency cache on repeated key', async () => {
		const env = createMockEnv();
		const app = createApp();

		const headers = {
			'Content-Type': 'application/json',
			'CF-Connecting-IP': '127.0.0.1',
			'Idempotency-Key': 'repeat-key',
		};

		const body = {
			publicKey: '9we6kjtbcZ2vy3GSLLsZTEhbAqXPTRvEyoxa8wxSqKp5',
			amountSol: 1,
		};

		const first = await app.request(
			'/api/solana/actions/devnet-airdrop',
			{
				method: 'POST',
				body: JSON.stringify(body),
				headers,
			},
			env,
		);

		expect(first.status).toBe(200);
		expect(mockBuildVersionedTransaction).toHaveBeenCalledTimes(1);

		const second = await app.request(
			'/api/solana/actions/devnet-airdrop',
			{
				method: 'POST',
				body: JSON.stringify(body),
				headers,
			},
			env,
		);

		expect(second.status).toBe(200);
		expect(mockBuildVersionedTransaction).toHaveBeenCalledTimes(1);

		const payload = await second.json<ActionResponse>();
		expect(payload.transaction).toBe('BASE64_TX');
	});

	it('enforces rate limit per wallet', async () => {
		const env = createMockEnv();
		const app = createApp();

		const headers = {
			'Content-Type': 'application/json',
			'CF-Connecting-IP': '127.0.0.1',
		};

		const body = {
			publicKey: '9we6kjtbcZ2vy3GSLLsZTEhbAqXPTRvEyoxa8wxSqKp5',
			amountSol: 1,
		};

		for (let i = 0; i < 3; i += 1) {
			const res = await app.request(
				'/api/solana/actions/devnet-airdrop',
				{
					method: 'POST',
					body: JSON.stringify(body),
					headers,
				},
				env,
			);
			expect(res.status).toBe(200);
		}

		const blocked = await app.request(
			'/api/solana/actions/devnet-airdrop',
			{
				method: 'POST',
				body: JSON.stringify(body),
				headers,
			},
			env,
		);

		expect(blocked.status).toBe(429);
		const payload = await blocked.json<ActionResponse>();
		expect(payload.error?.message).toContain('Rate limit exceeded');
	});
});
