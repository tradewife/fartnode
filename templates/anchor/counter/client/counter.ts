import * as anchor from '@coral-xyz/anchor';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import type { Counter as CounterProgram } from '../target/types/counter';

export class CounterClient {
	constructor(
		public program: Program<CounterProgram>,
		public provider: AnchorProvider,
	) {}

	static async create(
		programId: PublicKey,
		provider: AnchorProvider,
	): Promise<CounterClient> {
		const idl = await Program.fetchIdl(programId, provider);
		if (!idl) {
			throw new Error('IDL not found');
		}
		const program = new Program(idl as CounterProgram, provider);
		return new CounterClient(program, provider);
	}

	getCounterAddress(authority: PublicKey): [PublicKey, number] {
		return PublicKey.findProgramAddressSync(
			[Buffer.from('counter'), authority.toBuffer()],
			this.program.programId,
		);
	}

	async initialize(
		authority: anchor.web3.Keypair,
		initialCount: number = 0,
	): Promise<string> {
		const [counterPda] = this.getCounterAddress(authority.publicKey);

		const tx = await this.program.methods
			.initialize(new anchor.BN(initialCount))
			.accountsPartial({
				counter: counterPda,
				authority: authority.publicKey,
				systemProgram: SystemProgram.programId,
			})
			.signers([authority])
			.rpc();

		return tx;
	}

	async increment(authority: anchor.web3.Keypair): Promise<string> {
		const [counterPda] = this.getCounterAddress(authority.publicKey);

		const tx = await this.program.methods
			.increment()
			.accountsPartial({
				counter: counterPda,
				authority: authority.publicKey,
			})
			.signers([authority])
			.rpc();

		return tx;
	}

	async decrement(authority: anchor.web3.Keypair): Promise<string> {
		const [counterPda] = this.getCounterAddress(authority.publicKey);

		const tx = await this.program.methods
			.decrement()
			.accountsPartial({
				counter: counterPda,
				authority: authority.publicKey,
			})
			.signers([authority])
			.rpc();

		return tx;
	}

	async reset(authority: anchor.web3.Keypair): Promise<string> {
		const [counterPda] = this.getCounterAddress(authority.publicKey);

		const tx = await this.program.methods
			.reset()
			.accountsPartial({
				counter: counterPda,
				authority: authority.publicKey,
			})
			.signers([authority])
			.rpc();

		return tx;
	}

	async getCounter(authority: PublicKey): Promise<{
		authority: PublicKey;
		count: anchor.BN;
		bump: number;
	} | null> {
		const [counterPda] = this.getCounterAddress(authority);

		try {
			const account = await this.program.account.counter.fetch(counterPda);
			return account;
		} catch {
			return null;
		}
	}

	async simulateInitialize(
		authority: anchor.web3.Keypair,
		initialCount: number = 0,
	): Promise<void> {
		const [counterPda] = this.getCounterAddress(authority.publicKey);

		await this.program.methods
			.initialize(new anchor.BN(initialCount))
			.accountsPartial({
				counter: counterPda,
				authority: authority.publicKey,
				systemProgram: SystemProgram.programId,
			})
			.signers([authority])
			.simulate();
	}

	async simulateIncrement(authority: anchor.web3.Keypair): Promise<void> {
		const [counterPda] = this.getCounterAddress(authority.publicKey);

		await this.program.methods
			.increment()
			.accountsPartial({
				counter: counterPda,
				authority: authority.publicKey,
			})
			.signers([authority])
			.simulate();
	}
}
