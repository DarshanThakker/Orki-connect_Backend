import { SessionStatus } from '@prisma/client';

export { SessionStatus };

export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

export const SESSION_STATE_MACHINE: Record<SessionStatus, SessionStatus[]> = {
  [SessionStatus.CREATED]: [SessionStatus.ACTIVE, SessionStatus.FAILED, SessionStatus.EXPIRED],
  [SessionStatus.ACTIVE]: [SessionStatus.COMPLETED, SessionStatus.FAILED, SessionStatus.EXPIRED, SessionStatus.EXTENDED_MONITORING],
  [SessionStatus.EXTENDED_MONITORING]: [SessionStatus.COMPLETED, SessionStatus.FAILED],
  [SessionStatus.COMPLETED]: [],
  [SessionStatus.FAILED]: [],
  [SessionStatus.EXPIRED]: [],
};

export function isValidTransition(from: SessionStatus, to: SessionStatus): boolean {
  return (SESSION_STATE_MACHINE[from] ?? []).includes(to);
}

export const NON_EXPIRABLE_STATUSES: SessionStatus[] = [
  SessionStatus.COMPLETED,
  SessionStatus.FAILED,
  SessionStatus.EXTENDED_MONITORING,
];
