
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import CauldronTable from './components/CauldronTable';
import TicketTable from './components/TicketTable';
import LevelChart from './components/LevelChart';
import ReconciliationPanel from './components/ReconciliationPanel';
import MapView from './components/MapView';
import CauldronDetail from './components/CauldronDetail';
import { computePerCauldronSeries, aggregateDrainsPerCauldron } from './utils/reconciliation';

function Dashboard() {
  const [cauldrons, setCauldrons] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [levels, setLevels] = useState([]);
  // full historical level records (used for time slider)
  const [allLevels, setAllLevels] = useState([]);
  const [timeIndex, setTimeIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // fetch latest for summary widgets and full history for the time slider
      const errors = [];

      let cauldronData = [];
      try {
        const r = await fetch('/api/cauldrons');
        if (!r.ok) throw new Error(`status ${r.status}`);
        cauldronData = await r.json();
      } catch (e) {
        errors.push(`cauldrons: ${e.message}`);
      }

      let ticketData = [];
      try {
        const r = await fetch('/api/tickets');
        if (!r.ok) throw new Error(`status ${r.status}`);
        ticketData = await r.json();
        // debug: log what we received from the tickets endpoint
        try {
          console.debug('fetch /api/tickets ->', Array.isArray(ticketData) ? `array(${ticketData.length})` : typeof ticketData, ticketData);
        } catch (e) {
          console.debug('fetch /api/tickets -> (failed to stringify)', e);
        }
      } catch (e) {
        errors.push(`tickets: ${e.message}`);
      }

      let latestLevels = [];
      try {
        const r = await fetch('/api/levels/latest');
        if (!r.ok) throw new Error(`status ${r.status}`);
        latestLevels = await r.json();
      } catch (e) {
        errors.push(`levels/latest: ${e.message}`);
      }

      let historyLevels = [];
      try {
        const r = await fetch('/api/levels?start_date=0&end_date=2000000000');
        if (!r.ok) throw new Error(`status ${r.status}`);
        historyLevels = await r.json();
      } catch (e) {
        errors.push(`levels/history: ${e.message}`);
      }

      // compute fill rates from historical level data and merge into cauldron objects
      let enrichedCauldrons = cauldronData || [];
      try {
        const byId = computePerCauldronSeries(historyLevels || []);
        const perCauldronAgg = aggregateDrainsPerCauldron(byId);
        enrichedCauldrons = (cauldronData || []).map(c => ({
          ...c,
          fillRate: perCauldronAgg[c.id || c.cauldronId || c.cauldron_id]?.fillRate ?? c.fillRate ?? c.fill_rate ?? 0
        }));
      } catch (e) {
        console.warn('Failed to compute per-cauldron fill rates:', e);
      }

  setCauldrons(enrichedCauldrons);
  // handle wrapper shapes from backend (some endpoints return { value: [...] } or { transport_tickets: [...] })
  setTickets(
    Array.isArray(ticketData)
      ? ticketData
      : (ticketData?.tickets || ticketData?.value || ticketData?.transport_tickets || [])
  );
      setLevels(latestLevels || []);
      setAllLevels(historyLevels || []);

      if (errors.length) {
        throw new Error('Failed to fetch: ' + errors.join('; '));
      }
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  // derive sorted unique minute timestamps from allLevels
  const timestamps = useMemo(() => {
    if (!allLevels || allLevels.length === 0) return [];
    const mins = new Set();
    allLevels.forEach(r => {
      const raw = r.timestamp || r.date || r.time;
      const ts = raw ? new Date(raw).getTime() : NaN;
      if (!isNaN(ts)) {
        const minute = Math.floor(ts / 60000) * 60000;
        mins.add(minute);
      }
    });
    return Array.from(mins).sort((a, b) => a - b);
  }, [allLevels]);

  // default timeIndex to latest minute
  useEffect(() => {
    if (timestamps.length > 0 && timeIndex === null) {
      setTimeIndex(timestamps.length - 1);
    }
  }, [timestamps, timeIndex]);

  // compute snapshot of levels for the selected minute
  const levelsAtSelectedTime = useMemo(() => {
    if (!timestamps || timestamps.length === 0 || timeIndex === null) return levels;
    const selectedMinute = timestamps[timeIndex];
    return allLevels.filter(r => {
      const raw = r.timestamp || r.date || r.time;
      const ts = raw ? new Date(raw).getTime() : NaN;
      return !isNaN(ts) && Math.floor(ts / 60000) * 60000 === selectedMinute;
    });
  }, [allLevels, timestamps, timeIndex, levels]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                🧙‍♀️ PotionFlow Monitoring Dashboard
              </h1>
              <p className="text-purple-200">Real-time potion tracking and discrepancy detection</p>
            </div>
            <Link
              to="/map"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition shadow-lg"
            >
              🗺️ View Map
            </Link>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500 text-white p-4 rounded-lg mb-6 shadow-lg">
            <p className="font-semibold">⚠️ Error: {error}</p>
            <button 
              onClick={fetchData}
              className="mt-2 px-4 py-2 bg-red-700 hover:bg-red-600 rounded transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-300 border-t-white"></div>
            <p className="text-white mt-4">Loading potion data...</p>
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && (
          <>
            

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/20">
                <div className="text-purple-200 text-sm font-semibold">Total Cauldrons</div>
                <div className="text-3xl font-bold text-white mt-2">{cauldrons.length}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/20">
                <div className="text-purple-200 text-sm font-semibold">Active Levels</div>
                <div className="text-3xl font-bold text-white mt-2">{levels.length}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/20">
                <div className="text-purple-200 text-sm font-semibold">Transport Tickets</div>
                <div className="text-3xl font-bold text-white mt-2">{tickets.length}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg shadow-lg border border-white/20">
                <div className="text-purple-200 text-sm font-semibold">Status</div>
                <div className="text-2xl font-bold text-green-400 mt-2">✓ Online</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-6">
              <div className="flex gap-2 bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20">
                {['overview', 'cauldrons', 'tickets', 'reconcile'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 px-4 rounded transition font-semibold ${
                      activeTab === tab
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'text-purple-200 hover:bg-white/10'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <CauldronTable cauldrons={cauldrons} levels={levelsAtSelectedTime} />
                  <LevelChart levels={levelsAtSelectedTime} />
                </div>
              )}
              
              {activeTab === 'cauldrons' && (
                <CauldronTable cauldrons={cauldrons} levels={levelsAtSelectedTime} detailed />
              )}
              
              {activeTab === 'tickets' && (
                <TicketTable tickets={tickets} />
              )}
              
              {activeTab === 'reconcile' && (
                <ReconciliationPanel />
              )}
            </div>
            {/* Time slider (if history available) - moved to bottom */}
            {timestamps.length > 0 && (
              <div className="mt-6 bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-purple-200 block">Time</label>
                    <div className="text-white font-semibold">
                      {timeIndex !== null && timestamps[timeIndex]
                        ? new Date(timestamps[timeIndex]).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, timestamps.length - 1)}
                      value={timeIndex ?? 0}
                      onChange={(e) => setTimeIndex(parseInt(e.target.value, 10))}
                      className="w-full"
                    />
                    <div className="text-xs text-purple-300 mt-2 flex justify-between">
                      <span>{timestamps.length ? new Date(timestamps[0]).toLocaleString() : ''}</span>
                      <span>{timestamps.length ? new Date(timestamps[timestamps.length - 1]).toLocaleString() : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/cauldron/:id" element={<CauldronDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
