import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import subnetRoutes from './api/subnets';
import metricsRoutes from './api/metrics';
import askAvaRoutes from './api/askAva';
import avaCloudMetricsRoutes from './api/avaCloudMetrics';
import { authMiddleware } from './middleware/authMiddleware';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/subnets', authMiddleware, subnetRoutes);
app.use('/api/metrics', authMiddleware, metricsRoutes);
app.use('/api/ask-ava', authMiddleware, askAvaRoutes);
app.use('/api/avacloud', authMiddleware, avaCloudMetricsRoutes);

app.get('/', (req, res) => {
  res.send('AvaScope API is running!');
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 