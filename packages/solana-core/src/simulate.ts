import type {
	Connection,
	VersionedTransaction,
} from '@solana/web3.js';
import type { SimulationResult } from './types.js';

export async function simulateTransaction(
	connection: Connection,
	transaction: VersionedTransaction,
): Promise<SimulationResult> {
	try {
		const simulation =
			await connection.simulateTransaction(transaction, {
				sigVerify: false,
			});

		if (simulation.value.err) {
			return {
				success: false,
				error: JSON.stringify(simulation.value.err),
				logs: simulation.value.logs || undefined,
				unitsConsumed: simulation.value.unitsConsumed || undefined,
			};
		}

		return {
			success: true,
			logs: simulation.value.logs || undefined,
			unitsConsumed: simulation.value.unitsConsumed || undefined,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

export async function simulateFirst(
	connection: Connection,
	transaction: VersionedTransaction,
): Promise<SimulationResult> {
	return simulateTransaction(connection, transaction);
}
