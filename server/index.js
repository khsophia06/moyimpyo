import { createApp } from './app.js';
import express from 'express';
import { resolve } from 'node:path';
const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
const { app, db } = createApp({ production });
if (production) { app.use(express.static(resolve('dist'))); app.get('/{*path}', (req, res) => res.sendFile(resolve('dist/index.html'))); }
else { const { createServer } = await import('vite'); const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); }
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`모임표 http://localhost:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
