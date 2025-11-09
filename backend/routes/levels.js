import express from 'express';

const router = express.Router();
const HACKUTD_API = 'https://hackutd2025.eog.systems';

// GET potion levels/data from HackUTD API with optional filtering
router.get('/', async (req, res) => {
  try {
    const { cauldron_id, start_date, end_date, start_time, end_time, limit } = req.query;
    
    // Use provided dates or default to last 7 days
    const startDate = start_date || start_time || '0';
    const endDate = end_date || end_time || '2000000000'; // Far future timestamp
    
    const response = await fetch(`${HACKUTD_API}/api/Data?start_date=${startDate}&end_date=${endDate}`);
    if (!response.ok) {
      throw new Error(`HackUTD API error: ${response.status}`);
    }
    const data = await response.json();
    
    // Transform nested cauldron_levels into flat array
    let transformedData = [];
    data.forEach(record => {
      if (record.cauldron_levels) {
        // New format: {timestamp: "...", cauldron_levels: {cauldron_001: 640.35, ...}}
        Object.entries(record.cauldron_levels).forEach(([cauldronId, volume]) => {
          transformedData.push({
            cauldronId: cauldronId,
            volume: volume,
            timestamp: record.timestamp
          });
        });
      } else {
        // Old format or already flat
        transformedData.push(record);
      }
    });
    
    // Filter by cauldron_id if provided
    if (cauldron_id) {
      transformedData = transformedData.filter(d => 
        d.cauldronId === cauldron_id || d.cauldron_id === cauldron_id
      );
    }
    
    // Apply limit if provided
    if (limit) {
      transformedData = transformedData.slice(0, parseInt(limit));
    }
    
    res.json(transformedData);
  } catch (error) {
    console.error('Error fetching levels:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET latest level for each cauldron
router.get('/latest', async (req, res) => {
  try {
    // Get recent data
    const response = await fetch(`${HACKUTD_API}/api/Data?start_date=0&end_date=2000000000`);
    if (!response.ok) {
      throw new Error(`HackUTD API error: ${response.status}`);
    }
    const allData = await response.json();
    
    // Find the most recent record
    let latestRecord = null;
    let latestTimestamp = 0;
    
    allData.forEach(record => {
      const timestamp = new Date(record.timestamp || record.date).getTime();
      if (timestamp > latestTimestamp) {
        latestTimestamp = timestamp;
        latestRecord = record;
      }
    });
    
    // Transform the cauldron_levels object into an array of individual records
    if (latestRecord && latestRecord.cauldron_levels) {
      const result = Object.entries(latestRecord.cauldron_levels).map(([cauldronId, volume]) => ({
        cauldronId: cauldronId,
        volume: volume,
        timestamp: latestRecord.timestamp
      }));
      res.json(result);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Error fetching latest levels:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET levels for a specific cauldron
router.get('/:cauldron_id', async (req, res) => {
  try {
    const { start_time, end_time, start_date, end_date, limit } = req.query;
    
    const startParam = start_date || start_time || '0';
    const endParam = end_date || end_time || '2000000000';
    
    const response = await fetch(`${HACKUTD_API}/api/Data?start_date=${startParam}&end_date=${endParam}`);
    if (!response.ok) {
      throw new Error(`HackUTD API error: ${response.status}`);
    }
    const data = await response.json();
    
    let filteredData = data.filter(d => 
      d.cauldronId === req.params.cauldron_id || 
      d.cauldron_id === req.params.cauldron_id ||
      d.tankId === req.params.cauldron_id
    );
    
    if (limit) {
      filteredData = filteredData.slice(0, parseInt(limit));
    }
    
    res.json(filteredData);
  } catch (error) {
    console.error('Error fetching cauldron levels:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
