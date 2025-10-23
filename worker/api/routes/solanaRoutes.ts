import { Hono } from 'hono';
import { AppEnv } from '../../types/appenv';
import { AuthConfig, setAuthLevel } from '../../middleware/auth/routeAuth';
import {
	getDevnetAirdropMetadata,
	composeDevnetAirdropTransaction,
} from '../controllers/solanaController';

export function setupSolanaRoutes(app: Hono<AppEnv>): void {
	app.get(
		'/api/solana/actions/devnet-airdrop',
		setAuthLevel(AuthConfig.public),
		getDevnetAirdropMetadata,
	);

	app.post(
		'/api/solana/actions/devnet-airdrop',
		setAuthLevel(AuthConfig.public),
		composeDevnetAirdropTransaction,
	);
}
