import { Context } from 'hono';
import {
	LAMPORTS_PER_SOL,
	PublicKey,
	SystemProgram,
} from '@solana/web3.js';
import {
	createConnection,
	buildVersionedTransaction,
	serializeTransaction,
	type ActionMetadata,
	type ActionResponse,
	type ComposeInput,
} from '@fartnode/solana-core';
import { createLogger } from '../../logger';
import type { AppEnv } from '../../types/appenv';

const DEVNET_NETWORK = 'devnet';
const MIN_AIRDROP_AMOUNT = 0.1;
const DEFAULT_AIRDROP_AMOUNT = 1;
const MAX_AIRDROP_AMOUNT = 2;
const COMPUTE_UNIT_LIMIT = 120_000;

const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const IDEMPOTENCY_TTL_SECONDS = 600;
const RATE_LIMIT_PREFIX = 'solana:actions:devnet-airdrop:rate-limit';
const IDEMPOTENCY_PREFIX = 'solana:actions:devnet-airdrop:idempotency';

const solanaLogger = createLogger('SolanaDevnetAirdrop');

interface CachedActionResponse {
	response: ActionResponse;
	recipient: string;
}

function truncateKey(key: string): string {
	if (key.length <= 8) {
		return key;
	}
	return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function buildIdempotencyStorageKey(idempotencyKey: string): string {
	return `${IDEMPOTENCY_PREFIX}:${idempotencyKey}`;
}

async function getCachedResponse(
	env: Env,
	storageKey: string,
): Promise<CachedActionResponse | null> {
	try {
		const cached = await env.VibecoderStore.get(storageKey);
		if (!cached) {
			return null;
		}
		const parsed = JSON.parse(cached) as CachedActionResponse;
		return parsed;
	} catch (error) {
		solanaLogger.warn('idempotency-cache-read-failed', {
			storageKey: truncateKey(storageKey),
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

async function cacheResponse(
	env: Env,
	storageKey: string,
	payload: CachedActionResponse,
): Promise<void> {
	try {
		await env.VibecoderStore.put(storageKey, JSON.stringify(payload), {
			expirationTtl: IDEMPOTENCY_TTL_SECONDS,
		});
	} catch (error) {
		solanaLogger.warn('idempotency-cache-write-failed', {
			storageKey: truncateKey(storageKey),
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

async function incrementRateLimit(
	env: Env,
	identifier: string,
): Promise<boolean> {
	const storageKey = `${RATE_LIMIT_PREFIX}:${identifier}`;

	try {
		const current = await env.VibecoderStore.get(storageKey);
		const count = current ? Number.parseInt(current, 10) : 0;

		if (Number.isNaN(count)) {
			await env.VibecoderStore.delete(storageKey);
			return true;
		}

		if (count >= RATE_LIMIT_MAX_REQUESTS) {
			return false;
		}

		await env.VibecoderStore.put(storageKey, String(count + 1), {
			expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
		});

		return true;
	} catch (error) {
		solanaLogger.error('rate-limit-check-failed', {
			identifier,
			error: error instanceof Error ? error.message : String(error),
		});
		return true; // fail open on storage errors
	}
}

function extractClientIp(c: Context<AppEnv>): string {
	return (
		c.req.header('cf-connecting-ip') ||
		c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
		'unknown'
	);
}

function extractIdempotencyKey(c: Context<AppEnv>): string | undefined {
	return c.req.header('idempotency-key')?.trim() || undefined;
}

function parseAmount(input: unknown): number | null {
	if (typeof input === 'number') {
		return input;
	}

	if (typeof input === 'string' && input.trim().length > 0) {
		const parsed = Number.parseFloat(input);
		return Number.isNaN(parsed) ? null : parsed;
	}

	return null;
}

function buildResponseHeaders(
	idempotencyKey?: string,
): Record<string, string> | undefined {
	if (!idempotencyKey) {
		return undefined;
	}
	return {
		'Idempotency-Key': idempotencyKey,
		'Cache-Control': 'no-store',
	};
}

export async function getDevnetAirdropMetadata(
	c: Context<AppEnv>,
): Promise<Response> {
	const metadata: ActionMetadata = {
		title: 'Devnet SOL Airdrop',
		description:
			'Request test SOL on Solana Devnet. Returns a versioned transaction with compute budget and priority fees preconfigured.',
		icon: 'https://solana.com/src/img/branding/solanaLogoMark.svg',
		inputs: [
			{
				name: 'publicKey',
				type: 'text',
				label: 'Recipient Public Key',
				required: true,
				placeholder: 'Enter Solana public key',
				pattern: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
			},
			{
				name: 'amountSol',
				type: 'number',
				label: 'Amount (SOL)',
				required: false,
				placeholder: String(DEFAULT_AIRDROP_AMOUNT),
				min: MIN_AIRDROP_AMOUNT,
				max: MAX_AIRDROP_AMOUNT,
			},
		],
		links: {
			actions: [
				{
					label: 'Learn about Devnet airdrops',
					href: 'https://solana.com/cookbook/development/test-sol?utm_source=llms&utm_medium=ai&utm_campaign=txt',
				},
			],
		},
	};

	return c.json(metadata, 200, {
		'Cache-Control': 'no-store',
	});
}

export async function composeDevnetAirdropTransaction(
	c: Context<AppEnv>,
): Promise<Response> {
	try {
		const idempotencyKey = extractIdempotencyKey(c);
		let idempotencyStorageKey: string | undefined;
		if (idempotencyKey) {
			idempotencyStorageKey =
				buildIdempotencyStorageKey(idempotencyKey);
			const cached = await getCachedResponse(
				c.env,
				idempotencyStorageKey,
			);
			if (cached) {
				solanaLogger.info('idempotency-hit', {
					idempotencyKey: truncateKey(idempotencyKey),
					recipient: cached.recipient,
				});
				const headers = buildResponseHeaders(idempotencyKey);
				return headers
					? c.json(cached.response, 200, headers)
					: c.json(cached.response);
			}
		}

		const body = await c.req.json<ComposeInput>();
		const { account, publicKey: providedKey, amountSol } = body;
		const recipientValue = providedKey || account;

		if (!recipientValue || typeof recipientValue !== 'string') {
			solanaLogger.warn('missing-recipient', {
				idempotencyKey: idempotencyKey
					? truncateKey(idempotencyKey)
					: undefined,
			});
			return c.json<ActionResponse>(
				{
					error: {
						message:
							'Missing recipient public key. Provide "publicKey" or "account".',
					},
				},
				400,
			);
		}

		let recipient: PublicKey;
		try {
			recipient = new PublicKey(recipientValue);
		} catch (error) {
			solanaLogger.warn('invalid-public-key', {
				recipient: recipientValue,
				error: error instanceof Error ? error.message : String(error),
			});
			return c.json<ActionResponse>(
				{
					error: {
						message: 'Invalid Solana public key format.',
					},
				},
				400,
			);
		}

		const parsedAmount = parseAmount(amountSol);
		if (parsedAmount !== null && Number.isNaN(parsedAmount)) {
			return c.json<ActionResponse>(
				{
					error: {
						message:
							'Invalid amount. Provide a numeric value in SOL.',
					},
				},
				400,
			);
		}

		const normalizedAmount =
			parsedAmount !== null
				? Math.min(
						Math.max(parsedAmount, MIN_AIRDROP_AMOUNT),
						MAX_AIRDROP_AMOUNT,
					)
				: DEFAULT_AIRDROP_AMOUNT;

		const rateLimitIdentifier = `${extractClientIp(c)}:${recipient.toBase58()}`;
		const allowed = await incrementRateLimit(c.env, rateLimitIdentifier);
		if (!allowed) {
			return c.json<ActionResponse>(
				{
					error: {
						message:
							'Rate limit exceeded for devnet airdrop. Please retry in 60 seconds.',
					},
				},
				429,
			);
		}

		const lamports = Math.round(normalizedAmount * LAMPORTS_PER_SOL);
		const rpcEndpoint = (
			c.env as { SOLANA_RPC_ENDPOINT?: string }
		).SOLANA_RPC_ENDPOINT;
		const connection = rpcEndpoint
			? createConnection(DEVNET_NETWORK, rpcEndpoint)
			: createConnection(DEVNET_NETWORK);
		const recipientBase58 = recipient.toBase58();

		solanaLogger.info('airdrop-request-start', {
			recipient: recipientBase58,
			amountSol: normalizedAmount,
			lamports,
			idempotencyKey: idempotencyKey
				? truncateKey(idempotencyKey)
				: undefined,
		});

		let airdropConfirmed = false;
		let airdropSignature: string | null = null;
		try {
			airdropSignature = await connection.requestAirdrop(
				recipient,
				lamports,
			);
			solanaLogger.info('airdrop-requested', {
				recipient: recipientBase58,
				signature: airdropSignature,
			});
			try {
				await connection.confirmTransaction(
					airdropSignature,
					'confirmed',
				);
				airdropConfirmed = true;
			} catch (confirmError) {
				solanaLogger.warn('airdrop-confirmation-failed', {
					recipient: recipientBase58,
					signature: airdropSignature,
					error:
						confirmError instanceof Error
							? confirmError.message
							: String(confirmError),
				});
			}
		} catch (airdropError) {
			solanaLogger.warn('airdrop-request-failed', {
				recipient: recipientBase58,
				error:
					airdropError instanceof Error
						? airdropError.message
						: String(airdropError),
			});
		}

		const { blockhash } =
			await connection.getLatestBlockhash('confirmed');

		const transferInstruction = SystemProgram.transfer({
			fromPubkey: recipient,
			toPubkey: recipient,
			lamports: 0,
		});

		const transaction = await buildVersionedTransaction({
			payer: recipient,
			blockhash,
			instructions: [transferInstruction],
			computeBudget: {
				units: COMPUTE_UNIT_LIMIT,
			},
		});

		const serializedTx = serializeTransaction(transaction);

		const response: ActionResponse = {
			transaction: serializedTx,
			network: DEVNET_NETWORK,
			simulateFirst: true,
			message: airdropConfirmed
				? `Devnet airdrop of ${normalizedAmount} SOL prepared. Simulate before broadcasting.`
				: `Transaction prepared. Devnet airdrop request is pending confirmation; simulate before broadcasting.`,
		};

		if (idempotencyStorageKey) {
			await cacheResponse(c.env, idempotencyStorageKey, {
				response,
				recipient: recipientBase58,
			});
		}

		solanaLogger.info('airdrop-compose-success', {
			recipient: recipientBase58,
			airdropConfirmed,
			idempotencyKey: idempotencyKey
				? truncateKey(idempotencyKey)
				: undefined,
		});

		const headers = buildResponseHeaders(idempotencyKey);
		return headers ? c.json(response, 200, headers) : c.json(response);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);

		solanaLogger.error('airdrop-compose-failed', {
			error: errorMessage,
		});

		return c.json<ActionResponse>(
			{
				error: {
					message: `Failed to compose transaction: ${errorMessage}`,
				},
			},
			500,
		);
	}
}
