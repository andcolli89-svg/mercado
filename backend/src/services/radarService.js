import { searchItems } from '../providers/mercadolivre/apiClient.js';
import { resolveMercadoLivreProduct } from '../providers/mercadolivre/provider.js';

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await mapper(values[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

export async function runRadar(query, limit = 8) {
  const search = await searchItems(query, Math.min(20, limit * 2));
  const results = Array.isArray(search?.results) ? search.results : [];
  const candidates = results
    .filter((item) => item?.id && /^MLB\d+$/.test(item.id))
    .slice(0, Math.min(12, limit * 2));

  const settled = await mapWithConcurrency(candidates, 4, (item) =>
    resolveMercadoLivreProduct(`https://produto.mercadolivre.com.br/MLB-${item.id.slice(3)}-_JM`, {
      includeSeller: false,
    }));

  return settled
    .filter((entry) => entry.status === 'fulfilled')
    .map((entry) => entry.value)
    .filter((product) => product.price.confirmed && product.price.current)
    .sort((a, b) => {
      const discountDelta = b.price.discountPercent - a.price.discountPercent;
      if (discountDelta !== 0) return discountDelta;
      return b.price.confidence - a.price.confidence;
    })
    .slice(0, limit);
}
