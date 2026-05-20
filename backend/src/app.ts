import express from 'express';
import cors from 'cors';
import projectRoutes from './routes/projects';
import dataRoutes from './routes/data';
import './workers'; // initialize workers

const app = express();

app.use(cors());
app.use(express.json({ limit: '500mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Telebase API is running' });
});

app.use('/projects', projectRoutes);
app.use('/data', dataRoutes);

export default app;
