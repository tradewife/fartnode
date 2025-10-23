import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider, setProvider } from '@coral-xyz/anchor';
import { expect } from 'chai';
import { CounterClient } from '../client/counter';
import type { Counter } from '../target/types/counter';

describe('counter', () => {
	const provider = AnchorProvider.env();
	setProvider(provider);

	const program = anchor.workspace.Counter as Program<Counter>;
	let client: CounterClient;
	let authority: anchor.web3.Keypair;

	before(() => {
		client = new CounterClient(program, provider);
		authority = anchor.web3.Keypair.generate();
	});

	beforeEach(async () => {
		const airdropSig = await provider.connection.requestAirdrop(
			authority.publicKey,
			2 * anchor.web3.LAMPORTS_PER_SOL,
		);
		await provider.connection.confirmTransaction(airdropSig);
	});

	it('simulates initialization before executing', async () => {
		await client.simulateInitialize(authority, 0);
		
		const tx = await client.initialize(authority, 0);
		expect(tx).to.be.a('string');
	});

	it('initializes counter with zero', async () => {
		await client.initialize(authority, 0);

		const counter = await client.getCounter(authority.publicKey);
		expect(counter).to.not.be.null;
		expect(counter!.count.toNumber()).to.equal(0);
		expect(counter!.authority.toBase58()).to.equal(
			authority.publicKey.toBase58(),
		);
	});

	it('initializes counter with custom value', async () => {
		const customAuthority = anchor.web3.Keypair.generate();
		const airdropSig = await provider.connection.requestAirdrop(
			customAuthority.publicKey,
			2 * anchor.web3.LAMPORTS_PER_SOL,
		);
		await provider.connection.confirmTransaction(airdropSig);

		await client.initialize(customAuthority, 42);

		const counter = await client.getCounter(customAuthority.publicKey);
		expect(counter!.count.toNumber()).to.equal(42);
	});

	it('increments counter', async () => {
		await client.initialize(authority, 5);

		await client.increment(authority);

		const counter = await client.getCounter(authority.publicKey);
		expect(counter!.count.toNumber()).to.equal(6);
	});

	it('decrements counter', async () => {
		await client.initialize(authority, 10);

		await client.decrement(authority);

		const counter = await client.getCounter(authority.publicKey);
		expect(counter!.count.toNumber()).to.equal(9);
	});

	it('resets counter to zero', async () => {
		await client.initialize(authority, 99);

		await client.reset(authority);

		const counter = await client.getCounter(authority.publicKey);
		expect(counter!.count.toNumber()).to.equal(0);
	});

	it('prevents overflow', async () => {
		const MAX_U64 = new anchor.BN('18446744073709551615');
		
		await client.initialize(authority, MAX_U64.toNumber());

		try {
			await client.increment(authority);
			expect.fail('Should have thrown overflow error');
		} catch (error: any) {
			expect(error.message).to.include('Overflow');
		}
	});

	it('prevents underflow', async () => {
		await client.initialize(authority, 0);

		try {
			await client.decrement(authority);
			expect.fail('Should have thrown underflow error');
		} catch (error: any) {
			expect(error.message).to.include('Underflow');
		}
	});

	it('prevents unauthorized updates', async () => {
		const wrongAuthority = anchor.web3.Keypair.generate();
		const airdropSig = await provider.connection.requestAirdrop(
			wrongAuthority.publicKey,
			2 * anchor.web3.LAMPORTS_PER_SOL,
		);
		await provider.connection.confirmTransaction(airdropSig);

		await client.initialize(authority, 10);

		try {
			await client.increment(wrongAuthority);
			expect.fail('Should have thrown unauthorized error');
		} catch (error: any) {
			expect(error.message).to.include('Unauthorized');
		}
	});

	it('uses PDA correctly', async () => {
		const [expectedPda, expectedBump] = client.getCounterAddress(
			authority.publicKey,
		);

		await client.initialize(authority, 0);

		const counter = await client.getCounter(authority.publicKey);
		expect(counter!.bump).to.equal(expectedBump);

		const accountInfo = await provider.connection.getAccountInfo(expectedPda);
		expect(accountInfo).to.not.be.null;
		expect(accountInfo!.owner.toBase58()).to.equal(
			program.programId.toBase58(),
		);
	});
});
