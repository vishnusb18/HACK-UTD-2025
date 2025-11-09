import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

function CauldronDetail() {
  const { id } = useParams();
  const [cauldron, setCauldron] = useState(null);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');

  useEffect(() => {
    fetchCauldronData();
  }, [id, timeRange]);

  const fetchCauldronData = async () => {
    try {
      setLoading(true);
      
      // Calculate time range
      const now = Math.floor(Date.now() / 1000);
      let from;
      switch (timeRange) {
        case '6h':
          from = now - 6 * 60 * 60;
          break;
        case '12h':
          from = now - 12 * 60 * 60;
          break;
        case '24h':
          from = now - 24 * 60 * 60;
          break;
        case '48h':
          from = now - 48 * 60 * 60;
          break;
        case '7d':
          from = now - 7 * 24 * 60 * 60;
          break;
        default:
          from = now - 24 * 60 * 60;
      }

      const [cauldronRes, levelsRes] = await Promise.all([
        fetch('/api/cauldrons'),
        fetch(`/api/level/${id}?from=${from}&to=${now}`)
      ]);

      if (!cauldronRes.ok || !levelsRes.ok) {
        throw new Error('Failed to fetch cauldron data');
      }

      const allCauldrons = await cauldronRes.json();
      const levelsData = await levelsRes.json();

      const cauldronData = allCauldrons.find(c => 
        (c.id || c.cauldronId || c.cauldron_id) === id
      );

      if (!cauldronData) {
        throw new Error('Cauldron not found');
      }

      setCauldron(cauldronData);
      setLevels(levelsData);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching cauldron detail:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate ETA to overflow
  const calculateOverflowETA = () => {
    if (!cauldron || levels.length < 2) return null;

    const maxVolume = cauldron.maxVolume || cauldron.max_volume || 1000;
    const fillRate = cauldron.fillRate || cauldron.fill_rate || 2;
    const currentVolume = levels[levels.length - 1]?.volume || 0;
    const remainingVolume = maxVolume - currentVolume;

    if (remainingVolume <= 0) return 'OVERFLOW!';
    if (fillRate <= 0) return 'Not filling';

    const minutesToOverflow = remainingVolume / fillRate;
    const hours = Math.floor(minutesToOverflow / 60);
    const minutes = Math.floor(minutesToOverflow % 60);

    if (hours > 48) return `${Math.floor(hours / 24)} days`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} minutes`;
  };

  // Format chart data
  const getChartData = () => {
    return levels.map(level => ({
      timestamp: level.timestamp,
      volume: level.volume || 0,
      time: new Date(level.timestamp).getTime()
    })).sort((a, b) => a.time - b.time);
  };

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-purple-300">
          <p className="text-sm font-semibold text-purple-900">
            {format(new Date(data.timestamp), 'MMM d, yyyy HH:mm')}
          </p>
          <p className="text-lg font-bold text-purple-700 mt-1">
            {data.volume.toFixed(2)} L
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-300 border-t-white"></div>
          <p className="text-white mt-4 text-lg">Loading cauldron data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/20 border border-red-500 text-red-200 p-6 rounded-lg">
            <p className="font-semibold text-lg mb-2">⚠️ Error Loading Cauldron</p>
            <p>{error}</p>
            <div className="mt-4 flex gap-3">
              <button 
                onClick={fetchCauldronData}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
              >
                Retry
              </button>
              <Link
                to="/"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!cauldron) return null;

  const chartData = getChartData();
  const currentVolume = levels.length > 0 ? levels[levels.length - 1]?.volume || 0 : 0;
  const maxVolume = cauldron.maxVolume || cauldron.max_volume || 1000;
  const fillPercentage = (currentVolume / maxVolume) * 100;
  const overflowETA = calculateOverflowETA();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                🔮 {cauldron.name || cauldron.cauldronName || id}
              </h1>
              <p className="text-purple-200 text-sm mt-1 font-mono">{id}</p>
            </div>
            <Link
              to="/"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold transition"
            >
              ← Back
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-purple-200 text-xs font-semibold uppercase">Current Volume</div>
              <div className="text-2xl font-bold text-white mt-1">{currentVolume.toFixed(1)} L</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-purple-200 text-xs font-semibold uppercase">Fill Percentage</div>
              <div className="text-2xl font-bold text-white mt-1">{fillPercentage.toFixed(1)}%</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-purple-200 text-xs font-semibold uppercase">Max Capacity</div>
              <div className="text-2xl font-bold text-white mt-1">{maxVolume} L</div>
            </div>
            <div className={`bg-white/10 rounded-lg p-4 ${fillPercentage > 90 ? 'border-2 border-red-500' : ''}`}>
              <div className="text-purple-200 text-xs font-semibold uppercase">ETA to Overflow</div>
              <div className={`text-2xl font-bold mt-1 ${fillPercentage > 90 ? 'text-red-400' : 'text-white'}`}>
                {overflowETA || 'N/A'}
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-sm">
            <div className="text-purple-200">
              <span className="font-semibold">Fill Rate:</span> {(cauldron.fillRate || cauldron.fill_rate || 0).toFixed(2)} L/min
            </div>
            <div className="text-purple-200">
              <span className="font-semibold">Drain Rate:</span> {(cauldron.drainRate || cauldron.drain_rate || 0).toFixed(2)} L/min
            </div>
            <div className="text-purple-200">
              <span className="font-semibold">Location:</span> {(cauldron.latitude || cauldron.lat || 0).toFixed(4)}, {(cauldron.longitude || cauldron.lon || cauldron.long || 0).toFixed(4)}
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 p-4">
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold">Time Range:</span>
            {['6h', '12h', '24h', '48h', '7d'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded font-semibold transition ${
                  timeRange === range
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/10 text-purple-200 hover:bg-white/20'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 p-6">
          <h2 className="text-xl font-bold text-white mb-4">📊 Potion Level History</h2>
          {chartData.length === 0 ? (
            <div className="text-center py-12 text-purple-300">
              No data available for the selected time range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9333EA40" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(timestamp) => format(new Date(timestamp), 'HH:mm')}
                  stroke="#E9D5FF"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#E9D5FF"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Volume (L)', angle: -90, position: 'insideLeft', fill: '#E9D5FF' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: '#E9D5FF' }} />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="#A855F7"
                  strokeWidth={3}
                  dot={{ fill: '#A855F7', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Potion Volume (L)"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 p-4">
          <div className="flex gap-3">
            <Link
              to="/map"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold transition"
            >
              🗺️ View on Map
            </Link>
            <Link
              to="/"
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded font-semibold transition"
            >
              📊 Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CauldronDetail;