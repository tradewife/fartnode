import {
	PublicKey,
	TransactionMessage,
	VersionedTransaction,
	type TransactionInstruction,
	type AddressLookupTableAccount,
} from '@solana/web3.js';
import { createComputeBudgetInstructions } from './compute.js';
import {
	createPriorityFeeInstruction,
} from './fees.js';
import type { TransactionBuilderOptions } from './types.js';

export async function buildVersionedTransaction(
	options: TransactionBuilderOptions,
): Promise<VersionedTransaction> {
	const {
		payer,
		blockhash,
		instructions,
		lookupTables = [],
		computeBudget,
		priorityFee,
	} = options;

	const payerKey =
		typeof payer === 'string' ? new PublicKey(payer) : payer;

	const priorityInstruction = createPriorityFeeInstruction(
		priorityFee ??
			(computeBudget?.microLamports !== undefined
				? { microLamports: computeBudget.microLamports }
				: undefined),
	);

	const computeIxs = createComputeBudgetInstructions(computeBudget);

	const allInstructions = [
		priorityInstruction,
		...computeIxs,
		...(instructions as TransactionInstruction[]),
	];

	const messageV0 = new TransactionMessage({
		payerKey,
		recentBlockhash: blockhash,
		instructions: allInstructions,
	}).compileToV0Message(lookupTables as AddressLookupTableAccount[]);

	return new VersionedTransaction(messageV0);
}

export function serializeTransaction(
	transaction: VersionedTransaction,
): string {
	return Buffer.from(transaction.serialize()).toString('base64');
}

export function deserializeTransaction(
	base64Transaction: string,
): VersionedTransaction {
	const buffer = Buffer.from(base64Transaction, 'base64');
	return VersionedTransaction.deserialize(buffer);
}
