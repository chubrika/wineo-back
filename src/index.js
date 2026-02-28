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

// CORS (vivi-style: explicit methods + headers for auth and preflight)
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'wineo-back' });
});

// Routes (under /api for consistency with vivi-style structure)
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/products', productRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/cities', cityRoutes);

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

export default app;

connectDb()
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    console.error('Set MONGODB_URI in Render → Environment Variables. API will run but DB routes will fail.');
  });