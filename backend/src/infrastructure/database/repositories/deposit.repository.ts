import { Chain } from '@prisma/client';
import { prisma } from '../prisma.client';

export async function upsertDepositAddress(session_id: string, address: string, network: Chain) {
  return prisma.depositAddress.upsert({
    where: { session_id },
    update: { address, network },
    create: { session_id, address, network },
  });
}

export async function findDepositBySession(session_id: string) {
  return prisma.depositAddress.findUnique({ where: { session_id } });
}

export async function deleteDeposit(session_id: string) {
  try {
    return await prisma.depositAddress.delete({ where: { session_id } });
  } catch (err: any) {
    if (err.code === 'P2025') return null;
    throw err;
  }
}
