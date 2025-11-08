import express from 'express';

const router = express.Router();
const HACKUTD_API = 'https://hackutd2025.eog.systems';

// GET all cauldrons from HackUTD API
router.get('/', async (req, res) => {
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

// GET single cauldron by ID
router.get('/:id', async (req, res) => {
  try {
    const response = await fetch(`${HACKUTD_API}/api/Information/cauldrons`);
    if (!response.ok) {
      throw new Error(`HackUTD API error: ${response.status}`);
    }
    const cauldrons = await response.json();
    const cauldron = cauldrons.find(c => c.id === req.params.id || c.cauldronId === req.params.id);
    
    if (!cauldron) {
      return res.status(404).json({ error: 'Cauldron not found' });
    }
    res.json(cauldron);
  } catch (error) {
    console.error('Error fetching cauldron:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
