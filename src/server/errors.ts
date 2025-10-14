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
