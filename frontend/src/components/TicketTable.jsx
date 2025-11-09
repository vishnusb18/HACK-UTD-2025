import { useState } from 'react';

function TicketTable({ tickets }) {
  const [filterCauldron, setFilterCauldron] = useState('');

  const filteredTickets = (Array.isArray(tickets) ? tickets : []).filter(ticket => {
    const cauldronId = ticket.cauldronId || ticket.cauldron_id || ticket.cauldron;
    return filterCauldron === '' || cauldronId === filterCauldron;
  });

  const uniqueCauldrons = [...new Set((Array.isArray(tickets) ? tickets : []).map(t => t.cauldronId || t.cauldron_id || t.cauldron).filter(Boolean))];

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden">
      <div className="p-4 bg-white/5 border-b border-white/20">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">📜 Transport Tickets</h2>
          <select
            value={filterCauldron}
            onChange={(e) => setFilterCauldron(e.target.value)}
            className="bg-white/10 border border-white/20 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Cauldrons</option>
            {uniqueCauldrons.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto max-h-96">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/20 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Ticket ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Cauldron</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Volume Collected</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-4 py-8 text-center text-purple-300">
                  {tickets && tickets.length > 0
                    ? 'No tickets match the filter.'
                    : 'No tickets found'}
                  {tickets && tickets.length > 0 && (
                    <div className="text-xs text-purple-400 mt-2">Total tickets: {tickets.length}</div>
                  )}
                </td>
              </tr>
            ) : (
              filteredTickets.map((ticket) => {
                const ticketId = ticket.id || ticket.ticketId || ticket.ticket_id || ticket.ticketId;
                const cauldronId = ticket.cauldronId || ticket.cauldron_id || ticket.cauldron;
                const volumeCollected = ticket.volume || ticket.volumeCollected || ticket.volume_collected || ticket.amount_collected || 0;
                const ticketDate = ticket.date || ticket.timestamp;
                
                return (
                  <tr key={ticketId} className="hover:bg-white/5 transition">
                    <td className="px-4 py-3 text-sm font-mono text-purple-200">{ticketId}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{cauldronId}</td>
                    <td className="px-4 py-3 text-sm text-purple-200">
                      {new Date(ticketDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-purple-200">
                        <span className="font-semibold text-white">{(Number(volumeCollected) || 0).toFixed(2)}</span> L
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TicketTable;
