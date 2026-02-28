import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { connectDb } from './db.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import filterRoutes from './routes/filters.js';
import productRoutes from './routes/products.js';
import regionRoutes from './routes/regions.js';
import cityRoutes from './routes/cities.js';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'wineo-back' });
});

app.use('/auth', authRoutes);
app.use('/categories', categoryRoutes);
app.use('/filters', filterRoutes);
app.use('/products', productRoutes);
app.use('/regions', regionRoutes);
app.use('/cities', cityRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const host = process.env.HOST || '0.0.0.0';
const port = config.port;

app.listen(port, host, () => {
  console.log(`Wineo API running at http://${host}:${port}`);
});

connectDb()
  .then(() => {})
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    console.error('App is running but database operations will fail. Set MONGODB_URI in Render → Environment.');
  });
