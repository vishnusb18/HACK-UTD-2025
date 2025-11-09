import { useState, useEffect } from 'react';
import {
  loadTickets,
  fetchLevelsForDay,
  computePerCauldronSeries,
  aggregateDrainsPerCauldron,
  matchTicketsToDrains
} from '../utils/reconciliation';

function ReconciliationPanel() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  const [expandedCauldrons, setExpandedCauldrons] = useState(new Set());

  const handleReconcile = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setExpandedCauldrons(new Set()); // Reset expanded state
    try {
      const [tickets, levels] = await Promise.all([
        loadTickets(),
        fetchLevelsForDay(selectedDate)
      ]);

      // filter tickets to the selected date
      const ticketsForDay = tickets.filter(t => t.dateStr === selectedDate);

      // compute per-cauldron series
      const byId = computePerCauldronSeries(levels || []);
      const perCauldron = aggregateDrainsPerCauldron(byId);

      // total drained across all cauldrons for the day
      const totalDrained = Object.values(perCauldron).reduce((s, v) => s + (v.drained || 0), 0);

      const match = matchTicketsToDrains(ticketsForDay, totalDrained);

      // per-cauldron ticket aggregation (tickets may include cauldronId)
      const ticketsByCauldron = {};
      const ticketsByCauldronDetails = {}; // Store actual ticket objects
      
      ticketsForDay.forEach(t => {
        const id = t.cauldronId || t.cauldron_id || t.tankId || t.cauldron || t.source || t.from || null;
        const amt = Number(t.amount ?? t.amount_collected ?? t.amountCollected ?? t.volume ?? 0);
        if (id) {
          ticketsByCauldron[id] = (ticketsByCauldron[id] || 0) + amt;
          if (!ticketsByCauldronDetails[id]) ticketsByCauldronDetails[id] = [];
          ticketsByCauldronDetails[id].push(t);
        }
      });

      // build details for UI
      const details = Object.entries(perCauldron).map(([id, info]) => {
        const ticketCount = ticketsByCauldronDetails[id]?.length || 0;
        return {
          cauldron_id: id,
          drained: info.drained,
          fillRate: info.fillRate,
          events: info.events,
          ticketCount: ticketCount
        };
      });

      // find discrepancies per cauldron
      const tolPct = 0.15;
      const discrepancies = [];
      Object.entries(perCauldron).forEach(([id, info]) => {
        const drained = info.drained || 0;
        const ticketed = ticketsByCauldron[id] || 0;
        const tol = Math.max(1, tolPct * Math.max(ticketed, drained));
        const diff = ticketed - drained;
        if (Math.abs(diff) > tol) {
          discrepancies.push({ 
            cauldron_id: id, 
            drained, 
            ticketed, 
            diff,
            tickets: ticketsByCauldronDetails[id] || []
          });
        }
      });

      // tickets that have no associated cauldron (can't match)
  const ticketsWithoutCauldron = ticketsForDay.filter(t => !(t.cauldronId || t.cauldron_id || t.tankId || t.cauldron)).length;

      setResults({ date: selectedDate, tickets: ticketsForDay, match, details, discrepancies, ticketsWithoutCauldron });
    } catch (err) {
      setError(err.message);
      console.error('Reconciliation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // load available dates (from tickets) so the user can only pick dates that have data
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const tickets = await loadTickets();
        if (!mounted) return;
        const dates = Array.from(new Set(tickets.map(t => t.dateStr).filter(Boolean))).sort();
        setAvailableDates(dates);
        // if current selectedDate is not in availableDates, set to latest available
        if (dates.length && !dates.includes(selectedDate)) {
          setSelectedDate(dates[dates.length - 1]);
        }
      } catch (err) {
        // don't block UI on failure to fetch available dates
        console.debug('Could not load available dates for reconciliation', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const toggleCauldron = (cauldronId) => {
    setExpandedCauldrons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cauldronId)) {
        newSet.delete(cauldronId);
      } else {
        newSet.add(cauldronId);
      }
      return newSet;
    });
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden">
      <div className="p-4 bg-white/5 border-b border-white/20">
        <h2 className="text-xl font-bold text-white">🔍 Discrepancy Detection & Reconciliation</h2>
      </div>
      
      <div className="p-6">
        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Select Date
            </label>
            {availableDates && availableDates.length > 0 ? (
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-purple-800 border border-purple-600 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {availableDates.map(d => (
                  <option key={d} value={d} className="bg-purple-800 text-white">{d}</option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-purple-800 border border-purple-600 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            )}
          </div>
          <div className="flex items-end">
            <button
              onClick={handleReconcile}
              disabled={loading}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded shadow-lg transition"
            >
              {loading ? 'Analyzing...' : 'Run Reconciliation'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 p-4 rounded mb-6">
            Error: {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-3">Summary for {results.date}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-purple-200">Total Cauldrons</div>
                  <div className="text-2xl font-bold text-white">{results.details.length}</div>
                </div>
                <div>
                  <div className="text-xs text-purple-200">Total Drained (est)</div>
                  <div className="text-2xl font-bold text-white">{results.match.totalDrained.toFixed(2)} L</div>
                </div>
                <div>
                  <div className="text-xs text-purple-200">Total Tickets</div>
                  <div className="text-2xl font-bold text-white">{results.match.ticketSum.toFixed(2)} L</div>
                </div>
                <div>
                  <div className="text-xs text-purple-200">Reconciled</div>
                  <div className={`text-2xl font-bold ${results.match.ok ? 'text-green-400' : 'text-red-400'}`}>{results.match.ok ? 'OK' : 'MISMATCH'}</div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Cauldron</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Estimated Drained (L)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Fill Rate (L/min)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Drain Periods</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Tickets</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {results.details.map((detail) => (
                    <tr key={detail.cauldron_id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{detail.cauldron_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-white font-semibold">{(detail.drained || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-purple-200">{(detail.fillRate || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-purple-200">{detail.events.length}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${detail.ticketCount === 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {detail.ticketCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Discrepancies summary */}
            <div className="mt-4 p-4 bg-white/5 border border-white/20 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-2">Discrepancies</h3>
              <div className="text-sm text-purple-200 mb-3">Found: <span className="font-bold text-white">{results.discrepancies.length}</span> cauldrons with discrepancies</div>
              {results.ticketsWithoutCauldron > 0 && (
                <div className="text-sm text-yellow-300 mb-3">{results.ticketsWithoutCauldron} ticket(s) without cauldron id — unable to match</div>
              )}
              {results.discrepancies.length === 0 ? (
                <div className="text-sm text-green-300">No per-cauldron discrepancies detected (within tolerance).</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/20">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200 w-12"></th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200">Cauldron</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200">Drained (L)</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200">Ticketed (L)</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200">Diff (L)</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200">Tickets</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {results.discrepancies.map(d => (
                        <>
                          <tr key={d.cauldron_id} className="hover:bg-white/5">
                            <td className="px-4 py-2">
                              <button
                                onClick={() => toggleCauldron(d.cauldron_id)}
                                className="text-purple-300 hover:text-purple-100 transition"
                              >
                                {expandedCauldrons.has(d.cauldron_id) ? '▼' : '▶'}
                              </button>
                            </td>
                            <td className="px-4 py-2 text-sm text-white font-medium">{d.cauldron_id}</td>
                            <td className="px-4 py-2 text-sm text-purple-200">{d.drained.toFixed(2)}</td>
                            <td className="px-4 py-2 text-sm text-purple-200">{d.ticketed.toFixed(2)}</td>
                            <td className={"px-4 py-2 text-sm font-semibold " + (Math.abs(d.diff) < 1 ? 'text-green-400' : 'text-red-400')}>{d.diff.toFixed(2)}</td>
                            <td className="px-4 py-2 text-sm text-purple-200">{d.tickets.length}</td>
                          </tr>
                          {expandedCauldrons.has(d.cauldron_id) && (
                            <tr key={`${d.cauldron_id}-details`}>
                              <td colSpan="6" className="px-4 py-3 bg-white/5">
                                <div className="pl-8">
                                  <h4 className="text-sm font-semibold text-white mb-2">Discrepancy Details:</h4>
                                  <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
                                    <div className="text-sm">
                                      <div className="text-red-300 font-semibold mb-1">
                                        ⚠️ {d.diff > 0 ? 'Over-Collection Detected' : 'Under-Collection or Theft Detected'}
                                      </div>
                                      <div className="text-white">
                                        {d.diff > 0 
                                          ? `${d.ticketed.toFixed(2)}L was ticketed but only ${d.drained.toFixed(2)}L was estimated to have drained. Excess: ${d.diff.toFixed(2)}L`
                                          : `${d.drained.toFixed(2)}L was estimated to have drained but only ${d.ticketed.toFixed(2)}L was ticketed. Missing: ${Math.abs(d.diff).toFixed(2)}L`
                                        }
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <h4 className="text-sm font-semibold text-white mb-2">Associated Tickets ({d.tickets.length}):</h4>
                                  {d.tickets.length === 0 ? (
                                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                                      <div className="text-sm text-yellow-300">
                                        🚨 <strong>No tickets found for this cauldron!</strong>
                                        <div className="mt-1 text-yellow-200">
                                          This cauldron had {d.drained.toFixed(2)}L drained but no collection tickets were issued. This could indicate:
                                        </div>
                                        <ul className="mt-2 ml-4 list-disc text-yellow-200">
                                          <li>Unauthorized collection (theft)</li>
                                          <li>Missing or lost ticket documentation</li>
                                          <li>System error in ticket recording</li>
                                        </ul>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {d.tickets.map((ticket, idx) => {
                                        const ticketId = ticket.id || ticket.ticket_id || ticket.ticketId || `ticket-${idx}`;
                                        const amount = Number(ticket.amount ?? ticket.amount_collected ?? ticket.amountCollected ?? ticket.volume ?? 0);
                                        const timestamp = ticket.timestamp || ticket.time || ticket.date || 'Unknown';
                                        const destination = ticket.destination || ticket.market || ticket.to || 'Unknown';
                                        
                                        return (
                                          <div key={ticketId} className="bg-white/5 border border-white/10 rounded p-3 text-sm">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                              <div>
                                                <span className="text-purple-300">Ticket ID:</span>
                                                <span className="text-white ml-2">{ticketId}</span>
                                              </div>
                                              <div>
                                                <span className="text-purple-300">Amount:</span>
                                                <span className="text-white ml-2 font-semibold">{amount.toFixed(2)} L</span>
                                              </div>
                                              <div>
                                                <span className="text-purple-300">Time:</span>
                                                <span className="text-white ml-2">{new Date(timestamp).toLocaleTimeString()}</span>
                                              </div>
                                              <div>
                                                <span className="text-purple-300">Destination:</span>
                                                <span className="text-white ml-2">{destination}</span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {!results && !loading && (
          <div className="text-center py-12 text-purple-300">
            Select a date and click "Run Reconciliation" to detect discrepancies
          </div>
        )}
      </div>
    </div>
  );
}

export default ReconciliationPanel;
