import { fetch } from 'undici';

export async function getSolUsdPrice(priceApiUrl: string): Promise<number> {
  const url = new URL(priceApiUrl);
  if (!url.searchParams.has('ids')) {
    url.searchParams.set('ids', 'SOL');
  }

  const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to fetch SOL price: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  const price = extractPrice(body);

  if (typeof price !== 'number' || Number.isNaN(price)) {
    throw new Error('Price API did not return a numeric SOL price');
  }
  if (price <= 0 || price > 1_000_000) {
    throw new Error(`SOL price (${price}) outside expected range`);
  }
  return price;
}

function extractPrice(data: Record<string, unknown>): number | undefined {
  // Jupiter price API returns { data: { SOL: { price: number } } }
  const nested = data?.['data'];
  if (nested && typeof nested === 'object' && 'SOL' in nested) {
    const solInfo = (nested as Record<string, unknown>)['SOL'];
    if (solInfo && typeof solInfo === 'object' && 'price' in solInfo) {
      const priceValue = (solInfo as Record<string, unknown>)['price'];
      if (typeof priceValue === 'number') {
        return priceValue;
      }
    }
  }

  // Allow alternative shapes like { SOL: { price: number } }
  if ('SOL' in data) {
    const solInfo = data['SOL'];
    if (solInfo && typeof solInfo === 'object' && 'price' in (solInfo as Record<string, unknown>)) {
      const priceValue = (solInfo as Record<string, unknown>)['price'];
      if (typeof priceValue === 'number') {
        return priceValue;
      }
    }
  }

  // Allow top-level `price` for fallback responses
  if ('price' in data && typeof data['price'] === 'number') {
    return data['price'];
  }

  return undefined;
}
