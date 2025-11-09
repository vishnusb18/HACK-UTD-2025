import { useState, useRef, useEffect } from 'react';

function RouteVisualization({ routes, cauldrons, market, network, isAnimating, animationTime }) {
  const [selectedWitch, setSelectedWitch] = useState(null);
  const [hoveredStop, setHoveredStop] = useState(null);
  const svgRef = useRef(null);

  // Map dimensions
  const mapWidth = 3200;
  const mapHeight = 1200;
  const padding = 220;

  // Witch colors - high contrast, distinct colors against purple background
  const witchColors = [
    '#fbbf24', // bright yellow
    '#06b6d4', // deep cyan/turquoise
    '#86efac', // light green
    '#fb923c', // bright orange
    '#f87171', // bright red
    '#c084fc', // light purple
    '#22d3ee', // sky blue
    '#fcd34d', // amber
  ];

  // Calculate positions for nodes using elliptical layout
  const getNodePosition = (node) => {
    if (!node) return { x: mapWidth / 2, y: mapHeight / 2 };
    
    // Market is always at center
    if (node.id === (market?.id || 'market')) {
      return { x: mapWidth / 2, y: mapHeight / 2 };
    }

    // Find cauldron
    const cauldron = cauldrons.find(c => 
      (c.id === node.id || c.cauldronId === node.id || c.cauldron_id === node.id)
    );
    
    if (!cauldron) return { x: mapWidth / 2, y: mapHeight / 2 };

    // Use same elliptical layout as MapView
    const index = cauldrons.findIndex(c => 
      (c.id === node.id || c.cauldronId === node.id || c.cauldron_id === node.id)
    );
    const totalCauldrons = cauldrons.length;
    const angleStep = (2 * Math.PI) / totalCauldrons;
    const angle = index * angleStep - Math.PI / 2;

    const radiusX = (mapWidth - 2 * padding) / 2;
    const radiusY = (mapHeight - 2 * padding) / 2;
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;

    return {
      x: centerX + radiusX * Math.cos(angle),
      y: centerY + radiusY * Math.sin(angle)
    };
  };

  // Get position for market
  const marketPos = getNodePosition({ id: market?.id || 'market' });

  // Draw arrow at the end of a path
  const drawArrow = (fromX, fromY, toX, toY, color) => {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowLength = 25;
    const arrowWidth = 12;

    const tipX = toX;
    const tipY = toY;
    const baseX = tipX - arrowLength * Math.cos(angle);
    const baseY = tipY - arrowLength * Math.sin(angle);
    const left = {
      x: baseX - arrowWidth * Math.sin(angle),
      y: baseY + arrowWidth * Math.cos(angle)
    };
    const right = {
      x: baseX + arrowWidth * Math.sin(angle),
      y: baseY - arrowWidth * Math.cos(angle)
    };

    return (
      <polygon
        points={`${tipX},${tipY} ${left.x},${left.y} ${right.x},${right.y}`}
        fill={color}
        opacity="0.9"
      />
    );
  };

  // Safety check for routes
  if (!routes || !Array.isArray(routes) || routes.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-lg overflow-hidden flex items-center justify-center" style={{ height: '750px' }}>
        <p className="text-gray-400 text-lg">No routes to display. Run route optimization to see witch routes.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 rounded-lg overflow-auto" style={{ height: '750px' }}>
      <svg
        ref={svgRef}
        width={mapWidth}
        height={mapHeight}
        className="max-w-full max-h-full w-full h-full"
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
      >
        {/* Grid background */}
        <defs>
          <pattern id="grid-route" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(139, 92, 246, 0.1)" strokeWidth="1"/>
          </pattern>
          
          {/* Arrow marker definitions for each witch */}
          {routes.map((witchRoute, idx) => (
            <marker
              key={`arrow-${idx}`}
              id={`arrowhead-${idx}`}
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon
                points="0 0, 10 3, 0 6"
                fill={witchColors[idx % witchColors.length]}
              />
            </marker>
          ))}
        </defs>

        <rect width={mapWidth} height={mapHeight} fill="url(#grid-route)" />

        {/* Draw routes */}
        {routes.map((witchRoute, witchIdx) => {
          const color = witchColors[witchIdx % witchColors.length];
          const isSelected = selectedWitch === null || selectedWitch === witchIdx;
          const opacity = isSelected ? 1 : 0.2;

          const pathElements = [];
          let stopCounter = 0;
          
          // Iterate through all trips for this witch
          witchRoute.trips.forEach((trip, tripIdx) => {
            let prevPos = marketPos;
            
            trip.stops.forEach((stop, stopIdx) => {
              const stopPos = getNodePosition({ id: stop.cauldronId });
              
              // Skip market stops for numbering, but still draw the path
              if (stop.isMarket) {
                pathElements.push(
                  <g key={`path-${witchIdx}-${tripIdx}-${stopIdx}`} opacity={opacity}>
                    <line
                      x1={prevPos.x}
                      y1={prevPos.y}
                      x2={stopPos.x}
                      y2={stopPos.y}
                      stroke={color}
                      strokeWidth="4"
                      strokeDasharray="2,2"
                      opacity={0.3}
                    />
                  </g>
                );
                prevPos = stopPos;
                return;
              }

              // Increment counter for cauldron stops
              stopCounter++;
              
              // Draw path line
              pathElements.push(
                <g key={`path-${witchIdx}-${tripIdx}-${stopIdx}`} opacity={opacity}>
                  <line
                    x1={prevPos.x}
                    y1={prevPos.y}
                    x2={stopPos.x}
                    y2={stopPos.y}
                    stroke={color}
                    strokeWidth="4"
                    strokeDasharray={isAnimating ? "8,4" : "none"}
                    className={isAnimating ? "animate-dash" : ""}
                  />
                  {drawArrow(prevPos.x, prevPos.y, stopPos.x, stopPos.y, color)}
                </g>
              );

              // Draw stop number
              pathElements.push(
                <circle
                  key={`stop-${witchIdx}-${tripIdx}-${stopIdx}`}
                  cx={stopPos.x}
                  cy={stopPos.y}
                  r={15}
                  fill={color}
                  opacity={opacity}
                />
              );

              pathElements.push(
                <text
                  key={`stop-num-${witchIdx}-${tripIdx}-${stopIdx}`}
                  x={stopPos.x}
                  y={stopPos.y + 5}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="bold"
                  fill="white"
                  opacity={opacity}
                >
                  {stopCounter}
                </text>
              );

              prevPos = stopPos;
            });
          });

          return <g key={`witch-${witchIdx}`}>{pathElements}</g>;
        })}

        {/* Draw cauldrons */}
        {cauldrons.map((cauldron) => {
          const cauldronId = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
          const pos = getNodePosition({ id: cauldronId });
          
          // Check if this cauldron is in any selected route
          let stopData = []; // Array of {number, color} for this cauldron
          let isInRoute = false;
          
          routes.forEach((witchRoute, witchIdx) => {
            if (selectedWitch !== null && selectedWitch !== witchIdx) return;
            
            const witchColor = witchColors[witchIdx % witchColors.length];
            let witchStopCounter = 0;
            
            // Check all trips for this witch
            if (witchRoute.trips && Array.isArray(witchRoute.trips)) {
              witchRoute.trips.forEach((trip) => {
                if (trip.stops && Array.isArray(trip.stops)) {
                  trip.stops.forEach((stop) => {
                    if (!stop.isMarket) {
                      witchStopCounter++; // Increment for each non-market stop
                      if (stop.cauldronId === cauldronId) {
                        stopData.push({ number: witchStopCounter, color: witchColor });
                        isInRoute = true;
                      }
                    }
                  });
                }
              });
            }
          });

          return (
            <g
              key={cauldronId}
              onMouseEnter={() => setHoveredStop(cauldronId)}
              onMouseLeave={() => setHoveredStop(null)}
              className="cursor-pointer"
            >
              {/* Cauldron circle - make bigger to fit larger numbers */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isInRoute ? 42 : 25}
                fill={isInRoute ? '#1e1b4b' : '#475569'}
                stroke={hoveredStop === cauldronId ? '#fbbf24' : '#94a3b8'}
                strokeWidth={hoveredStop === cauldronId ? 4 : 2}
                opacity={isInRoute ? 0.95 : 0.5}
              />
              
              {/* Stop numbers with color coding - larger and better contrast */}
              {stopData.length > 0 && (
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="32"
                  fontWeight="bold"
                  style={{ textShadow: '0 0 4px rgba(0,0,0,0.8)' }}
                >
                  {stopData.map((stop, idx) => (
                    <tspan key={idx} fill={stop.color}>
                      {stop.number}{idx < stopData.length - 1 ? ',' : ''}
                    </tspan>
                  ))}
                </text>
              )}
              
              {/* Cauldron label */}
              <text
                x={pos.x}
                y={pos.y + 50}
                textAnchor="middle"
                fill="white"
                fontSize="16"
                fontWeight="500"
              >
                {cauldron.name || cauldronId}
              </text>
            </g>
          );
        })}

        {/* Draw market */}
        <g>
          <circle
            cx={marketPos.x}
            cy={marketPos.y}
            r={50}
            fill="#ec4899"
            stroke="#fbbf24"
            strokeWidth="4"
          />
          <text
            x={marketPos.x}
            y={marketPos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="32"
            fontWeight="bold"
          >
            🏪
          </text>
          <text
            x={marketPos.x}
            y={marketPos.y + 70}
            textAnchor="middle"
            fill="#fbbf24"
            fontSize="20"
            fontWeight="bold"
          >
            Market
          </text>
        </g>
      </svg>

      {/* Animation styles */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -100;
          }
        }
        .animate-dash {
          animation: dash 2s linear infinite;
        }
      `}</style>

      {/* Witch selector */}
      <div className="absolute top-4 left-4 bg-gray-900/90 p-3 rounded-lg">
        <div className="text-white font-semibold mb-2 text-sm">Select Witch:</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedWitch(null)}
            className={`px-3 py-1 rounded text-sm font-medium transition ${
              selectedWitch === null 
                ? 'bg-purple-600 text-white' 
                : 'bg-white/10 text-purple-200 hover:bg-white/20'
            }`}
          >
            All
          </button>
          {routes.map((witchRoute, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedWitch(idx)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                selectedWitch === idx 
                  ? 'text-white' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              style={{
                backgroundColor: selectedWitch === idx ? witchColors[idx % witchColors.length] : undefined
              }}
            >
              {witchRoute.witchName}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-gray-900/90 p-3 rounded-lg">
        <div className="text-white font-semibold mb-2 text-sm">Route Legend:</div>
        <div className="space-y-1 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-purple-500"></div>
            <span>Route path</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-purple-500 border-t-2 border-dashed"></div>
            <span>Return to market</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-xs">1</div>
            <span>Stop order</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RouteVisualization;
