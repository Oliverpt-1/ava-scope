import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import subnetRoutes from './api/subnets';
import metricsRoutes from './api/metrics';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/subnets', subnetRoutes);
app.use('/api/metrics', metricsRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}); 