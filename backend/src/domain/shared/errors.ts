export class OrkiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'OrkiError';
  }
}

export class ValidationError extends OrkiError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 422);
  }
}

export class AuthError extends OrkiError {
  constructor(message = 'Unauthorized') {
    super('AUTH_ERROR', message, 401);
  }
}

export class NotFoundError extends OrkiError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

export class RiskFlaggedError extends OrkiError {
  constructor() {
    super('RISK_FLAGGED', 'Address flagged by AML screening', 403);
  }
}

export class LimitError extends OrkiError {
  constructor(message: string, code: string, public readonly details: any = {}) {
    super(code, message, 400);
  }
}
