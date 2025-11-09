import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MarketIcon from './Images/market2.png';
import CauldronIcon from './Images/Cauldron.png';

function MapView() {
  const [market, setMarket] = useState(null);
  const [cauldrons, setCauldrons] = useState([]);
  const [network, setNetwork] = useState([]);
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [sampleRoute, setSampleRoute] = useState(null);
  const [hoveredCauldron, setHoveredCauldron] = useState(null);
  const [cauldronPositions, setCauldronPositions] = useState([]);
  const [zoom, setZoom] = useState(0.6); // Start zoomed out to show everything
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredEdge, setHoveredEdge] = useState(null);

  useEffect(() => {
    fetchMapData();
  }, []);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [zoom]);

  // Mouse wheel zoom (like Google Maps)
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Scroll up = Zoom in
      handleZoomIn();
    } else {
      // Scroll down = Zoom out
      handleZoomOut();
    }
  };

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

      // Calculate circular positions for cauldrons - centered with good spacing
      const positions = calculateCircularPositions(cauldronData, 800, 800, 500);
      setCauldronPositions(positions);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching map data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate circular positions around the market
  const calculateCircularPositions = (cauldrons, centerX, centerY, radius) => {
    const angleStep = (2 * Math.PI) / cauldrons.length;
    return cauldrons.map((cauldron, index) => {
      const angle = angleStep * index - Math.PI / 2; // Start from top
      const id = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
      return {
        ...cauldron,
        id: id,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });
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

  // Generate unique color for each cauldron's connections
  const getCauldronConnectionColor = (cauldronId) => {
    const colors = [
      '#ef4444', // red
      '#f59e0b', // orange
      '#eab308', // yellow
      '#84cc16', // lime
      '#10b981', // green
      '#06b6d4', // cyan
      '#3b82f6', // blue
      '#6366f1', // indigo
      '#8b5cf6', // violet
      '#a855f7', // purple
      '#ec4899', // pink
      '#f43f5e', // rose
    ];
    
    // Hash the cauldron ID to get a consistent color
    const index = cauldronPositions.findIndex(c => c.id === cauldronId);
    return colors[index % colors.length];
  };

  // Calculate sample route (Market → most full cauldron → Market)
  const calculateSampleRoute = () => {
    if (!market || cauldronPositions.length === 0) return null;

    let mostFullCauldron = null;
    let maxFill = 0;

    cauldronPositions.forEach(cauldron => {
      const fillPercent = getCauldronFillPercentage(cauldron.id);
      if (fillPercent > maxFill) {
        maxFill = fillPercent;
        mostFullCauldron = cauldron;
      }
    });

    if (!mostFullCauldron) return null;

    const toCapuldronEdge = network.find(e => 
      (e.from === 'market_001' && e.to === mostFullCauldron.id) ||
      (e.to === 'market_001' && e.from === mostFullCauldron.id)
    );

    const totalTravelMin = toCapuldronEdge ? toCapuldronEdge.travel_time_minutes * 2 : 0;
    const totalMin = totalTravelMin + 15;

    return {
      cauldron: mostFullCauldron,
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
  }, [showRoute, cauldronPositions, levels, network, market]);

  // Handle zoom controls
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3)); // Max zoom 3x
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5)); // Min zoom 0.5x
  };

  const handleResetView = () => {
    setZoom(0.6); // Reset to fit-all view
    setPan({ x: 0, y: 0 });
  };

  // Render connection lines between nodes
  const renderEdges = () => {
    const marketX = 800;
    const marketY = 800;

    return network.map((edge, idx) => {
      const fromNode = edge.from === 'market_001' 
        ? { x: marketX, y: marketY, id: 'market_001' }
        : cauldronPositions.find(c => c.id === edge.from);
      
      const toNode = edge.to === 'market_001' 
        ? { x: marketX, y: marketY, id: 'market_001' }
        : cauldronPositions.find(c => c.id === edge.to);

      if (!fromNode || !toNode) return null;

      const isMarketConnection = edge.from === 'market_001' || edge.to === 'market_001';
      const isSampleRoute = sampleRoute && (
        (edge.from === 'market_001' && edge.to === sampleRoute.cauldron.id) ||
        (edge.to === 'market_001' && edge.from === sampleRoute.cauldron.id)
      );
      const isHovered = hoveredEdge === idx;

      // Determine the cauldron ID for this edge (not market)
      const cauldronId = edge.from === 'market_001' ? edge.to : edge.from;
      
      // Get unique color for this cauldron's connections
      const edgeColor = isSampleRoute ? '#f59e0b' : getCauldronConnectionColor(cauldronId);

      // Calculate midpoint for travel time label
      const midX = (fromNode.x + toNode.x) / 2;
      const midY = (fromNode.y + toNode.y) / 2;

      return (
        <g key={`edge-${idx}`}>
          {/* Invisible wider line for easier hover detection */}
          <line
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke="transparent"
            strokeWidth={15}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredEdge(idx)}
            onMouseLeave={() => setHoveredEdge(null)}
          />
          {/* Visible line */}
          <line
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke={edgeColor}
            strokeWidth={isHovered ? 4 : (isSampleRoute ? 4 : 2)}
            strokeOpacity={isHovered ? 1 : (isSampleRoute ? 0.9 : 0.6)}
            style={{ pointerEvents: 'none' }}
          />
          {/* Travel time label - only show on hover */}
          {isHovered && (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={midX - 30}
                y={midY - 15}
                width={60}
                height={30}
                fill="rgba(0, 0, 0, 0.85)"
                rx={6}
              />
              <text
                x={midX}
                y={midY + 6}
                textAnchor="middle"
                fill="white"
                fontSize="14"
                fontWeight="700"
              >
                {edge.travel_time_minutes}min
              </text>
            </g>
          )}
        </g>
      );
    });
  };

  // Render market node
  const renderMarket = () => {
    const marketX = 800;
    const marketY = 800;

    return (
      <g>
        {/* Market icon - larger, no circle */}
        <image
          href={MarketIcon}
          x={marketX - 70}
          y={marketY - 70}
          width={140}
          height={140}
          style={{ pointerEvents: 'none' }}
        />
        {/* Market label */}
        <text
          x={marketX}
          y={marketY + 90}
          textAnchor="middle"
          fill="white"
          fontSize="20"
          fontWeight="bold"
        >
          MARKET
        </text>
      </g>
    );
  };

  // Render individual cauldron
  const renderCauldron = (cauldron) => {
    const fillPercentage = getCauldronFillPercentage(cauldron.id);
    const color = getCauldronColor(fillPercentage);
    const name = cauldron.name || cauldron.cauldronName || cauldron.id;
    const shortId = cauldron.id.replace('cauldron_', 'C');

    const isSampleRoute = sampleRoute && sampleRoute.cauldron.id === cauldron.id;

    return (
      <g
        key={cauldron.id}
        onMouseEnter={() => setHoveredCauldron(cauldron)}
        onMouseLeave={() => setHoveredCauldron(null)}
        style={{ cursor: 'pointer' }}
      >
        {/* Glow effect for hovered or sample route cauldron */}
        {(hoveredCauldron?.id === cauldron.id || isSampleRoute) && (
          <circle
            cx={cauldron.x}
            cy={cauldron.y}
            r={70}
            fill={isSampleRoute ? '#f59e0b' : color}
            opacity={0.3}
          />
        )}
        
        {/* Cauldron icon - larger, no circle background */}
        <image
          href={CauldronIcon}
          x={cauldron.x - 60}
          y={cauldron.y - 60}
          width={120}
          height={120}
          style={{ pointerEvents: 'none' }}
        />
        
        {/* Status indicator ring around the image */}
        <circle
          cx={cauldron.x}
          cy={cauldron.y}
          r={65}
          fill="none"
          stroke={color}
          strokeWidth={5}
          opacity={0.8}
        />
        
        {/* Cauldron ID label */}
        <text
          x={cauldron.x}
          y={cauldron.y + 85}
          textAnchor="middle"
          fill="white"
          fontSize="16"
          fontWeight="bold"
        >
          {shortId}
        </text>
      </g>
    );
  };

  // Render hover tooltip with all cauldron information
  const renderTooltip = () => {
    if (!hoveredCauldron) return null;

    const fillPercentage = getCauldronFillPercentage(hoveredCauldron.id);
    const level = levels.find(l => 
      (l.cauldronId || l.cauldron_id || l.tankId) === hoveredCauldron.id
    );
    const currentVolume = level ? (level.volume || level.level || 0) : 0;

    // Position tooltip near the cauldron
    const tooltipX = hoveredCauldron.x > 800 ? hoveredCauldron.x - 250 : hoveredCauldron.x + 80;
    const tooltipY = hoveredCauldron.y - 100;

    return (
      <g style={{ pointerEvents: 'none' }}>
        {/* Tooltip background */}
        <rect
          x={tooltipX}
          y={tooltipY}
          width={230}
          height={200}
          fill="white"
          stroke="#9333EA"
          strokeWidth={2}
          rx={8}
          filter="drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))"
        />
        
        {/* Tooltip content */}
        <text x={tooltipX + 15} y={tooltipY + 25} fontSize="16" fontWeight="bold" fill="#581c87">
          {hoveredCauldron.name || hoveredCauldron.cauldronName || hoveredCauldron.id}
        </text>
        <text x={tooltipX + 15} y={tooltipY + 45} fontSize="11" fill="#6b7280">
          ID: {hoveredCauldron.id}
        </text>
        
        <text x={tooltipX + 15} y={tooltipY + 70} fontSize="12" fill="#374151">
          <tspan fontWeight="600">Fill Level:</tspan> {fillPercentage.toFixed(1)}%
        </text>
        <text x={tooltipX + 15} y={tooltipY + 90} fontSize="12" fill="#374151">
          <tspan fontWeight="600">Current:</tspan> {currentVolume.toFixed(1)} L
        </text>
        <text x={tooltipX + 15} y={tooltipY + 110} fontSize="12" fill="#374151">
          <tspan fontWeight="600">Max Volume:</tspan> {(hoveredCauldron.maxVolume || hoveredCauldron.max_volume || 0).toFixed(1)} L
        </text>
        <text x={tooltipX + 15} y={tooltipY + 130} fontSize="12" fill="#374151">
          <tspan fontWeight="600">Fill Rate:</tspan> {(hoveredCauldron.fillRate || hoveredCauldron.fill_rate || 0).toFixed(2)} L/min
        </text>
        <text x={tooltipX + 15} y={tooltipY + 150} fontSize="12" fill="#374151">
          <tspan fontWeight="600">Location:</tspan> 
        </text>
        <text x={tooltipX + 15} y={tooltipY + 168} fontSize="10" fill="#6b7280">
          {(hoveredCauldron.latitude || hoveredCauldron.lat || 0).toFixed(4)}°, {(hoveredCauldron.longitude || hoveredCauldron.lon || hoveredCauldron.long || 0).toFixed(4)}°
        </text>
        
        {/* View Details hint */}
        <text x={tooltipX + 15} y={tooltipY + 188} fontSize="10" fill="#9333EA" fontStyle="italic">
          Click for full details →
        </text>
      </g>
    );
  };

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

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 overflow-hidden">
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

      {/* Map Canvas */}
      <div className="flex-1 p-4 relative overflow-hidden">
        <div 
          className="h-full w-full rounded-lg shadow-2xl border-4 border-white/20 flex items-center justify-center" 
          style={{ background: 'linear-gradient(to bottom right, #581c87 0%, #6b21a8 50%, #312e81 100%)' }}
          onWheel={handleWheel}
        >
          {/* Zoom Controls - Top Left */}
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md rounded-lg shadow-lg p-3">
            <div className="text-purple-900 font-bold text-sm mb-2 text-center">Zoom</div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleZoomIn}
                className="w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xl flex items-center justify-center transition"
                title="Zoom In (+)"
              >
                +
              </button>
              <button
                onClick={handleZoomOut}
                className="w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xl flex items-center justify-center transition"
                title="Zoom Out (-)"
              >
                −
              </button>
              <button
                onClick={handleResetView}
                className="w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm flex items-center justify-center transition"
                title="Reset View"
              >
                ⟲
              </button>
            </div>
            <div className="text-purple-700 text-xs mt-2 text-center">
              Press +/-
            </div>
          </div>

          <svg
            viewBox="0 0 1600 1600"
            className="w-full h-full max-w-full max-h-full"
            style={{ background: 'transparent' }}
            preserveAspectRatio="xMidYMid meet"
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} transform-origin="800 800">
            {/* Connection Lines (render first, so they appear behind nodes) */}
            {renderEdges()}

            {/* Market Node */}
            {market && renderMarket()}

            {/* Cauldron Nodes */}
            {cauldronPositions.map(cauldron => renderCauldron(cauldron))}

            {/* Hover Tooltip */}
            {renderTooltip()}
            </g>
          </svg>

          {/* Sample Route Info Banner */}
          {showRoute && sampleRoute && (
            <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-yellow-500/90 text-gray-900 px-6 py-3 rounded-lg shadow-lg">
              <p className="font-bold">🧹 Sample Route to {sampleRoute.cauldron.name || sampleRoute.cauldron.id}</p>
              <p className="text-sm">Total Time: {sampleRoute.totalMin} min (Travel: {sampleRoute.travelMin} min + Unload: 15 min)</p>
            </div>
          )}
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
