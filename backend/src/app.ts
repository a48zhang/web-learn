import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { config } from './utils/config';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Web Learn API is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes will be added here
// app.use('/api/auth', authRoutes);
// app.use('/api/topics', topicRoutes);
// app.use('/api/tasks', taskRoutes);
// app.use('/api/resources', resourceRoutes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

export default app;