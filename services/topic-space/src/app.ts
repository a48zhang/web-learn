import express, { Express } from 'express';
import cors from 'cors';
import { config } from './utils/config';
import topicRoutes from './routes/topicRoutes';

const isLocalOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.endsWith('.localhost');
  } catch {
    return false;
  }
};

const app: Express = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || isLocalOrigin(origin) || config.cors.origins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
}));

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'topic-space', timestamp: new Date().toISOString() });
});

app.use('/api/topics', topicRoutes);
export default app;
