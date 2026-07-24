export class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', status = 500, details = null, cause = null } = {}) {
    super(message, { cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, { code: 'VALIDATION_ERROR', status: 400, details });
  }
}

export class ProductNotFoundError extends AppError {
  constructor(message = 'Não foi possível identificar o produto.', details = null) {
    super(message, { code: 'PRODUCT_NOT_FOUND', status: 422, details });
  }
}

export class UpstreamError extends AppError {
  constructor(message, { status = 502, details = null, cause = null } = {}) {
    super(message, { code: 'UPSTREAM_ERROR', status, details, cause });
  }
}
