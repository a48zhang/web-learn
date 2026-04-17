import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './utils/config';
import aiRouter from './routes/aiRoutes';
import agentConversationRouter from './routes/agentConversationRoutes';

const isLocalOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.localhost');
  } catch {
    return false;
  }
};

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false,
});

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || isLocalOrigin(origin) || config.cors.origins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));
app.use(globalLimiter);

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'ai', timestamp: new Date().toISOString() });
});

app.use('/api/ai', aiRouter);
app.use('/api/ai', agentConversationRouter);

export default app;
