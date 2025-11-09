import { useState, useEffect } from 'react';
import {
  fetchLevelsForDay,
  computePerCauldronSeries,
  aggregateDrainsPerCauldron
} from '../utils/reconciliation';

function TicketTable({ tickets }) {
  const [filterCauldron, setFilterCauldron] = useState('');
  const [cauldrons, setCauldrons] = useState([]);
  const [network, setNetwork] = useState({ edges: [] });
  const [levelsCache, setLevelsCache] = useState({}); // Cache levels by date

  // Fetch cauldron and network data for validation
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cauldronRes, networkRes] = await Promise.all([
          fetch('/api/cauldrons'),
          fetch('/api/information/network')
        ]);
        
        if (cauldronRes.ok) {
          const cauldronData = await cauldronRes.json();
          setCauldrons(cauldronData || []);
        }
        
        if (networkRes.ok) {
          const networkData = await networkRes.json();
          setNetwork(networkData || { edges: [] });
        }
      } catch (err) {
        console.error('Error fetching validation data:', err);
      }
    };
    
    fetchData();
  }, []);

  // Fetch and cache level data for dates we have tickets for
  useEffect(() => {
    const fetchLevelsForTickets = async () => {
      const allTickets = Array.isArray(tickets) ? tickets : [];
      const uniqueDates = [...new Set(allTickets.map(t => {
        const dateSource = t.dateStr || t.date || t.timestamp || t.createdAt || '';
        try {
          if (dateSource) {
            const d = new Date(dateSource);
            if (!isNaN(d)) return d.toISOString().split('T')[0];
          }
        } catch (e) {}
        return null;
      }).filter(Boolean))];

      const newCache = {};
      for (const date of uniqueDates) {
        try {
          const levels = await fetchLevelsForDay(date);
          const byId = computePerCauldronSeries(levels || []);
          const perCauldron = aggregateDrainsPerCauldron(byId);
          newCache[date] = perCauldron;
        } catch (err) {
          console.warn(`Failed to fetch levels for ${date}:`, err);
        }
      }
      setLevelsCache(newCache);
    };

    if (tickets && tickets.length > 0) {
      fetchLevelsForTickets();
    }
  }, [tickets]);

  const allTickets = Array.isArray(tickets) ? tickets : [];

  const filteredTickets = allTickets.filter(ticket => {
    const cauldronId = ticket.cauldronId || ticket.cauldron_id || ticket.cauldron;
    return filterCauldron === '' || cauldronId === filterCauldron;
  });

  const uniqueCauldrons = [...new Set(allTickets.map(t => t.cauldronId || t.cauldron_id || t.cauldron).filter(Boolean))];

  // Helper function to estimate collection time by matching ticket to drain events
  const estimateCollectionTime = (ticket, dateKey) => {
    const cauldronId = ticket.cauldronId || ticket.cauldron_id || ticket.cauldron;
    const ticketAmount = Number(ticket.volume ?? ticket.volumeCollected ?? ticket.volume_collected ?? ticket.amount_collected ?? ticket.amount ?? 0);
    
    // Get drain events for this cauldron on this date
    const perCauldron = levelsCache[dateKey];
    if (!perCauldron || !perCauldron[cauldronId]) {
      return null;
    }
    
    const info = perCauldron[cauldronId];
    const drainEvents = info.events || [];
    
    if (drainEvents.length === 0) {
      return null;
    }
    
    // Filter drains to only those on the ticket's date
    const ticketDayStart = new Date(dateKey + 'T00:00:00').getTime();
    const ticketDayEnd = new Date(dateKey + 'T23:59:59').getTime();
    const relevantDrains = drainEvents.filter(e => 
      e.startTs >= ticketDayStart && e.startTs <= ticketDayEnd
    );
    
    if (relevantDrains.length === 0) {
      return null;
    }
    
    // Find best matching drain event by volume
    let bestEvent = null;
    let bestDiff = Infinity;
    
    relevantDrains.forEach(event => {
      const correctedDrain = event.drop + (info.fillRate || 0) * ((event.endTs - event.startTs) / 60000);
      const volumeDiff = Math.abs(correctedDrain - ticketAmount);
      
      if (volumeDiff < bestDiff) {
        bestDiff = volumeDiff;
        bestEvent = event;
      }
    });
    
    if (bestEvent) {
      // Return midpoint of drain event
      return bestEvent.startTs + (bestEvent.endTs - bestEvent.startTs) / 2;
    }
    
    return null;
  };

  // Helper function to detect flags/issues with a ticket (enhanced with reconciliation logic)
  const detectTicketFlags = (ticket, dateKey) => {
    const flags = [];
    const cauldronId = ticket.cauldronId || ticket.cauldron_id || ticket.cauldron;
    const volume = Number(ticket.volume ?? ticket.volumeCollected ?? ticket.volume_collected ?? ticket.amount_collected ?? ticket.amount ?? 0);
    
    // Find corresponding cauldron
    const cauldron = cauldrons.find(c => 
      c.id === cauldronId || c.cauldronId === cauldronId || c.cauldron_id === cauldronId
    );
    
    if (!cauldron) {
      flags.push({ type: 'error', message: 'Cauldron not found in system' });
      return flags;
    }
    
    const maxVolume = cauldron.maxVolume || cauldron.max_volume || 1000;
    const fillRate = cauldron.fillRate || cauldron.fill_rate || 0;
    
    // Flag 1: Volume exceeds 100L (witch capacity)
    if (volume > 100) {
      flags.push({ type: 'warning', message: `Exceeds witch capacity (${volume.toFixed(1)}L > 100L)` });
    }
    
    // Flag 2: Volume exceeds cauldron max capacity
    if (volume > maxVolume) {
      flags.push({ type: 'error', message: `Exceeds cauldron capacity (${volume.toFixed(1)}L > ${maxVolume}L)` });
    }
    
    // Flag 3: Volume is suspiciously low (< 5L)
    if (volume > 0 && volume < 5) {
      flags.push({ type: 'info', message: `Low volume (${volume.toFixed(1)}L)` });
    }
    
    // Flag 4: Volume is zero or negative
    if (volume <= 0) {
      flags.push({ type: 'error', message: 'Invalid volume (≤0)' });
    }
    
    // Flag 5: Near-overflow collection
    if (volume > maxVolume * 0.8) {
      flags.push({ type: 'warning', message: 'Near-overflow collection (>80%)' });
    }
    
    // Flag 6: Check discrepancy with actual drain events
    const perCauldron = levelsCache[dateKey];
    if (perCauldron && perCauldron[cauldronId]) {
      const info = perCauldron[cauldronId];
      const drainEvents = info.events || [];
      
      // Filter to drains on this date
      const ticketDayStart = new Date(dateKey + 'T00:00:00').getTime();
      const ticketDayEnd = new Date(dateKey + 'T23:59:59').getTime();
      const relevantDrains = drainEvents.filter(e => 
        e.startTs >= ticketDayStart && e.startTs <= ticketDayEnd
      );
      
      if (relevantDrains.length > 0) {
        // Find closest matching drain
        let closestDrain = null;
        let minDiff = Infinity;
        
        relevantDrains.forEach(event => {
          const correctedDrain = event.drop + (info.fillRate || 0) * ((event.endTs - event.startTs) / 60000);
          const diff = Math.abs(correctedDrain - volume);
          if (diff < minDiff) {
            minDiff = diff;
            closestDrain = correctedDrain;
          }
        });
        
        // Flag if discrepancy is > 15%
        if (closestDrain !== null) {
          const threshold = Math.max(1, 0.15 * Math.max(volume, closestDrain));
          if (minDiff > threshold) {
            const diffPercent = ((minDiff / Math.max(volume, closestDrain)) * 100).toFixed(0);
            flags.push({ 
              type: 'warning', 
              message: `Volume mismatch: ticket ${volume.toFixed(1)}L vs drain ${closestDrain.toFixed(1)}L (${diffPercent}% diff)` 
            });
          }
        }
      } else {
        // Ticket exists but no drain detected
        flags.push({ type: 'error', message: 'No matching drain event detected' });
      }
    }
    
    return flags;
  };

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

  // sorted date keys (ascending)
  const sortedDateKeys = Object.keys(ticketsByDate).sort((a, b) => a.localeCompare(b));

  const [expandedDays, setExpandedDays] = useState({});

  // Calculate total flags across all tickets
  const totalFlagStats = (() => {
    let total = 0;
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    
    Object.entries(ticketsByDate).forEach(([dateKey, rows]) => {
      rows.forEach(r => {
        if (filterCauldron === '' || r.cauldronId === filterCauldron) {
          const flags = detectTicketFlags(r.original, dateKey);
          total += flags.length;
          errors += flags.filter(f => f.type === 'error').length;
          warnings += flags.filter(f => f.type === 'warning').length;
          infos += flags.filter(f => f.type === 'info').length;
        }
      });
    });
    
    return { total, errors, warnings, infos };
  })();

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden">
      {/* Debug panel removed for production - TicketTable now renders normalized data */}
      <div className="p-4 bg-white/5 border-b border-white/20">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Transport Tickets</h2>
            {totalFlagStats.total > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 rounded bg-red-500/20 border border-red-500/30">
                <span className="text-sm font-semibold">
                  {totalFlagStats.errors > 0 && (
                    <span className="text-red-400">❌ {totalFlagStats.errors}</span>
                  )}
                  {totalFlagStats.errors > 0 && totalFlagStats.warnings > 0 && (
                    <span className="text-purple-300 mx-1">•</span>
                  )}
                  {totalFlagStats.warnings > 0 && (
                    <span className="text-yellow-400">⚠️ {totalFlagStats.warnings}</span>
                  )}
                  {(totalFlagStats.errors > 0 || totalFlagStats.warnings > 0) && totalFlagStats.infos > 0 && (
                    <span className="text-purple-300 mx-1">•</span>
                  )}
                  {totalFlagStats.infos > 0 && (
                    <span className="text-blue-400">ℹ️ {totalFlagStats.infos}</span>
                  )}
                </span>
              </div>
            )}
          </div>
          <select
            value={filterCauldron}
            onChange={(e) => setFilterCauldron(e.target.value)}
            className="bg-purple-800 border border-purple-600 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
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
            
            // Count flags for this date
            let totalFlags = 0;
            let errorCount = 0;
            let warningCount = 0;
            visibleRows.forEach(r => {
              const flags = detectTicketFlags(r.original, dateKey);
              totalFlags += flags.length;
              errorCount += flags.filter(f => f.type === 'error').length;
              warningCount += flags.filter(f => f.type === 'warning').length;
            });
            
            return (
              <div key={dateKey} className="bg-white/5 p-3 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm text-purple-200">Date</div>
                    <div className="text-white font-semibold">{dateKey === 'unknown' ? 'Unknown' : dateKey}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-purple-200">Tickets: <span className="text-white font-semibold">{visibleRows.length}</span></div>
                    {totalFlags > 0 && (
                      <div className="flex items-center gap-2 px-2 py-1 rounded bg-red-500/20 border border-red-500/30">
                        <span className="text-sm text-red-300 font-semibold">
                          {errorCount > 0 && <span className="text-red-400">❌ {errorCount}</span>}
                          {errorCount > 0 && warningCount > 0 && <span className="text-purple-300 mx-1">•</span>}
                          {warningCount > 0 && <span className="text-yellow-400">⚠️ {warningCount}</span>}
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedDays({ ...expandedDays, [dateKey]: !expanded })}
                      className="p-2 bg-transparent hover:bg-purple-700/30 text-white rounded-full"
                      aria-expanded={expanded}
                      title={expanded ? 'Collapse' : 'Expand'}
                    >
                      <svg
                        className={`w-5 h-5 transform transition-transform ${expanded ? '-rotate-90' : 'rotate-90'}`}
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path d="M6 4L14 10L6 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-2">
                    {visibleRows.map(r => {
                      const estimatedTime = estimateCollectionTime(r.original, dateKey);
                      const flags = detectTicketFlags(r.original, dateKey);
                      const hasFlags = flags.length > 0;
                      
                      return (
                        <div key={r.ticketId} className={`p-3 rounded border ${hasFlags ? 'bg-red-500/10 border-red-500/30' : 'bg-white/3 border-white/6'}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="text-sm text-purple-200">Cauldron</div>
                              <div className="text-white font-medium">{r.cauldronId || '(unknown)'}</div>
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-sm text-purple-200">Ticket ID</div>
                              <div className="text-white font-mono text-sm">{r.ticketId}</div>
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-sm text-purple-200">Volume</div>
                              <div className="text-white font-semibold">{(r.volumeCollected || 0).toFixed(2)} L</div>
                            </div>
                            <div className="flex-1 text-right">
                              <div className="text-sm text-purple-200">Est. Collection Time</div>
                              <div className="text-white font-semibold text-sm">
                                {estimatedTime !== null 
                                  ? new Date(estimatedTime).toLocaleTimeString('en-US', { 
                                      hour: 'numeric', 
                                      minute: '2-digit',
                                      hour12: true 
                                    })
                                  : 'Unknown'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Flags Section */}
                          {hasFlags && (
                            <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
                              {flags.map((flag, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                  <span className={`flex-shrink-0 font-bold ${
                                    flag.type === 'error' ? 'text-red-400' :
                                    flag.type === 'warning' ? 'text-yellow-400' :
                                    'text-blue-400'
                                  }`}>
                                    {flag.type === 'error' ? '❌' :
                                     flag.type === 'warning' ? '⚠️' : 'ℹ️'}
                                  </span>
                                  <span className={`${
                                    flag.type === 'error' ? 'text-red-300' :
                                    flag.type === 'warning' ? 'text-yellow-300' :
                                    'text-blue-300'
                                  }`}>
                                    {flag.message}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
