import { useState } from 'react';

function RouteSchedule({ optimizationResult, cauldrons }) {
  const [selectedCycle, setSelectedCycle] = useState(0);
  const [expandedWitch, setExpandedWitch] = useState(null);

  if (!optimizationResult) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-center text-purple-200">
        No route data available
      </div>
    );
  }

  const { routes, stats, dailySchedule, maxCycleTime } = optimizationResult;

  // Get cauldron name helper
  const getCauldronName = (id) => {
    const cauldron = cauldrons.find(c => 
      (c.id === id || c.cauldronId === id || c.cauldron_id === id)
    );
    return cauldron?.name || id;
  };

  return (
    <div className="space-y-4">
      {/* Statistics Panel */}
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-md rounded-lg shadow-lg border border-white/20 p-6">
        <h2 className="text-2xl font-bold text-white mb-4">📊 Optimization Results</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-purple-200 text-sm mb-1">Minimum Witches</div>
            <div className="text-3xl font-bold text-white">{stats.minWitches || routes.length}</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-purple-200 text-sm mb-1">Cycle Time</div>
            <div className="text-3xl font-bold text-white">{stats.cycleTimeHours}h</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-purple-200 text-sm mb-1">Total Volume/Cycle</div>
            <div className="text-3xl font-bold text-white">{stats.totalVolume}L</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-purple-200 text-sm mb-1">Capacity Usage</div>
            <div className="text-3xl font-bold text-white">{stats.avgCapacityUtilization}%</div>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <div className="text-purple-200 text-sm mb-1">Cycles Per Day</div>
            <div className="text-3xl font-bold text-white">{dailySchedule.cyclesPerDay}</div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-green-500/20 border border-green-500 rounded-lg">
          <div className="flex items-center gap-2 text-green-200">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold">
              This schedule ensures NO cauldron overflows - repeatable indefinitely!
            </span>
          </div>
          <div className="text-green-300 text-sm mt-2">
            Maximum safe cycle time: {(maxCycleTime / 60).toFixed(1)} hours. 
            Schedule must be repeated every {stats.cycleTimeHours} hours to prevent overflow.
          </div>
        </div>
      </div>

      {/* Daily Schedule Selector */}
      {dailySchedule && dailySchedule.cyclesPerDay > 1 && (
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
          <div className="flex items-center gap-4">
            <span className="text-white font-semibold">Select Cycle:</span>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: dailySchedule.cyclesPerDay }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedCycle(i)}
                  className={`px-4 py-2 rounded font-medium transition ${
                    selectedCycle === i
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-purple-200 hover:bg-white/20'
                  }`}
                >
                  Cycle {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Witch Routes */}
      <div className="space-y-3">
        {routes.map((witchRoute, witchIdx) => {
          const isExpanded = expandedWitch === witchIdx;
          const witchColor = ['#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'][witchIdx % 6];
          
          // Calculate totals across all trips for this witch
          const totalVolume = witchRoute.trips.reduce((sum, trip) => sum + trip.totalVolume, 0);
          const totalTime = witchRoute.trips.reduce((sum, trip) => sum + trip.totalTime, 0);
          const totalStops = witchRoute.trips.reduce((sum, trip) => sum + trip.stops.filter(s => !s.isMarket).length, 0);
          
          return (
            <div
              key={witchIdx}
              className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden"
            >
              {/* Witch Header */}
              <div
                className="p-4 cursor-pointer hover:bg-white/5 transition"
                onClick={() => setExpandedWitch(isExpanded ? null : witchIdx)}
                style={{ borderLeft: `4px solid ${witchColor}` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                      style={{ backgroundColor: witchColor + '40' }}
                    >
                      🧙‍♀️
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{witchRoute.witchName}</h3>
                      <div className="text-sm text-purple-200">
                        {witchRoute.trips.length} trips • {totalStops} stops • {totalVolume.toFixed(0)}L • 
                        {(totalTime / 60).toFixed(1)}h total
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-purple-200">Avg Capacity Per Trip</div>
                      <div className="text-lg font-bold text-white">
                        {((totalVolume / witchRoute.trips.length / witchRoute.capacity) * 100).toFixed(0)}%
                      </div>
                    </div>
                    <svg
                      className={`w-6 h-6 text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expanded Route Details */}
              {isExpanded && (
                <div className="border-t border-white/20 p-4 space-y-4">
                  {witchRoute.trips.map((trip, tripIdx) => (
                    <div key={tripIdx} className="bg-white/5 rounded-lg p-3">
                      <h4 className="text-lg font-semibold text-white mb-3">
                        Trip {tripIdx + 1} of {witchRoute.trips.length}
                        <span className="text-sm text-purple-200 ml-3">
                          {trip.stops.filter(s => !s.isMarket).length} stops • {trip.totalVolume.toFixed(0)}L • {(trip.totalTime / 60).toFixed(1)}h
                        </span>
                      </h4>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-white/5">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200 uppercase">Stop #</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200 uppercase">Location</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200 uppercase">Time</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200 uppercase">Duration</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200 uppercase">Volume</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-purple-200 uppercase">Cumulative</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10">
                            {/* Starting at market */}
                            <tr className="bg-pink-500/10">
                              <td className="px-4 py-2 text-sm font-mono text-purple-200">Start</td>
                              <td className="px-4 py-2 text-sm font-medium text-white">🏪 Market</td>
                              <td className="px-4 py-2 text-sm text-purple-200">00:00</td>
                              <td className="px-4 py-2 text-sm text-purple-200">-</td>
                              <td className="px-4 py-2 text-sm text-purple-200">-</td>
                              <td className="px-4 py-2 text-sm font-semibold text-white">0L</td>
                            </tr>

                            {trip.stops.map((stop, stopIdx) => {
                              const cumulativeVolume = trip.stops
                                .slice(0, stopIdx + 1)
                                .reduce((sum, s) => sum + (s.volumeCollected || 0), 0);

                              const arrivalMinutes = stop.arrivalTime;
                              const hours = Math.floor(arrivalMinutes / 60);
                              const mins = Math.floor(arrivalMinutes % 60);
                              const arrivalTime = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

                              // Calculate total duration at this stop (travel + drain/unload)
                              const totalDuration = (stop.travelTime || 0) + (stop.drainTime || 0);

                              return (
                                <tr
                                  key={stopIdx}
                                  className={stop.isMarket ? 'bg-pink-500/10' : 'hover:bg-white/5'}
                                >
                                  <td className="px-4 py-2 text-sm font-mono text-purple-200">
                                    {stop.isMarket ? 'End' : stopIdx + 1}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-medium text-white">
                                    {stop.isMarket ? '🏪 Market (Unload)' : `🔮 ${getCauldronName(stop.cauldronId)}`}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-purple-200">{arrivalTime}</td>
                                  <td className="px-4 py-2 text-sm text-purple-200">
                                    {stop.isMarket 
                                      ? `${stop.drainTime.toFixed(1)} min (unload)` 
                                      : `${totalDuration.toFixed(1)} min (${stop.travelTime.toFixed(1)} travel + ${stop.drainTime.toFixed(1)} drain)`
                                    }
                                  </td>
                                  <td className="px-4 py-2 text-sm font-semibold text-white">
                                    {stop.isMarket ? '-' : `${stop.volumeCollected.toFixed(1)}L`}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-semibold text-white">
                                    {stop.isMarket ? '0L (unloaded)' : `${cumulativeVolume.toFixed(1)}L`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Trip Summary */}
                      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-purple-200">Travel:</span>
                          <span className="text-white font-semibold ml-1">
                            {trip.stops.reduce((sum, s) => sum + (s.travelTime || 0), 0).toFixed(1)} min
                          </span>
                        </div>
                        <div>
                          <span className="text-purple-200">Drain:</span>
                          <span className="text-white font-semibold ml-1">
                            {trip.stops.reduce((sum, s) => sum + (s.drainTime || 0), 0).toFixed(1)} min
                          </span>
                        </div>
                        <div>
                          <span className="text-purple-200">Efficiency:</span>
                          <span className="text-white font-semibold ml-1">
                            {((trip.totalVolume / trip.totalTime) * 60).toFixed(1)} L/hr
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RouteSchedule;
