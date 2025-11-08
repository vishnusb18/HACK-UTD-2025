import express from 'express';

const router = express.Router();
const HACKUTD_API = 'https://hackutd2025.eog.systems';

// GET all tickets from HackUTD API
router.get('/', async (req, res) => {
  try {
    const response = await fetch(`${HACKUTD_API}/api/Tickets`);
    if (!response.ok) {
      throw new Error(`HackUTD API error: ${response.status}`);
    }
    const tickets = await response.json();
    
    // Apply client-side filtering if query params provided
    let filteredTickets = tickets;
    const { cauldron_id, date, start_date, end_date } = req.query;
    
    if (cauldron_id) {
      filteredTickets = filteredTickets.filter(t => 
        t.cauldronId === cauldron_id || t.cauldron_id === cauldron_id
      );
    }
    
    if (date) {
      filteredTickets = filteredTickets.filter(t => {
        const ticketDate = new Date(t.date || t.timestamp).toISOString().split('T')[0];
        return ticketDate === date;
      });
    }
    
    if (start_date && end_date) {
      filteredTickets = filteredTickets.filter(t => {
        const ticketDate = new Date(t.date || t.timestamp).getTime();
        return ticketDate >= new Date(start_date).getTime() && 
               ticketDate <= new Date(end_date).getTime();
      });
    }
    
    res.json(filteredTickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single ticket by ID
router.get('/:id', async (req, res) => {
  try {
    const response = await fetch(`${HACKUTD_API}/api/Tickets`);
    if (!response.ok) {
      throw new Error(`HackUTD API error: ${response.status}`);
    }
    const tickets = await response.json();
    const ticket = tickets.find(t => 
      t.id === req.params.id || t.ticketId === req.params.id || t.ticket_id === req.params.id
    );
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
