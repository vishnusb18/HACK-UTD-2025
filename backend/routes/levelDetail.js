import express from 'express';

const router = express.Router();
const HACKUTD_API = 'https://hackutd2025.eog.systems';

// GET /api/levels/:id - Get levels for a specific cauldron with date filtering
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    
    // Default to last 24 hours if not specified
    const now = Date.now();
    const defaultFrom = from || Math.floor((now - 24 * 60 * 60 * 1000) / 1000); // 24h ago
    const defaultTo = to || Math.floor(now / 1000);
    
    // Fetch data from HackUTD API
    const response = await fetch(`${HACKUTD_API}/api/Data?start_date=${defaultFrom}&end_date=${defaultTo}`);
    if (!response.ok) {
      throw new Error(`HackUTD API error: ${response.status}`);
    }
    
    const allData = await response.json();
    
    // Filter for this specific cauldron
    const cauldronData = allData.filter(d => {
      const cauldronId = d.cauldronId || d.cauldron_id || d.tankId;
      return cauldronId === id;
    });
    
    // Sort by timestamp
    cauldronData.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.date).getTime();
      const timeB = new Date(b.timestamp || b.date).getTime();
      return timeA - timeB;
    });
    
    // Format the response
    const formattedData = cauldronData.map(d => ({
      cauldron_id: d.cauldronId || d.cauldron_id || d.tankId,
      timestamp: d.timestamp || d.date,
      volume: d.volume || d.level || 0,
      unix_time: Math.floor(new Date(d.timestamp || d.date).getTime() / 1000)
    }));
    
    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching cauldron levels:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;