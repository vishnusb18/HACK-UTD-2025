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
  // Expanded palette for more witches (with 16-hour work limits, we need more)
  const witchColors = [
    '#fbbf24', // bright yellow (Witch A)
    '#06b6d4', // deep cyan/turquoise (Witch B)
    '#86efac', // light green (Witch C)
    '#fb923c', // bright orange (Witch D)
    '#f87171', // bright red (Witch E)
    '#c084fc', // light purple (Witch F)
    '#22d3ee', // sky blue (Witch G)
    '#fcd34d', // amber (Witch H)
    '#34d399', // emerald (Witch I)
    '#f472b6', // pink (Witch J)
    '#a78bfa', // violet (Witch K)
    '#fde047', // yellow-300 (Witch L)
    '#60a5fa', // blue-400 (Witch M)
    '#f97316', // orange-500 (Witch N)
    '#14b8a6', // teal-500 (Witch O)
    '#ec4899', // pink-500 (Witch P)
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

              // Draw stop number - adjusted position based on location to avoid overlaps
              // For cauldrons near edges, adjust the number position
              const mapWidth = 800;
              const mapHeight = 600;
              const margin = 50;
              
              // Determine if cauldron is near edges
              const isNearTop = stopPos.y < margin;
              const isNearBottom = stopPos.y > mapHeight - margin;
              const isNearLeft = stopPos.x < margin;
              const isNearRight = stopPos.x > mapWidth - margin;
              
              // Adjust circle and text position based on location
              let circleX = stopPos.x;
              let circleY = stopPos.y - 30; // Default: above cauldron
              
              if (isNearTop) {
                circleY = stopPos.y + 50; // Move below cauldron if near top
              } else if (isNearBottom) {
                circleY = stopPos.y - 50; // Move further up if near bottom
              }
              
              if (isNearLeft) {
                circleX = stopPos.x + 30; // Move right if near left edge
              } else if (isNearRight) {
                circleX = stopPos.x - 30; // Move left if near right edge
              }
              
              pathElements.push(
                <circle
                  key={`stop-${witchIdx}-${tripIdx}-${stopIdx}`}
                  cx={circleX}
                  cy={circleY}
                  r={15}
                  fill={color}
                  opacity={opacity}
                />
              );

              pathElements.push(
                <text
                  key={`stop-num-${witchIdx}-${tripIdx}-${stopIdx}`}
                  x={circleX}
                  y={circleY + 5}
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

        {/* Draw cauldrons - Exact same shape as MapView */}
        {cauldrons.map((cauldron, idx) => {
          const cauldronId = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
          const pos = getNodePosition({ id: cauldronId });
          const cauldronNumber = idx + 1;
          const size = 32;
          const adjustedSize = size * 2.7;
          
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

          const isHovered = hoveredStop === cauldronId;
          const scale = isHovered ? 1.15 : 1;
          const fillColor = isInRoute ? '#6366f1' : '#374151';

          return (
            <g
              key={cauldronId}
              transform={`translate(${pos.x}, ${pos.y}) scale(${scale})`}
              onMouseEnter={() => setHoveredStop(cauldronId)}
              onMouseLeave={() => setHoveredStop(null)}
              className="cursor-pointer"
            >
              {/* Cauldron body - EXACT MapView shape */}
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
              
              {/* Cauldron rim - EXACT MapView shape */}
              <ellipse
                cx="0"
                cy={-adjustedSize * 0.7}
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
              
              {/* Stop numbers with color coding - positioned above cauldron */}
              {stopData.length > 0 && (
                <text
                  x="0"
                  y={-adjustedSize * 2.0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="42"
                  fontWeight="bold"
                  style={{ textShadow: '0 0 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.9)' }}
                >
                  {stopData.map((stop, idx) => (
                    <tspan key={idx} fill={stop.color}>
                      {stop.number}{idx < stopData.length - 1 ? ',' : ''}
                    </tspan>
                  ))}
                </text>
              )}
            </g>
          );
        })}

        {/* Draw market - MapView style */}
        <g transform={`translate(${marketPos.x}, ${marketPos.y})`}>
          {/* Market building */}
          <rect
            x={-60}
            y={-30}
            width={120}
            height={90}
            fill="#8b5cf6"
            stroke="#1f2937"
            strokeWidth="4.5"
            rx="8"
          />
          {/* Roof */}
          <path
            d={`M -72 -30 L 0 -78 L 72 -30 Z`}
            fill="#7c3aed"
            stroke="#1f2937"
            strokeWidth="4.5"
          />
          {/* Door */}
          <rect
            x={-18}
            y={18}
            width={36}
            height={42}
            fill="#6d28d9"
            stroke="#1f2937"
            strokeWidth="3"
            rx="6"
          />
          {/* Windows */}
          <rect
            x={-42}
            y={-12}
            width={24}
            height={24}
            fill="#fbbf24"
            stroke="#1f2937"
            strokeWidth="2.5"
            rx="3"
          />
          <rect
            x={18}
            y={-12}
            width={24}
            height={24}
            fill="#fbbf24"
            stroke="#1f2937"
            strokeWidth="2.5"
            rx="3"
          />
          {/* Market label */}
          <text
            x="0"
            y="90"
            textAnchor="middle"
            fill="#fbbf24"
            fontSize="24"
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

      {/* Witch selector - moved further down */}
      <div className="absolute top-24 left-4 bg-gray-900/90 p-3 rounded-lg">
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
            <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-xs">1</div>
            <span>Stop order</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RouteVisualization;
