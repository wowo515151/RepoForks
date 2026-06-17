import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDatabase, runForksRefresh, saveDatabase, generateSeedDatabase } from './src/dataManager.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable JSON request body parsing
  app.use(express.json());

  // Log incoming API requests for debugging
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[RepoForks API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Query / Seed database on startup
  try {
    const db = getDatabase();
    console.log(`[RepoForks DB] Loaded database containing ${db.repositories.length} tracking repositories.`);
  } catch (error) {
    console.error('[RepoForks DB] Initialization failed:', error);
  }

  // Standalone initialization sweep in the background (runs when started, unblocking server boot)
  setTimeout(() => {
    console.log('[RepoForks Routine] Performing startup ForksRefresh sweep...');
    runForksRefresh(process.env.GITHUB_TOKEN)
      .then((updatedDb) => {
        console.log(`[RepoForks Routine] Startup sweep completed. Call usage: ${updatedDb.apiUsage.requestsMade} queries.`);
      })
      .catch((err) => {
        console.error('[RepoForks Routine] Startup sweep failed:', err);
      });
  }, 3000);

  // Set up daily interval (Sync once every 24 hours)
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    console.log('[RepoForks Routine] Initiating scheduled daily ForksRefresh sweep...');
    // Reset our hourly metric/requestsMade count daily to allow fresh inquiries
    try {
      const db = getDatabase();
      db.apiUsage.requestsMade = 0;
      saveDatabase(db);
    } catch (e) {
      console.error('Failed to reset daily API requests made counter', e);
    }

    runForksRefresh(process.env.GITHUB_TOKEN)
      .then(() => {
        console.log('[RepoForks Routine] Daily sync cycle completed successfully.');
      })
      .catch((err) => {
        console.error('[RepoForks Routine] Daily sync cycle faulted:', err);
      });
  }, DAY_IN_MS);

  // --- API Endpoints ---

  // Get current state of the tracked repositories, API limits, and history
  app.get('/api/database', (req, res) => {
    try {
      const db = getDatabase();
      res.json(db);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve repository data.' });
    }
  });

  // Manually trigger a fresh Github forks update sweep (simulating GitHub actions)
  app.post('/api/sync', async (req, res) => {
    try {
      console.log('[RepoForks API] Direct manual sync request received.');
      const updatedDb = await runForksRefresh(process.env.GITHUB_TOKEN);
      res.json({
        success: true,
        message: 'Manual ForksRefresh trigger completed successfully.',
        data: updatedDb
      });
    } catch (error: any) {
      console.error('[RepoForks API] Manual sync exception:', error);
      res.status(500).json({
        success: false,
        error: 'Manual ForksRefresh sequence failed.',
        message: error.message || String(error)
      });
    }
  });

  // Reset database state to the original seed points (for evaluation and demo)
  app.post('/api/reset', (req, res) => {
    try {
      console.log('[RepoForks API] database reset requested.');
      const freshSeed = generateSeedDatabase();
      saveDatabase(freshSeed);
      res.json({
        success: true,
        message: 'Repository database successfully reset to clean telemetry, ready for 100% real live GitHub updates.',
        data: freshSeed
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset database.' });
    }
  });

  // Support health probe
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', datetime: new Date().toISOString() });
  });

  // --- Vite Dev Server Middleware vs Production Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA routing fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RepoForks System] Server running with Node on http://localhost:${PORT}`);
  });
}

startServer();
