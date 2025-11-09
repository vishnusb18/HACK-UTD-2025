import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CauldronTable from './components/CauldronTable';
import TicketTable from './components/TicketTable';
import LevelChart from './components/LevelChart';
import ReconciliationPanel from './components/ReconciliationPanel';
import MapView from './components/MapView';
import CauldronDetail from './components/CauldronDetail';

function Dashboard() {
  const [cauldrons, setCauldrons] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cauldronRes, ticketRes, levelRes] = await Promise.all([
        fetch('/api/cauldrons'),
        fetch('/api/tickets'),
        fetch('/api/levels/latest')
      ]);

      if (!cauldronRes.ok || !ticketRes.ok || !levelRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const cauldronData = await cauldronRes.json();
      const ticketData = await ticketRes.json();
      const levelData = await levelRes.json();

      setCauldrons(cauldronData);
      setTickets(ticketData);
      setLevels(levelData);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

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
                  <CauldronTable cauldrons={cauldrons} levels={levels} />
                  <LevelChart levels={levels} />
                </div>
              )}
              
              {activeTab === 'cauldrons' && (
                <CauldronTable cauldrons={cauldrons} levels={levels} detailed />
              )}
              
              {activeTab === 'tickets' && (
                <TicketTable tickets={tickets} />
              )}
              
              {activeTab === 'reconcile' && (
                <ReconciliationPanel />
              )}
            </div>
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
