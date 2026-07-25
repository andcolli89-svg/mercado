export const config = Object.freeze({
  version: '6.0.0-alpha.2',
  host: process.env.HOST || '0.0.0.0',
  port: Number.parseInt(process.env.PORT || '10000', 10),
  requestTimeoutMs: Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10),
  maxRedirects: Number.parseInt(process.env.MAX_REDIRECTS || '8', 10),
  maxHtmlBytes: Number.parseInt(process.env.MAX_HTML_BYTES || '2500000', 10),
  mercadoLivreToken: process.env.MELI_ACCESS_TOKEN || '',
  mercadoLivreSite: process.env.MELI_SITE_ID || 'MLB',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
});
