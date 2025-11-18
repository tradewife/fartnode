import { AppConfig } from './config';
import { HolderBalance } from './holders';

export function filterEligibleHolders(
  holders: HolderBalance[],
  config: AppConfig,
): HolderBalance[] {
  return holders.filter((holder) => {
    if (holder.amount < config.minEligibleBalance) {
      return false;
    }
    if (config.maxEligibleBalance !== null && holder.amount > config.maxEligibleBalance) {
      return false;
    }
    return true;
  });
}
