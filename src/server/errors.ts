export class QuotePdfError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "QuotePdfError";
  }
}

export class QuotePdfNotFoundError extends QuotePdfError {
  constructor(public readonly quoteId: string) {
    super(`Aucun devis trouvé pour l'identifiant ${quoteId}`);
    this.name = "QuotePdfNotFoundError";
  }
}

export class QuotePdfConfigurationError extends QuotePdfError {
  constructor(message: string) {
    super(message);
    this.name = "QuotePdfConfigurationError";
  }
}

export class QuotePdfValidationError extends QuotePdfError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "QuotePdfValidationError";
  }
}

export class ApiError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly cause?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, cause?: unknown) {
    super(message, 400, cause);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string) {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}
