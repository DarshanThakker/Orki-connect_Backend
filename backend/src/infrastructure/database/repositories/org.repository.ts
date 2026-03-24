import { Organization } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma.client';

export async function findOrgById(organization_id: string): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { organization_id } });
}

export async function findOrgByClientId(client_id: string): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { client_id } });
}

export async function findOrgByCredentials(client_id: string, client_secret: string): Promise<Organization | null> {
  const org = await prisma.organization.findUnique({ where: { client_id } });
  if (!org) return null;
  const isMatch = await bcrypt.compare(client_secret, org.client_secret_hash);
  return isMatch ? org : null;
}

export async function createOrg(params: {
  organization_id: string;
  client_id: string;
  client_secret: string;
  webhook_url?: string;
  config: Record<string, any>;
}): Promise<Organization> {
  const { organization_id, client_id, client_secret, webhook_url, config } = params;
  const client_secret_hash = await bcrypt.hash(client_secret, 10);

  return prisma.organization.create({
    data: { organization_id, client_id, client_secret_hash, webhook_url: webhook_url || null, config },
  });
}

export async function updateOrgConfig(organization_id: string, config: Record<string, any>): Promise<Organization> {
  return prisma.organization.update({ where: { organization_id }, data: { config } });
}

export async function updateOrgWebhookUrl(organization_id: string, webhook_url: string): Promise<void> {
  await prisma.organization.update({ where: { organization_id }, data: { webhook_url } });
}
