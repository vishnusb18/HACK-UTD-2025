import { useState } from 'react';

function TicketTable({ tickets }) {
  const [filterCauldron, setFilterCauldron] = useState('');

  const allTickets = Array.isArray(tickets) ? tickets : [];

  const filteredTickets = allTickets.filter(ticket => {
    const cauldronId = ticket.cauldronId || ticket.cauldron_id || ticket.cauldron;
    return filterCauldron === '' || cauldronId === filterCauldron;
  });

  const uniqueCauldrons = [...new Set(allTickets.map(t => t.cauldronId || t.cauldron_id || t.cauldron).filter(Boolean))];

  // normalize and group tickets by date (YYYY-MM-DD)
  const ticketsByDate = {};
  allTickets.forEach((ticket) => {
    const ticketId = ticket.id || ticket.ticketId || ticket.ticket_id || ticket.ticketId || JSON.stringify(ticket);
    const cauldronId = ticket.cauldronId || ticket.cauldron_id || ticket.cauldron || '';
    const volumeCollected = Number(ticket.volume ?? ticket.volumeCollected ?? ticket.volume_collected ?? ticket.amount_collected ?? 0) || 0;
    // derive dateStr: prefer ticket.date, ticket.dateStr, ticket.timestamp
    const dateSource = ticket.dateStr || ticket.date || ticket.timestamp || ticket.createdAt || '';
    let dateKey = '';
    try {
      if (dateSource) {
        const d = new Date(dateSource);
        if (!isNaN(d)) dateKey = d.toISOString().split('T')[0];
      }
    } catch (e) {
      dateKey = '';
    }
    const row = { ticketId, cauldronId, volumeCollected, original: ticket, dateKey };
    const key = dateKey || 'unknown';
    ticketsByDate[key] = ticketsByDate[key] || [];
    ticketsByDate[key].push(row);
  });

  // sort tickets within each day by cauldron id (string compare)
  Object.keys(ticketsByDate).forEach(k => {
    ticketsByDate[k].sort((a, b) => ('' + a.cauldronId).localeCompare('' + b.cauldronId));
  });

  // sorted date keys (latest first)
  const sortedDateKeys = Object.keys(ticketsByDate).sort((a, b) => b.localeCompare(a));

  const [expandedDays, setExpandedDays] = useState({});

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden">
      {/* Debug panel removed for production - TicketTable now renders normalized data */}
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
      <div>
        <style>{`
          .ticket-scroll { scrollbar-width: thin; scrollbar-color: #7c3aed rgba(255,255,255,0.03); }
          .ticket-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
          .ticket-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 9999px; }
          .ticket-scroll::-webkit-scrollbar-thumb { background: linear-gradient(180deg,#7c3aed,#ec4899); border-radius: 9999px; border: 3px solid rgba(0,0,0,0); background-clip: padding-box; }
        `}</style>
        <div className="p-4 space-y-4 max-h-96 overflow-auto ticket-scroll">
        {sortedDateKeys.length === 0 ? (
          <div className="text-center py-8 text-purple-300">No tickets found</div>
        ) : (
          sortedDateKeys.map((dateKey) => {
            const rows = ticketsByDate[dateKey] || [];
            // if a cauldron filter is active, only include matching tickets
            const visibleRows = rows.filter(r => filterCauldron === '' || r.cauldronId === filterCauldron);
            const expanded = !!expandedDays[dateKey];
            return (
              <div key={dateKey} className="bg-white/5 p-3 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm text-purple-200">Date</div>
                    <div className="text-white font-semibold">{dateKey === 'unknown' ? 'Unknown' : dateKey}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-purple-200">Tickets: <span className="text-white font-semibold">{visibleRows.length}</span></div>
                    <button
                      onClick={() => setExpandedDays({ ...expandedDays, [dateKey]: !expanded })}
                      className="px-3 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded text-sm"
                      aria-expanded={expanded}
                    >
                      {expanded ? 'Collapse ▴' : 'Expand ▾'}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-2">
                    {visibleRows.map(r => (
                      <div key={r.ticketId} className="flex items-center justify-between p-2 bg-white/3 rounded border border-white/6">
                        <div>
                          <div className="text-sm text-purple-200">Cauldron</div>
                          <div className="text-white font-medium">{r.cauldronId || '(unknown)'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-purple-200">Ticket</div>
                          <div className="text-white font-mono">{r.ticketId}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-purple-200">Volume</div>
                          <div className="text-white font-semibold">{(r.volumeCollected || 0).toFixed(2)} L</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
    </div>
  );
}

export default TicketTable;
