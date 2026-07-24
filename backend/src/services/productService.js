import { ValidationError } from '../core/errors.js';
import { resolveMercadoLivreProduct } from '../providers/mercadolivre/provider.js';

export async function resolveProduct(url) {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('Informe o link do produto.');
  }

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new ValidationError('O link informado é inválido.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ValidationError('Use um link HTTP ou HTTPS.');
  }
  if (/(^|\.)(mercadolivre\.com\.br|mercadolivre\.com|meli\.la)$/i.test(parsed.hostname)) {
    return resolveMercadoLivreProduct(parsed.toString());
  }
  throw new ValidationError('Nesta primeira base da V6, somente links do Mercado Livre estão habilitados.');
}
