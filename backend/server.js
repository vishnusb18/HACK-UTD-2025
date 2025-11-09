import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
import cauldronRoutes from './routes/cauldrons.js';
import ticketRoutes from './routes/tickets.js';
import levelRoutes from './routes/levels.js';
import reconcileRoutes from './routes/reconcile.js';
import informationRoutes from './routes/information.js';
import levelDetailRoutes from './routes/levelDetail.js';

app.use('/api/cauldrons', cauldronRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/levels', levelRoutes);
app.use('/api/reconcile', reconcileRoutes);
app.use('/api/information', informationRoutes);
app.use('/api/level', levelDetailRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'PotionFlow API is running',
    upstreamAPI: 'https://hackutd2025.eog.systems'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🧙‍♀️ PotionFlow API running on http://localhost:${PORT}`);
  console.log(`📡 Proxying HackUTD API: https://hackutd2025.eog.systems`);
});
