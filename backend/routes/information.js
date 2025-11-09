import express from 'express';

const router = express.Router();
const HACKUTD_API = 'https://hackutd2025.eog.systems';

// GET /api/information/market - Returns market location
router.get('/market', async (req, res) => {
  try {
    // Market is a fixed location in the network
    const market = {
      id: 'market',
      name: 'Enchanted Market',
      type: 'market',
      latitude: 32.9857,
      longitude: -96.7501,
      unload_time_min: 15
    };
    res.json(market);
  } catch (error) {
    console.error('Error fetching market info:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/information/cauldrons - Returns all cauldrons with locations
router.get('/cauldrons', async (req, res) => {
  try {
    const response = await fetch(`${HACKUTD_API}/api/Information/cauldrons`);
    if (!response.ok) {
      throw new Error(`HackUTD API error: ${response.status}`);
    }
    const cauldrons = await response.json();
    res.json(cauldrons);
  } catch (error) {
    console.error('Error fetching cauldrons:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/information/network - Returns network edges (connections between nodes)
router.get('/network', async (req, res) => {
  try {
    // Fetch cauldrons to build network
    const response = await fetch(`${HACKUTD_API}/api/Information/cauldrons`);
    if (!response.ok) {
      throw new Error(`HackUTD API error: ${response.status}`);
    }
    const cauldrons = await response.json();
    
    // Build network edges - each cauldron connects to market and nearby cauldrons
    const market = { latitude: 32.9857, longitude: -96.7501 };
    const edges = [];
    
    // Helper function to calculate distance (Haversine formula simplified)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Earth radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };
    
    // Add edges from each cauldron to market
    cauldrons.forEach(cauldron => {
      const cauldronId = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
      const lat = cauldron.latitude || cauldron.lat || 0;
      const lon = cauldron.longitude || cauldron.lon || cauldron.long || 0;
      
      const distance = calculateDistance(lat, lon, market.latitude, market.longitude);
      const travel_min = Math.round(distance * 2); // ~2 min per km by broomstick
      
      edges.push({
        from: cauldronId,
        to: 'market',
        distance_km: parseFloat(distance.toFixed(2)),
        travel_min: travel_min
      });
    });
    
    // Add edges between nearby cauldrons (within 50km)
    for (let i = 0; i < cauldrons.length; i++) {
      for (let j = i + 1; j < cauldrons.length; j++) {
        const c1 = cauldrons[i];
        const c2 = cauldrons[j];
        
        const lat1 = c1.latitude || c1.lat || 0;
        const lon1 = c1.longitude || c1.lon || c1.long || 0;
        const lat2 = c2.latitude || c2.lat || 0;
        const lon2 = c2.longitude || c2.lon || c2.long || 0;
        
        const distance = calculateDistance(lat1, lon1, lat2, lon2);
        
        if (distance < 50) { // Only connect if within 50km
          const travel_min = Math.round(distance * 2);
          const id1 = c1.id || c1.cauldronId || c1.cauldron_id;
          const id2 = c2.id || c2.cauldronId || c2.cauldron_id;
          
          edges.push({
            from: id1,
            to: id2,
            distance_km: parseFloat(distance.toFixed(2)),
            travel_min: travel_min
          });
        }
      }
    }
    
    res.json({ edges });
  } catch (error) {
    console.error('Error building network:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;