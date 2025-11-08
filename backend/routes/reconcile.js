import express from 'express';

const router = express.Router();
const HACKUTD_API = 'https://hackutd2025.eog.systems';

// POST /api/reconcile - Detect drains and match tickets
router.post('/', async (req, res) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }
    
    // Fetch data from HackUTD API
    const [cauldronRes, ticketRes, dataRes] = await Promise.all([
      fetch(`${HACKUTD_API}/api/Information/cauldrons`),
      fetch(`${HACKUTD_API}/api/Tickets`),
      fetch(`${HACKUTD_API}/api/Data?start_date=0&end_date=2000000000`)
    ]);
    
    if (!cauldronRes.ok || !ticketRes.ok || !dataRes.ok) {
      throw new Error('Failed to fetch data from HackUTD API');
    }
    
    const cauldrons = await cauldronRes.json();
    const allTickets = await ticketRes.json();
    const allData = await dataRes.json();
    
    // Filter tickets for this date
    const tickets = allTickets.filter(t => {
      const ticketDate = new Date(t.date || t.timestamp).toISOString().split('T')[0];
      return ticketDate === date;
    });
    
    const results = [];
    
    for (const cauldron of cauldrons) {
      const cauldronId = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
      const cauldronName = cauldron.name || cauldron.cauldronName || cauldronId;
      
      // Get levels for this cauldron on this date
      const startOfDay = new Date(`${date}T00:00:00`).getTime();
      const endOfDay = new Date(`${date}T23:59:59`).getTime();
      
      const levels = allData
        .filter(d => {
          const dCauldronId = d.cauldronId || d.cauldron_id || d.tankId;
          const dTimestamp = new Date(d.timestamp || d.date).getTime();
          return dCauldronId === cauldronId && dTimestamp >= startOfDay && dTimestamp <= endOfDay;
        })
        .sort((a, b) => new Date(a.timestamp || a.date) - new Date(b.timestamp || b.date));
      
      if (levels.length < 2) {
        continue;
      }
      
      // Detect drains (significant volume decreases)
      const drains = [];
      for (let i = 1; i < levels.length; i++) {
        const prevLevel = levels[i - 1];
        const currLevel = levels[i];
        
        const prevVolume = prevLevel.volume || prevLevel.level || 0;
        const currVolume = currLevel.volume || currLevel.level || 0;
        const volumeChange = currVolume - prevVolume;
        
        // If volume decreased significantly (more than expected fill rate would add)
        if (volumeChange < -10) {
          const timeDiff = (new Date(currLevel.timestamp || currLevel.date) - 
                           new Date(prevLevel.timestamp || prevLevel.date)) / (1000 * 60); // minutes
          
          const fillRate = cauldron.fillRate || cauldron.fill_rate || 2.0; // Default 2 L/min
          const expectedIncrease = fillRate * timeDiff;
          const actualDrain = Math.abs(volumeChange) + expectedIncrease;
          
          drains.push({
            timestamp: currLevel.timestamp || currLevel.date,
            volumeDrained: actualDrain,
            levelBefore: prevVolume,
            levelAfter: currVolume
          });
        }
      }
      
      // Find tickets for this cauldron on this date
      const cauldronTickets = tickets.filter(t => {
        const tCauldronId = t.cauldronId || t.cauldron_id;
        return tCauldronId === cauldronId;
      });
      
      // Calculate totals
      const totalDrained = drains.reduce((sum, d) => sum + d.volumeDrained, 0);
      const totalTicketed = cauldronTickets.reduce((sum, t) => 
        sum + (t.volume || t.volumeCollected || t.volume_collected || 0), 0
      );
      const discrepancy = totalDrained - totalTicketed;
      
      results.push({
        cauldron_id: cauldronId,
        cauldron_name: cauldronName,
        date: date,
        drains: drains,
        tickets: cauldronTickets,
        totalDrained: totalDrained,
        totalTicketed: totalTicketed,
        discrepancy: discrepancy,
        status: Math.abs(discrepancy) < 10 ? 'OK' : 'SUSPICIOUS',
        message: Math.abs(discrepancy) < 10 
          ? 'Volumes match within tolerance' 
          : discrepancy > 0 
            ? `Missing tickets: ${discrepancy.toFixed(2)} units unaccounted` 
            : `Excess tickets: ${Math.abs(discrepancy).toFixed(2)} units over-reported`
      });
    }
    
    res.json({
      date: date,
      summary: {
        totalCauldrons: cauldrons.length,
        cauldronsMismatched: results.filter(r => r.status === 'SUSPICIOUS').length,
        totalDrains: results.reduce((sum, r) => sum + r.drains.length, 0),
        totalTickets: tickets.length
      },
      details: results
    });
    
  } catch (error) {
    console.error('Reconciliation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
