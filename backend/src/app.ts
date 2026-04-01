import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './utils/config';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import topicRoutes from './routes/topicRoutes';
import reviewRoutes from './routes/reviewRoutes';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Web Learn API is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api', reviewRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

export default app;