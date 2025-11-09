import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

function MapView() {
  const [market, setMarket] = useState(null);
  const [cauldrons, setCauldrons] = useState([]);
  const [network, setNetwork] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [sampleRoute, setSampleRoute] = useState(null);

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    try {
      setLoading(true);
      const [marketRes, cauldronRes, networkRes, levelsRes] = await Promise.all([
        fetch('/api/information/market'),
        fetch('/api/information/cauldrons'),
        fetch('/api/information/network'),
        fetch('/api/levels/latest')
      ]);

      if (!marketRes.ok || !cauldronRes.ok || !networkRes.ok || !levelsRes.ok) {
        throw new Error('Failed to fetch map data');
      }

      const marketData = await marketRes.json();
      const cauldronData = await cauldronRes.json();
      const networkData = await networkRes.json();
      const levelsData = await levelsRes.json();

      setMarket(marketData);
      setCauldrons(cauldronData);
      setNetwork(networkData.edges || []);
      setLevels(levelsData);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching map data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get fill percentage for a cauldron
  const getCauldronFillPercentage = (cauldronId) => {
    const level = levels.find(l => 
      (l.cauldronId || l.cauldron_id || l.tankId) === cauldronId
    );
    if (!level) return 0;
    
    const cauldron = cauldrons.find(c => 
      (c.id || c.cauldronId || c.cauldron_id) === cauldronId
    );
    if (!cauldron) return 0;
    
    const maxVolume = cauldron.maxVolume || cauldron.max_volume || 1000;
    const currentVolume = level.volume || level.level || 0;
    return (currentVolume / maxVolume) * 100;
  };

  // Get color based on fill percentage
  const getCauldronColor = (fillPercentage) => {
    if (fillPercentage > 90) return '#ef4444'; // red
    if (fillPercentage > 70) return '#f59e0b'; // yellow
    if (fillPercentage > 50) return '#3b82f6'; // blue
    return '#10b981'; // green
  };

  // Custom icon for cauldrons
  const createCauldronIcon = (fillPercentage) => {
    const color = getCauldronColor(fillPercentage);
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  // Custom icon for market
  const marketIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #9333EA; width: 32px; height: 32px; border-radius: 50%; border: 4px solid gold; box-shadow: 0 4px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">🏪</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  // Calculate sample route (Market → most full cauldron → Market)
  const calculateSampleRoute = () => {
    if (!market || cauldrons.length === 0) return null;

    // Find the most full cauldron
    let mostFullCauldron = null;
    let maxFill = 0;

    cauldrons.forEach(cauldron => {
      const id = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
      const fillPercent = getCauldronFillPercentage(id);
      if (fillPercent > maxFill) {
        maxFill = fillPercent;
        mostFullCauldron = cauldron;
      }
    });

    if (!mostFullCauldron) return null;

    const cauldronId = mostFullCauldron.id || mostFullCauldron.cauldronId || mostFullCauldron.cauldron_id;
    
    // Find network edges for this route
    const toCapuldronEdge = network.edges.find(e => 
      (e.from === 'market' && e.to === cauldronId) ||
      (e.to === 'market' && e.from === cauldronId)
    );

    const totalTravelMin = toCapuldronEdge ? toCapuldronEdge.travel_min * 2 : 0; // Round trip
    const totalMin = totalTravelMin + 15; // Add 15 min unload time

    return {
      cauldron: mostFullCauldron,
      coordinates: [
        [market.latitude, market.longitude],
        [
          mostFullCauldron.latitude || mostFullCauldron.lat || 0,
          mostFullCauldron.longitude || mostFullCauldron.lon || mostFullCauldron.long || 0
        ],
        [market.latitude, market.longitude]
      ],
      totalMin,
      travelMin: totalTravelMin
    };
  };

  useEffect(() => {
    if (showRoute) {
      setSampleRoute(calculateSampleRoute());
    } else {
      setSampleRoute(null);
    }
  }, [showRoute, cauldrons, levels, network, market]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-300 border-t-white"></div>
          <p className="text-white mt-4 text-lg">Loading potion network map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
        <div className="bg-red-500/20 border border-red-500 text-red-200 p-6 rounded-lg max-w-md">
          <p className="font-semibold text-lg mb-2">⚠️ Error Loading Map</p>
          <p>{error}</p>
          <button 
            onClick={fetchMapData}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const center = market ? [market.latitude, market.longitude] : [32.9857, -96.7501];

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      {/* Header */}
      <div className="p-4 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              🗺️ Potion Network Map
            </h1>
            <p className="text-purple-200 text-sm">Cauldron locations and broomstick routes</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={showRoute}
                onChange={(e) => setShowRoute(e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <span className="text-sm font-semibold">Show Sample Route</span>
            </label>
            <Link
              to="/"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold transition"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 p-4">
        <div className="h-full rounded-lg overflow-hidden shadow-2xl border-4 border-white/20">
          <MapContainer
            center={center}
            zoom={10}
            style={{ height: '100%', width: '100%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            zoomControl={true}
          >
            {/* Simple light background - no map tiles */}
            <TileLayer
              attribution='PotionFlow Network Map'
              url="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
              className="opacity-0"
            />

            {/* Market Marker */}
            {market && (
              <Marker
                position={[market.latitude, market.longitude]}
                icon={marketIcon}
              >
                <Popup>
                  <div className="text-center">
                    <h3 className="font-bold text-lg text-purple-900">🏪 {market.name}</h3>
                    <p className="text-sm text-gray-600">Central Trading Hub</p>
                    <p className="text-xs text-gray-500 mt-1">Unload time: {market.unload_time_min} min</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Cauldron Markers */}
            {cauldrons.map((cauldron) => {
              const id = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
              const name = cauldron.name || cauldron.cauldronName || id;
              const lat = cauldron.latitude || cauldron.lat || 0;
              const lon = cauldron.longitude || cauldron.lon || cauldron.long || 0;
              const fillPercentage = getCauldronFillPercentage(id);

              return (
                <Marker
                  key={id}
                  position={[lat, lon]}
                  icon={createCauldronIcon(fillPercentage)}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <h3 className="font-bold text-lg text-purple-900">{name}</h3>
                      <p className="text-xs text-gray-500 font-mono">{id}</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p><span className="font-semibold">Fill:</span> {fillPercentage.toFixed(1)}%</p>
                        <p><span className="font-semibold">Max Volume:</span> {cauldron.maxVolume || cauldron.max_volume || 0} L</p>
                        <p><span className="font-semibold">Fill Rate:</span> {(cauldron.fillRate || cauldron.fill_rate || 0).toFixed(2)} L/min</p>
                      </div>
                      <Link
                        to={`/cauldron/${id}`}
                        className="mt-3 block text-center px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition"
                      >
                        View Details →
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Network Edges */}
            {network.map((edge, idx) => {
              const fromNode = edge.from === 'market' ? market : 
                cauldrons.find(c => (c.id || c.cauldronId || c.cauldron_id) === edge.from);
              const toNode = edge.to === 'market' ? market :
                cauldrons.find(c => (c.id || c.cauldronId || c.cauldron_id) === edge.to);

              if (!fromNode || !toNode) return null;

              const fromLat = fromNode.latitude || fromNode.lat || 0;
              const fromLon = fromNode.longitude || fromNode.lon || fromNode.long || 0;
              const toLat = toNode.latitude || toNode.lat || 0;
              const toLon = toNode.longitude || toNode.lon || toNode.long || 0;

              return (
                <Polyline
                  key={idx}
                  positions={[[fromLat, fromLon], [toLat, toLon]]}
                  color="#9333EA"
                  opacity={0.3}
                  weight={2}
                  dashArray="5, 10"
                >
                  <Tooltip>
                    <div className="text-xs">
                      <p className="font-semibold">{edge.from} → {edge.to}</p>
                      <p>Distance: {edge.distance_km} km</p>
                      <p>Travel: {edge.travel_min} min</p>
                    </div>
                  </Tooltip>
                </Polyline>
              );
            })}

            {/* Sample Route */}
            {showRoute && sampleRoute && (
              <Polyline
                positions={sampleRoute.coordinates}
                color="#f59e0b"
                opacity={0.8}
                weight={4}
              >
                <Tooltip permanent>
                  <div className="text-xs font-semibold bg-yellow-100 p-2 rounded">
                    <p>🧹 Sample Route</p>
                    <p>Total: {sampleRoute.totalMin} min</p>
                    <p>(Travel: {sampleRoute.travelMin} min + Unload: 15 min)</p>
                  </div>
                </Tooltip>
              </Polyline>
            )}
          </MapContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-white/10 backdrop-blur-md border-t border-white/20">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-6 text-sm text-white">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
            <span>0-50% Full</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
            <span>50-70% Full</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500 border-2 border-white"></div>
            <span>70-90% Full</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
            <span>90-100% Full (Critical)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-600 border-2 border-yellow-500"></div>
            <span>🏪 Enchanted Market</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MapView;