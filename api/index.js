import { createApp } from '../server/app.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured for deployment.');
const origin = process.env.APP_ORIGIN || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
const { app } = createApp({ production: true, origin });
export default app;
