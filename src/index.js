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

// CORS
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'wineo-back' });
});

// Routes
app.use('/auth', authRoutes);
app.use('/categories', categoryRoutes);
app.use('/filters', filterRoutes);
app.use('/products', productRoutes);
app.use('/regions', regionRoutes);
app.use('/cities', cityRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// 500
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// HOST + PORT
const host = process.env.HOST || '0.0.0.0';
const port = config.port;

// Start server first so the process stays alive (e.g. on Render).
// Then connect DB in the background; routes will fail until DB is connected.
app.listen(port, host, () => {
  console.log(`Wineo API running at http://${host}:${port}`);
});

connectDb()
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    console.error('Set MONGODB_URI in Render → Environment Variables. API will run but DB routes will fail.');
  });