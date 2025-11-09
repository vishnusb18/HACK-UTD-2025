import { useState, useEffect, useRef, useMemo } from 'react';

function MapView() {
  const [cauldrons, setCauldrons] = useState([]);
  const [market, setMarket] = useState(null);
  const [levels, setLevels] = useState([]);
  const [network, setNetwork] = useState({ edges: [], description: '' });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  
  // Time slider state
  const [allLevels, setAllLevels] = useState([]);
  const [timeIndex, setTimeIndex] = useState(null);

  // Map dimensions and projection
  const mapWidth = 3200;
  const mapHeight = 1200;
  const padding = 220;

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    try {
      setLoading(true);
      const errors = [];

      // Fetch cauldrons
      let cauldronData = [];
      try {
        const r = await fetch('/api/information/cauldrons');
        if (!r.ok) throw new Error(`status ${r.status}`);
        cauldronData = await r.json();
      } catch (e) {
        errors.push(`cauldrons: ${e.message}`);
      }

      // Fetch market
      let marketData = null;
      try {
        const r = await fetch('/api/information/market');
        if (!r.ok) throw new Error(`status ${r.status}`);
        marketData = await r.json();
      } catch (e) {
        errors.push(`market: ${e.message}`);
      }

      // Fetch latest levels
      let latestLevels = [];
      try {
        const r = await fetch('/api/levels/latest');
        if (!r.ok) throw new Error(`status ${r.status}`);
        latestLevels = await r.json();
      } catch (e) {
        errors.push(`levels: ${e.message}`);
      }

      // Fetch historical levels for time slider
      let historyLevels = [];
      try {
        const r = await fetch('/api/levels?start_date=0&end_date=2000000000');
        if (!r.ok) throw new Error(`status ${r.status}`);
        historyLevels = await r.json();
      } catch (e) {
        errors.push(`levels/history: ${e.message}`);
      }

      // Fetch network connections
      let networkData = { edges: [], description: '' };
      try {
        const r = await fetch('/api/information/network');
        if (!r.ok) throw new Error(`status ${r.status}`);
        networkData = await r.json();
      } catch (e) {
        errors.push(`network: ${e.message}`);
      }

      setCauldrons(cauldronData || []);
      setMarket(marketData);
      setLevels(latestLevels || []);
      setAllLevels(historyLevels || []);
      setNetwork(networkData);

      if (errors.length) {
        setError('Failed to fetch: ' + errors.join('; '));
      } else {
        setError(null);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching map data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Derive sorted unique minute timestamps from allLevels
  const timestamps = useMemo(() => {
    if (!allLevels || allLevels.length === 0) return [];
    const uniqueMs = new Set();
    allLevels.forEach(r => {
      const ts = r.timestamp || r.time;
      if (ts) {
        const d = new Date(ts);
        d.setSeconds(0, 0);
        uniqueMs.add(d.getTime());
      }
    });
    return Array.from(uniqueMs).sort((a, b) => a - b);
  }, [allLevels]);

  // Default timeIndex to latest minute
  useEffect(() => {
    if (timestamps.length > 0 && timeIndex === null) {
      setTimeIndex(timestamps.length - 1);
    }
  }, [timestamps, timeIndex]);

  // Compute snapshot of levels for the selected minute
  const levelsAtSelectedTime = useMemo(() => {
    if (timeIndex === null || timestamps.length === 0) return levels;
    const selectedMs = timestamps[timeIndex];
    const snapshot = allLevels.filter(r => {
      const ts = r.timestamp || r.time;
      if (!ts) return false;
      const d = new Date(ts);
      d.setSeconds(0, 0);
      return d.getTime() === selectedMs;
    });
    return snapshot.length > 0 ? snapshot : levels;
  }, [allLevels, timestamps, timeIndex, levels]);

  // Calculate spread-out coordinates using a circular/grid layout for better visibility
  const getProjectedCoordinates = () => {
    if (cauldrons.length === 0) return { cauldrons: [], market: null };

    // Use an elliptical layout with market in center (wider horizontally)
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    
    // Calculate radius based on number of cauldrons to ensure spacing
    const numCauldrons = cauldrons.length;
    const minSpacing = 400; // Increased spacing for bigger elements
    const radiusX = Math.max(950, (numCauldrons * minSpacing) / (2 * Math.PI)); // Horizontal radius
    const radiusY = radiusX * 0.65; // Vertical radius (65% of horizontal for ellipse)

    // Position market in the center
    const projectedMarket = market ? {
      ...market,
      x: centerX,
      y: centerY,
    } : null;

    // Position cauldrons in an ellipse around the market
    const projectedCauldrons = cauldrons.map((cauldron, index) => {
      const angle = (index / numCauldrons) * 2 * Math.PI;
      const x = centerX + radiusX * Math.cos(angle);
      const y = centerY + radiusY * Math.sin(angle);
      
      return {
        ...cauldron,
        x,
        y,
      };
    });

    return {
      cauldrons: projectedCauldrons,
      market: projectedMarket,
    };
  };

  const { cauldrons: projectedCauldrons, market: projectedMarket } = getProjectedCoordinates();

  // Extract cauldron number from ID (e.g., "cauldron_001" -> "1")
  const getCauldronNumber = (cauldronId) => {
    const match = cauldronId?.match(/\d+/);
    return match ? parseInt(match[0], 10).toString() : '?';
  };

  // Get level for a cauldron
  const getLevelForCauldron = (cauldronId) => {
    const level = levelsAtSelectedTime.find(l => 
      l.cauldron_id === cauldronId || 
      l.cauldronId === cauldronId || 
      l.id === cauldronId
    );
    return level?.level ?? level?.volume ?? 0;
  };

  // Calculate fill percentage
  const getFillPercentage = (cauldron) => {
    const currentLevel = getLevelForCauldron(cauldron.id);
    const maxVolume = cauldron.max_volume || cauldron.maxVolume || 100;
    return (currentLevel / maxVolume) * 100;
  };

  // Get color based on fill percentage
  const getFillColor = (percentage) => {
    if (percentage >= 90) return '#ef4444'; // red - critical
    if (percentage >= 70) return '#f59e0b'; // orange - warning
    if (percentage >= 20) return '#10b981'; // green - ok
    return '#6366f1'; // purple - low
  };

  // Draw cauldron shape
  const CauldronIcon = ({ cauldron, x, y, size, fillPercentage, isHovered }) => {
    const scale = isHovered ? 1.2 : 1;
    const adjustedSize = size * 3.8; // Significantly bigger cauldrons
    const fillColor = getFillColor(fillPercentage);
    const cauldronNumber = getCauldronNumber(cauldron.id);
    
    return (
      <g transform={`translate(${x}, ${y}) scale(${scale})`}>
        {/* Smaller hover background circle */}
        <circle
          cx="0"
          cy="0"
          r={adjustedSize * 1.5}
          fill="transparent"
          stroke="none"
        />
        {/* Cauldron body */}
        <path
          d={`M ${-adjustedSize} ${adjustedSize * 0.3} 
              Q ${-adjustedSize} ${adjustedSize * 1.2} 0 ${adjustedSize * 1.3}
              Q ${adjustedSize} ${adjustedSize * 1.2} ${adjustedSize} ${adjustedSize * 0.3}
              L ${adjustedSize * 0.8} ${-adjustedSize * 0.5}
              Q ${adjustedSize * 0.8} ${-adjustedSize * 0.8} ${adjustedSize * 0.5} ${-adjustedSize * 0.9}
              L ${-adjustedSize * 0.5} ${-adjustedSize * 0.9}
              Q ${-adjustedSize * 0.8} ${-adjustedSize * 0.8} ${-adjustedSize * 0.8} ${-adjustedSize * 0.5}
              Z`}
          fill={fillColor}
          stroke="#1f2937"
          strokeWidth="4"
          opacity="0.9"
        />
        {/* Cauldron rim */}
        <ellipse
          cx="0"
          cy={-adjustedSize * 0.5}
          rx={adjustedSize * 0.9}
          ry={adjustedSize * 0.25}
          fill={fillColor}
          stroke="#1f2937"
          strokeWidth="4"
          opacity="0.95"
        />
        {/* Handle left */}
        <path
          d={`M ${-adjustedSize * 0.9} ${-adjustedSize * 0.3} Q ${-adjustedSize * 1.3} ${-adjustedSize * 0.2} ${-adjustedSize * 1.3} ${adjustedSize * 0.2}`}
          fill="none"
          stroke="#4b5563"
          strokeWidth="6"
        />
        {/* Handle right */}
        <path
          d={`M ${adjustedSize * 0.9} ${-adjustedSize * 0.3} Q ${adjustedSize * 1.3} ${-adjustedSize * 0.2} ${adjustedSize * 1.3} ${adjustedSize * 0.2}`}
          fill="none"
          stroke="#4b5563"
          strokeWidth="6"
        />
        {/* Fill level indicator */}
        <rect
          x={-adjustedSize * 0.6}
          y={-adjustedSize * 0.4}
          width={adjustedSize * 1.2}
          height={adjustedSize * 0.18}
          fill="white"
          opacity="0.3"
          rx="3"
        />
        <rect
          x={-adjustedSize * 0.6}
          y={-adjustedSize * 0.4}
          width={adjustedSize * 1.2 * (fillPercentage / 100)}
          height={adjustedSize * 0.18}
          fill="white"
          opacity="0.7"
          rx="3"
        />
        {/* Cauldron number */}
        <text
          x="0"
          y={adjustedSize * 0.5}
          textAnchor="middle"
          fill="#fff"
          fontSize="42"
          fontWeight="bold"
          stroke="#1f2937"
          strokeWidth="1.5"
        >
          {cauldronNumber}
        </text>
      </g>
    );
  };

  // Draw market icon
  const MarketIcon = ({ x, y, size, isHovered }) => {
    const scale = isHovered ? 1.2 : 1;
    const adjustedSize = size * 3.8; // Significantly bigger market
    
    return (
      <g transform={`translate(${x}, ${y}) scale(${scale})`}>
        {/* Smaller hover background circle */}
        <circle
          cx="0"
          cy="0"
          r={adjustedSize * 2}
          fill="transparent"
          stroke="none"
        />
        {/* Market building */}
        <rect
          x={-adjustedSize}
          y={-adjustedSize * 0.5}
          width={adjustedSize * 2}
          height={adjustedSize * 1.5}
          fill="#8b5cf6"
          stroke="#1f2937"
          strokeWidth="4.5"
          rx="8"
        />
        {/* Roof */}
        <path
          d={`M ${-adjustedSize * 1.2} ${-adjustedSize * 0.5} L 0 ${-adjustedSize * 1.3} L ${adjustedSize * 1.2} ${-adjustedSize * 0.5} Z`}
          fill="#7c3aed"
          stroke="#1f2937"
          strokeWidth="4.5"
        />
        {/* Door */}
        <rect
          x={-adjustedSize * 0.3}
          y={adjustedSize * 0.3}
          width={adjustedSize * 0.6}
          height={adjustedSize * 0.7}
          fill="#6d28d9"
          stroke="#1f2937"
          strokeWidth="3"
          rx="6"
        />
        {/* Windows */}
        <rect
          x={-adjustedSize * 0.7}
          y={-adjustedSize * 0.2}
          width={adjustedSize * 0.4}
          height={adjustedSize * 0.4}
          fill="#fbbf24"
          stroke="#1f2937"
          strokeWidth="2.5"
        />
        <rect
          x={adjustedSize * 0.3}
          y={-adjustedSize * 0.2}
          width={adjustedSize * 0.4}
          height={adjustedSize * 0.4}
          fill="#fbbf24"
          stroke="#1f2937"
          strokeWidth="2.5"
        />
        {/* Market sign */}
        <text
          x="0"
          y={adjustedSize * 2.2}
          textAnchor="middle"
          fill="#fff"
          fontSize="48"
          fontWeight="bold"
        >
          Market
        </text>
      </g>
    );
  };

  // Get node by ID
  const getNodeById = (nodeId) => {
    if (projectedMarket && (projectedMarket.id === nodeId)) {
      return projectedMarket;
    }
    return projectedCauldrons.find(c => c.id === nodeId);
  };

  // Render network connections
  const renderConnections = () => {
    if (!network.edges || network.edges.length === 0) return null;

    return network.edges.map((edge, idx) => {
      const fromNode = getNodeById(edge.from);
      const toNode = getNodeById(edge.to);

      if (!fromNode || !toNode) return null;

      const edgeId = `edge-${idx}`;
      const midX = (fromNode.x + toNode.x) / 2;
      const midY = (fromNode.y + toNode.y) / 2;

      return (
        <g key={edgeId}>
          {/* Invisible wider line for easier hovering */}
          <line
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke="transparent"
            strokeWidth="20"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => {
              setHoveredNode({ 
                id: edgeId, 
                isEdge: true, 
                x: midX, 
                y: midY,
                travelTime: edge.travel_time_minutes,
                from: edge.from,
                to: edge.to
              });
            }}
            onMouseLeave={() => {
              if (hoveredNode?.isEdge) setHoveredNode(null);
            }}
          />
          {/* Visible line */}
          <line
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke="#6366f1"
            strokeWidth={hoveredNode?.id === edgeId ? "8" : "6"}
            strokeOpacity={hoveredNode?.id === edgeId ? "0.8" : "0.5"}
            style={{ pointerEvents: 'none' }}
          />
        </g>
      );
    });
  };  // Render hover tooltip
  const renderTooltip = () => {
    if (!hoveredNode || !hoveredNode.isEdge) return null;
    if (!svgRef.current || !containerRef.current) return null;

    // Get the SVG element's bounding rectangle
    const svgRect = svgRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate the scale factor between viewBox and actual rendered size
    const scaleX = svgRect.width / mapWidth;
    const scaleY = svgRect.height / mapHeight;
    
    // Convert SVG coordinates to screen coordinates
    const screenX = containerRect.left + (hoveredNode.x * scaleX);
    const screenY = containerRect.top + (hoveredNode.y * scaleY);

    // Only show tooltip for edges now
    return (
      <div
        className="fixed bg-gray-900/95 text-white p-4 rounded-lg shadow-xl border border-purple-500/50 pointer-events-none z-50"
        style={{
          left: `${screenX}px`,
          top: `${screenY - 60}px`,
          transform: 'translate(-50%, -100%)',
          minWidth: '200px',
        }}
      >
        <div className="text-lg font-semibold text-center">
          ⏱️ Travel Time: <span className="text-purple-300">{hoveredNode.travelTime} minutes</span>
        </div>
        <div className="text-sm text-gray-400 text-center mt-1">
          {getCauldronNumber(hoveredNode.from)} ↔ {hoveredNode.to === market?.id ? 'Market' : getCauldronNumber(hoveredNode.to)}
        </div>
      </div>
    );
  };

  // Render cauldron info label
  const CauldronLabel = ({ cauldron, x, y }) => {
    const fillPercentage = getFillPercentage(cauldron);
    const currentLevel = getLevelForCauldron(cauldron.id);
    const cauldronNumber = getCauldronNumber(cauldron.id);
    const maxVolume = cauldron.max_volume || cauldron.maxVolume || 0;
    // Remove "Cauldron" prefix from name if it exists
    let cauldronName = cauldron.name || `Cauldron ${cauldronNumber}`;
    cauldronName = cauldronName.replace(/^Cauldron\s*/i, '');
    
    // Calculate position for label (to the side of the cauldron)
    const angle = Math.atan2(y - mapHeight / 2, x - mapWidth / 2);
    const labelDistance = 190;
    const labelX = x + Math.cos(angle) * labelDistance;
    const labelY = y + Math.sin(angle) * labelDistance;
    
    // Determine text anchor based on position
    // Special cases for cauldron 4 and 10 - center them
    let textAnchor = labelX > x ? 'start' : 'end';
    let adjustedLabelX = labelX;
    let adjustedLabelY = labelY;
    
    if (cauldronNumber === '4' || cauldronNumber === '10') {
      textAnchor = 'middle';
      adjustedLabelX = x;
      adjustedLabelY = y < mapHeight / 2 ? y - 180 : y + 180;
    }
    
    const boxWidth = 410;
    const boxHeight = 170;
    const boxX = textAnchor === 'middle' ? adjustedLabelX - boxWidth / 2 : 
                 textAnchor === 'start' ? adjustedLabelX : adjustedLabelX - boxWidth;
    
    return (
      <g>
        {/* Background box */}
        <rect
          x={boxX}
          y={adjustedLabelY - 78}
          width={boxWidth}
          height={boxHeight - 10}
          fill="rgba(17, 24, 39, 0.95)"
          stroke="#6366f1"
          strokeWidth="3"
          rx="12"
        />
        
        {/* Cauldron name */}
        <text
          x={textAnchor === 'middle' ? adjustedLabelX : boxX + boxWidth / 2}
          y={adjustedLabelY - 35}
          textAnchor="middle"
          fill="#ffffff"
          fontSize="32"
          fontWeight="bold"
        >
          {cauldronName}
        </text>
        
        {/* Fill percentage */}
        <text
          x={textAnchor === 'middle' ? adjustedLabelX : boxX + boxWidth / 2}
          y={adjustedLabelY + 8}
          textAnchor="middle"
          fill={getFillColor(fillPercentage)}
          fontSize="36"
          fontWeight="bold"
        >
          {fillPercentage.toFixed(1)}% Full
        </text>
        
        {/* Volume info */}
        <text
          x={textAnchor === 'middle' ? adjustedLabelX : boxX + boxWidth / 2}
          y={adjustedLabelY + 48}
          textAnchor="middle"
          fill="#d1d5db"
          fontSize="32"
        >
          {currentLevel.toFixed(1)}L / {maxVolume}L
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col h-[750px]">
      {/* Error Display */}
      {error && (
        <div className="bg-red-500 text-white p-3 rounded-lg mb-2 shadow-lg flex-shrink-0">
          <p className="font-semibold text-sm">⚠️ Error: {error}</p>
          <button 
            onClick={fetchMapData}
            className="mt-2 px-3 py-1 bg-red-700 hover:bg-red-600 rounded transition text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 flex-1 flex items-center justify-center">
          <div>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-300 border-t-white"></div>
            <p className="text-white mt-4">Loading map data...</p>
          </div>
        </div>
      )}

      {/* Map Container */}
      {!loading && !error && (
        <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-2xl border border-white/20 p-3 relative flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Legend */}
            <div className="absolute bottom-3 right-3 bg-gray-900/90 p-3 rounded-lg shadow-lg z-10">
              <div className="text-white font-semibold mb-1.5 text-sm">Legend</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#6366f1' }}></div>
                  <span className="text-gray-300">Low (&lt;20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
                  <span className="text-gray-300">OK (20-70%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
                  <span className="text-gray-300">Warning (70-90%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }}></div>
                  <span className="text-gray-300">Critical (&gt;90%)</span>
                </div>
              </div>
            </div>

            {/* Time Slider */}
            {timestamps.length > 0 && (
              <div className="mb-2 flex-shrink-0 bg-gray-900/70 p-3 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-white font-semibold text-sm whitespace-nowrap">Time:</span>
                  <input
                    type="range"
                    min="0"
                    max={timestamps.length - 1}
                    value={timeIndex ?? timestamps.length - 1}
                    onChange={(e) => setTimeIndex(parseInt(e.target.value, 10))}
                    className="flex-1 h-2 bg-purple-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <span className="text-purple-200 font-mono text-sm whitespace-nowrap">
                    {timeIndex !== null && timestamps[timeIndex]
                      ? new Date(timestamps[timeIndex]).toLocaleString()
                      : 'Latest'}
                  </span>
                </div>
              </div>
            )}

            {/* SVG Map - Centered and fills available space */}
            <div ref={containerRef} className="relative bg-slate-900/50 rounded-lg flex-1 flex items-center justify-center overflow-hidden min-h-0">
              <svg
                ref={svgRef}
                width={mapWidth}
                height={mapHeight}
                className="max-w-full max-h-full w-full h-full"
                viewBox={`0 0 ${mapWidth} ${mapHeight}`}
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Grid background */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.1"/>
                  </pattern>
                </defs>
                <rect width={mapWidth} height={mapHeight} fill="url(#grid)" />

                {/* Render connections */}
                <g>
                  {renderConnections()}
                </g>

                {/* Render cauldrons */}
                <g>
                  {projectedCauldrons.map((cauldron) => {
                    const fillPercentage = getFillPercentage(cauldron);
                    return (
                      <g
                        key={cauldron.id}
                        onMouseEnter={() => setHoveredNode(cauldron)}
                        onMouseLeave={() => setHoveredNode(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        <CauldronIcon
                          cauldron={cauldron}
                          x={cauldron.x}
                          y={cauldron.y}
                          size={20}
                          fillPercentage={fillPercentage}
                          isHovered={hoveredNode?.id === cauldron.id && !hoveredNode?.isEdge}
                        />
                      </g>
                    );
                  })}
                </g>

                {/* Render cauldron labels */}
                <g>
                  {projectedCauldrons.map((cauldron) => (
                    <CauldronLabel
                      key={`label-${cauldron.id}`}
                      cauldron={cauldron}
                      x={cauldron.x}
                      y={cauldron.y}
                    />
                  ))}
                </g>

                {/* Render market */}
                {projectedMarket && (
                  <g style={{ pointerEvents: 'none' }}>
                    <MarketIcon
                      x={projectedMarket.x}
                      y={projectedMarket.y}
                      size={30}
                      isHovered={false}
                    />
                  </g>
                )}
              </svg>
            </div>
            
            {/* Tooltip - rendered outside SVG for correct positioning */}
            {hoveredNode && renderTooltip()}
          </div>
        )}
    </div>
  );
}

export default MapView;
