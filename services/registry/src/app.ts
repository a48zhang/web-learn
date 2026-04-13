import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ServiceRegistry } from './registry';
import type { RegisterRequest } from './registry';

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
});

const registry = new ServiceRegistry();
registry.startCleanup();

const app: Application = express();
app.use(cors({ origin: true }));
app.use(globalLimiter);
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, service: 'registry', timestamp: new Date().toISOString() });
});

app.post('/register', (req: Request, res: Response) => {
  const { name, url, routes, metadata } = req.body as RegisterRequest;
  if (!name || !url || !routes || !Array.isArray(routes)) {
    return res.status(400).json({ success: false, error: 'Missing required fields: name, url, routes' });
  }
  const entry = registry.register({ name, url, routes, metadata });
  res.json({ success: true, data: entry });
});

app.post('/heartbeat', (req: Request, res: Response) => {
  const { name, url } = req.body as { name?: string; url?: string };
  if (!name) {
    return res.status(400).json({ success: false, error: 'Missing required field: name' });
  }
  const ok = registry.heartbeat(name, url);
  if (!ok) {
    return res.status(404).json({ success: false, error: `Service not found: ${name}${url ? ` at ${url}` : ''}` });
  }
  res.json({ success: true });
});

app.get('/services', (_req: Request, res: Response) => {
  res.json(registry.getAll());
});

export default app;
