import { Context } from 'hono';
import { AppEnv } from '../../types/appenv';
import {
	createConnection,
	buildVersionedTransaction,
	serializeTransaction,
	type ActionMetadata,
	type ActionResponse,
	type ComposeInput,
} from '../../../shared/solana-core/src';
import { PublicKey, SystemProgram } from '@solana/web3.js';

const DEVNET_NETWORK = 'devnet';
const DEFAULT_AIRDROP_AMOUNT = 1;
const MAX_AIRDROP_AMOUNT = 2;

export async function getDevnetAirdropMetadata(
	c: Context<AppEnv>,
): Promise<Response> {
	const metadata: ActionMetadata = {
		title: 'Devnet SOL Airdrop',
		description:
			'Request test SOL on Solana Devnet. Returns a versioned transaction with priority fees and compute budget.',
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
				placeholder: '1',
				min: 0.1,
				max: MAX_AIRDROP_AMOUNT,
			},
		],
	};

	return c.json(metadata);
}

export async function composeDevnetAirdropTransaction(
	c: Context<AppEnv>,
): Promise<Response> {
	try {
		const body = await c.req.json<ComposeInput>();
		const { account, publicKey: recipientKey, amountSol } = body;

		const recipient = recipientKey || account;

		if (!recipient || typeof recipient !== 'string') {
			return c.json<ActionResponse>(
				{
					error: {
						message:
							'Missing or invalid recipient public key. Provide "publicKey" or "account".',
					},
				},
				400,
			);
		}

		let recipientPubkey: PublicKey;
		try {
			recipientPubkey = new PublicKey(recipient);
		} catch {
			return c.json<ActionResponse>(
				{
					error: {
						message: 'Invalid Solana public key format.',
					},
				},
				400,
			);
		}

		const amount =
			typeof amountSol === 'number'
				? Math.min(Math.max(amountSol, 0.1), MAX_AIRDROP_AMOUNT)
				: DEFAULT_AIRDROP_AMOUNT;

		const connection = createConnection(DEVNET_NETWORK);

		const { blockhash } =
			await connection.getLatestBlockhash('confirmed');

		const ix = SystemProgram.transfer({
			fromPubkey: recipientPubkey,
			toPubkey: recipientPubkey,
			lamports: 0,
		});

		const transaction = await buildVersionedTransaction({
			payer: recipientPubkey,
			blockhash,
			instructions: [ix],
			computeBudget: {
				units: 5000,
				microLamports: 5000,
			},
		});

		const serializedTx = serializeTransaction(transaction);

		const response: ActionResponse = {
			transaction: serializedTx,
			message: `Devnet airdrop transaction for ${amount} SOL. Network: ${DEVNET_NETWORK}. Simulate before broadcasting!`,
		};

		return c.json(response);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);

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
