import { SessionStatus, Prisma } from '@prisma/client';
import { prisma } from '../prisma.client';

export async function createSession(data: Prisma.SessionCreateInput) {
  return prisma.session.create({ data });
}

export async function findSessionById(session_id: string) {
  return prisma.session.findUnique({ where: { session_id } });
}

export async function updateSession(session_id: string, data: Prisma.SessionUpdateInput) {
  return prisma.session.update({ where: { session_id }, data });
}

export async function updateSessionStatus(
  session_id: string,
  status: SessionStatus,
  extra: Partial<Prisma.SessionUpdateInput> = {}
) {
  return prisma.session.update({ where: { session_id }, data: { ...extra, status } });
}
