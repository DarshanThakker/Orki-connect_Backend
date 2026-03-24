import 'dotenv/config';

export const config = {
    ORKI_BACKEND_URL: process.env.ORKI_BACKEND_URL ?? 'http://localhost:3000',
    ORKI_ORG_ACCESS_TOKEN: process.env.ORKI_ORG_ACCESS_TOKEN ?? '',
    ORKI_SOLANA_DEPOSIT_ADDRESS: process.env.ORKI_SOLANA_DEPOSIT_ADDRESS ?? '',
}