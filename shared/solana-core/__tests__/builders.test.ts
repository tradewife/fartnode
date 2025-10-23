import { describe, it, expect } from 'vitest';
import { Keypair, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
	buildVersionedTransaction,
	serializeTransaction,
	deserializeTransaction,
} from '../src/builders';

describe('builders', () => {
	it('buildVersionedTransaction should create VersionedTransaction', async () => {
		const payer = Keypair.generate();
		const recipient = Keypair.generate();

		const ix = SystemProgram.transfer({
			fromPubkey: payer.publicKey,
			toPubkey: recipient.publicKey,
			lamports: 0.1 * LAMPORTS_PER_SOL,
		});

		const tx = await buildVersionedTransaction({
			payer: payer.publicKey,
			blockhash: '11111111111111111111111111111111',
			instructions: [ix],
		});

		expect(tx).toBeDefined();
		expect(tx.version).toBe(0);
		expect(tx.message).toBeDefined();
	});

	it('buildVersionedTransaction should include compute budget instructions', async () => {
		const payer = Keypair.generate();
		const ix = SystemProgram.transfer({
			fromPubkey: payer.publicKey,
			toPubkey: payer.publicKey,
			lamports: 0,
		});

		const tx = await buildVersionedTransaction({
			payer: payer.publicKey,
			blockhash: '11111111111111111111111111111111',
			instructions: [ix],
			computeBudget: {
				units: 150000,
				microLamports: 8000,
			},
		});

		expect(tx).toBeDefined();
		expect(tx.message.compiledInstructions.length).toBeGreaterThan(1);
	});

	it('serializeTransaction should return base64 string', async () => {
		const payer = Keypair.generate();
		const ix = SystemProgram.transfer({
			fromPubkey: payer.publicKey,
			toPubkey: payer.publicKey,
			lamports: 0,
		});

		const tx = await buildVersionedTransaction({
			payer: payer.publicKey,
			blockhash: '11111111111111111111111111111111',
			instructions: [ix],
		});

		const serialized = serializeTransaction(tx);

		expect(typeof serialized).toBe('string');
		expect(serialized.length).toBeGreaterThan(0);
	});

	it('deserializeTransaction should reconstruct transaction', async () => {
		const payer = Keypair.generate();
		const ix = SystemProgram.transfer({
			fromPubkey: payer.publicKey,
			toPubkey: payer.publicKey,
			lamports: 0,
		});

		const tx = await buildVersionedTransaction({
			payer: payer.publicKey,
			blockhash: '11111111111111111111111111111111',
			instructions: [ix],
		});

		const serialized = serializeTransaction(tx);
		const deserialized = deserializeTransaction(serialized);

		expect(deserialized).toBeDefined();
		expect(deserialized.version).toBe(0);
		expect(deserialized.message).toBeDefined();
	});
});
