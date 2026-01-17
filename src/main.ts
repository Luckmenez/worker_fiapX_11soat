import 'reflect-metadata';
import express from 'express';
import './shared/container';
import { processVideoRoutes } from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/videos', processVideoRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
