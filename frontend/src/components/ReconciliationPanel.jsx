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
  const [cauldrons, setCauldrons] = useState([]);

  // Fetch cauldron info for names
  useEffect(() => {
    fetch('/api/cauldrons')
      .then(res => res.json())
      .then(data => setCauldrons(data || []))
      .catch(err => console.warn('Failed to load cauldron names:', err));
  }, []);

  // Helper to get cauldron name from ID
  const getCauldronName = (id) => {
    const cauldron = cauldrons.find(c => 
      c.id === id || c.cauldronId === id || c.cauldron_id === id
    );
    return cauldron?.name || cauldron?.cauldronName || id;
  };

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
          // Match tickets to drain events with improved time estimation
          const ticketsForCauldron = ticketsByCauldronDetails[id] || [];
          const drainEvents = info.events || [];
          
          if (id === 'cauldron_010' || id === 'cauldron_003') {
            console.log(`${id}: ${drainEvents.length} drain events, ${ticketsForCauldron.length} tickets`);
          }
          
          // Sort tickets by ticket ID (numerically) to get issuance order
          const sortedTickets = [...ticketsForCauldron].sort((a, b) => {
            const idA = parseInt((a.ticket_id || a.id || '').replace(/\D/g, ''), 10) || 0;
            const idB = parseInt((b.ticket_id || b.id || '').replace(/\D/g, ''), 10) || 0;
            return idA - idB;
          });
          
          // If we have drain events, distribute tickets across them
          let ticketsWithTimes;
          
          if (drainEvents.length === 0) {
            ticketsWithTimes = sortedTickets.map(ticket => ({ ...ticket, estimatedCollectionTime: null }));
          } else if (drainEvents.length === 1) {
            // Single drain event: distribute tickets proportionally across its duration
            const event = drainEvents[0];
            const duration = event.endTs - event.startTs;
            
            ticketsWithTimes = sortedTickets.map((ticket, ticketIdx) => {
              const proportion = ticketIdx / Math.max(1, sortedTickets.length - 1);
              const estimatedTime = event.startTs + (duration * proportion);
              
              if (id === 'cauldron_003' || id === 'cauldron_010') {
                console.log(`${id} ticket ${ticketIdx}/${sortedTickets.length - 1}: proportion=${proportion.toFixed(2)}, duration=${duration/60000}min, time=${new Date(estimatedTime).toLocaleTimeString()}`);
              }
              
              return { ...ticket, estimatedCollectionTime: estimatedTime };
            });
          } else {
            // Multiple drain events: match by volume similarity with ticket order as tiebreaker
            const sortedDrains = [...drainEvents].sort((a, b) => a.startTs - b.startTs);
            
            if (id === 'cauldron_001' || id === 'cauldron_003' || id === 'cauldron_010') {
              console.log(`${id}: Drain events:`, sortedDrains.map(e => ({
                start: new Date(e.startTs).toLocaleString(),
                end: new Date(e.endTs).toLocaleString(),
                drop: e.drop.toFixed(2)
              })));
            }
            
            // Get the ticket date to filter drains - only match drains from the same day
            const ticketDate = selectedDate; // The date being reconciled
            const ticketDayStart = new Date(ticketDate + 'T00:00:00').getTime();
            const ticketDayEnd = new Date(ticketDate + 'T23:59:59').getTime();
            
            const usedEvents = new Set();
            
            ticketsWithTimes = sortedTickets.map((ticket, ticketIdx) => {
              const ticketAmount = Number(ticket.amount ?? ticket.amount_collected ?? ticket.amountCollected ?? ticket.volume ?? 0);
              let bestEvent = null;
              let bestDiff = Infinity;
              
              // Find best matching drain event that hasn't been used
              sortedDrains.forEach((event, drainIdx) => {
                if (usedEvents.has(event)) return;
                
                // Only match to drains that started on the same day as the ticket
                if (event.startTs < ticketDayStart || event.startTs > ticketDayEnd) return;
                
                const correctedDrain = event.drop + (info.fillRate || 0) * ((event.endTs - event.startTs) / 60000);
                const volumeDiff = Math.abs(correctedDrain - ticketAmount);
                
                // If volumes are very similar (within 0.1L), use chronological order as tiebreaker
                if (volumeDiff < 0.1 && bestDiff < 0.1) {
                  // Both are good matches, prefer chronological order (earlier drain for earlier ticket)
                  const currentDrainIdx = sortedDrains.indexOf(event);
                  const bestDrainIdx = sortedDrains.indexOf(bestEvent);
                  if (currentDrainIdx === ticketIdx && bestDrainIdx !== ticketIdx) {
                    bestDiff = volumeDiff;
                    bestEvent = event;
                  }
                } else if (volumeDiff < bestDiff) {
                  bestDiff = volumeDiff;
                  bestEvent = event;
                }
              });
              
              // If all events used, pick closest by volume (still filtered by date)
              if (!bestEvent) {
                sortedDrains.forEach(event => {
                  // Only match to drains that started on the same day as the ticket
                  if (event.startTs < ticketDayStart || event.startTs > ticketDayEnd) return;
                  
                  const correctedDrain = event.drop + (info.fillRate || 0) * ((event.endTs - event.startTs) / 60000);
                  const volumeDiff = Math.abs(correctedDrain - ticketAmount);
                  if (volumeDiff < bestDiff) {
                    bestDiff = volumeDiff;
                    bestEvent = event;
                  }
                });
              } else {
                usedEvents.add(bestEvent);
              }
              
              const estimatedTime = bestEvent 
                ? bestEvent.startTs + (bestEvent.endTs - bestEvent.startTs) / 2
                : null;
              
              if (id === 'cauldron_003' || id === 'cauldron_010' || id === 'cauldron_001') {
                const eventVol = bestEvent ? (bestEvent.drop + (info.fillRate || 0) * ((bestEvent.endTs - bestEvent.startTs) / 60000)).toFixed(2) : 'none';
                const timeStr = estimatedTime ? new Date(estimatedTime).toLocaleTimeString() : 'none';
                const dateStr = estimatedTime ? new Date(estimatedTime).toLocaleDateString() : 'none';
                const eventStart = bestEvent ? new Date(bestEvent.startTs).toLocaleString() : 'none';
                console.log(`${id} ticket ${ticketIdx} (${ticketAmount.toFixed(2)}L): matched to drain with ${eventVol}L (diff=${bestDiff.toFixed(2)}L), event: ${eventStart}, estimated time=${dateStr} ${timeStr}`);
              }
              
              return {
                ...ticket,
                estimatedCollectionTime: estimatedTime
              };
            });
          }
          
          // Post-process: Fix chronological order for tickets with identical volumes
          // Group tickets by volume and ensure they're in chronological order by time
          const volumeGroups = new Map();
          ticketsWithTimes.forEach((ticket, idx) => {
            const vol = Number(ticket.amount ?? ticket.amount_collected ?? ticket.amountCollected ?? ticket.volume ?? 0);
            const key = vol.toFixed(2); // Group by volume rounded to 2 decimals
            if (!volumeGroups.has(key)) {
              volumeGroups.set(key, []);
            }
            volumeGroups.get(key).push({ ticket, idx });
          });
          
          // For each volume group with multiple tickets, ensure times are in order
          volumeGroups.forEach((group, vol) => {
            if (group.length > 1) {
              if (id === 'cauldron_001' || id === 'cauldron_003' || id === 'cauldron_010') {
                console.log(`${id}: Found ${group.length} tickets with volume ${vol}L`);
                group.forEach(g => {
                  console.log(`  Ticket ${g.ticket.ticket_id || g.ticket.id}: ${new Date(g.ticket.estimatedCollectionTime).toLocaleTimeString()}`);
                });
              }
              
              // Sort by original ticket order (already sorted by ticket date/number)
              const sortedByTicketNum = [...group].sort((a, b) => {
                const numA = parseInt((a.ticket.ticket_id || a.ticket.id || '').replace(/\D/g, ''), 10) || 0;
                const numB = parseInt((b.ticket.ticket_id || b.ticket.id || '').replace(/\D/g, ''), 10) || 0;
                return numA - numB;
              });
              // Get their estimated times
              const times = sortedByTicketNum.map(g => g.ticket.estimatedCollectionTime).filter(t => t !== null);
              
              if (times.length > 1) {
                if (id === 'cauldron_001' || id === 'cauldron_003' || id === 'cauldron_010') {
                  console.log(`${id}: Times BEFORE sort:`, times.map(t => new Date(t).toLocaleTimeString()));
                  console.log(`${id}: Times BEFORE sort (raw):`, times);
                }
                
                // Sort times chronologically
                const sortedTimes = [...times].sort((a, b) => a - b);
                
                if (id === 'cauldron_001' || id === 'cauldron_003' || id === 'cauldron_010') {
                  console.log(`${id}: Times AFTER sort:`, sortedTimes.map(t => new Date(t).toLocaleTimeString()));
                  console.log(`${id}: Times AFTER sort (raw):`, sortedTimes);
                  console.log(`${id}: Assigning to tickets in order:`, sortedByTicketNum.map(g => g.ticket.ticket_id || g.ticket.id));
                }
                
                // Reassign times in chronological order to tickets in ticket number order
                sortedByTicketNum.forEach((item, i) => {
                  if (i < sortedTimes.length) {
                    const oldTime = ticketsWithTimes[item.idx].estimatedCollectionTime;
                    const newTime = sortedTimes[i];
                    ticketsWithTimes[item.idx].estimatedCollectionTime = newTime;
                    if (id === 'cauldron_001' || id === 'cauldron_003' || id === 'cauldron_010') {
                      console.log(`${id}: Ticket ${item.ticket.ticket_id} at idx ${item.idx}: ${new Date(oldTime).toLocaleString()} -> ${new Date(newTime).toLocaleString()}`);
                    }
                  }
                });
                
                if (id === 'cauldron_001' || id === 'cauldron_003' || id === 'cauldron_010') {
                  console.log(`${id}: After fixing:`);
                  sortedByTicketNum.forEach((item, i) => {
                    console.log(`  Ticket ${item.ticket.ticket_id || item.ticket.id}: ${new Date(sortedTimes[i]).toLocaleTimeString()}`);
                  });
                }
              }
            }
          });
          
          // Sort tickets by estimated collection time for display
          ticketsWithTimes.sort((a, b) => {
            if (!a.estimatedCollectionTime && !b.estimatedCollectionTime) return 0;
            if (!a.estimatedCollectionTime) return 1;
            if (!b.estimatedCollectionTime) return -1;
            return a.estimatedCollectionTime - b.estimatedCollectionTime;
          });
          
          discrepancies.push({ 
            cauldron_id: id, 
            drained, 
            ticketed, 
            diff,
            tickets: ticketsWithTimes
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
                        <div className="text-sm font-medium text-white">{getCauldronName(detail.cauldron_id)}</div>
                        <div className="text-xs text-purple-300">{detail.cauldron_id}</div>
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
                            <td className="px-4 py-2 text-sm text-white font-medium">{getCauldronName(d.cauldron_id)}</td>
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
                                        ⚠️ {d.diff > 0 ? 'Over-Collection Detected' : d.drained === 0 ? 'No Drain Detected - Possible Fraud' : 'Under-Collection or Theft Detected'}
                                      </div>
                                      <div className="text-white">
                                        {d.diff > 0 
                                          ? `${d.ticketed.toFixed(2)}L was ticketed but only ${d.drained.toFixed(2)}L was estimated to have drained. Excess: ${d.diff.toFixed(2)}L`
                                          : d.drained === 0
                                          ? `${d.ticketed.toFixed(2)}L was ticketed but monitoring system detected NO volume decrease. This could indicate fraudulent tickets, sensor malfunction, or missing data.`
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
                                        const courierId = ticket.courier_id || ticket.courierId || ticket.courier || 'Unknown';
                                        const estimatedTime = ticket.estimatedCollectionTime;
                                        
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
                                                <span className="text-purple-300">Est. Time:</span>
                                                <span className="text-white ml-2">
                                                  {estimatedTime ? new Date(estimatedTime).toLocaleTimeString() : 'Unknown'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-purple-300">Courier:</span>
                                                <span className="text-white ml-2">{courierId}</span>
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
