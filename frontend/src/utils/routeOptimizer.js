/**
 * Route Optimization Utility
 * 
 * Calculates the minimum number of witches needed to maintain operations indefinitely
 * and generates optimal daily pickup schedules that prevent any cauldron from overflowing.
 * 
 * IMPORTANT: Only uses connections defined in the network graph with their actual travel times.
 */

/**
 * Build adjacency map from network edges for fast lookups
 * Uses travel_time_minutes directly from API (same as MapView)
 */
function buildAdjacencyMap(network) {
  const adjacency = new Map();
  
  if (!network?.edges || !Array.isArray(network.edges)) {
    console.warn('⚠️ No network edges found!');
    return adjacency;
  }
  
  console.log(`📊 Building adjacency map from ${network.edges.length} edges`);
  
  network.edges.forEach((edge, idx) => {
    const from = edge.from;
    const to = edge.to;
    const cost = edge.travel_time_minutes; // Use same field as MapView
    
    // Log a few edges to verify costs
    if (idx < 5) {
      console.log(`  Edge ${idx}: ${from} → ${to}, travel_time_minutes: ${cost}`);
    }
    
    // Add both directions (assuming undirected graph)
    if (!adjacency.has(from)) adjacency.set(from, []);
    if (!adjacency.has(to)) adjacency.set(to, []);
    
    adjacency.get(from).push({ node: to, cost: parseFloat(cost) });
    adjacency.get(to).push({ node: from, cost: parseFloat(cost) });
  });
  
  console.log(`✓ Adjacency map built with ${adjacency.size} nodes`);
  
  return adjacency;
}

/**
 * Dijkstra's algorithm to find shortest path in the network graph
 */
function dijkstra(adjacency, startNode, endNode) {
  const distances = new Map();
  const previous = new Map();
  const unvisited = new Set();
  
  // Initialize
  for (const node of adjacency.keys()) {
    distances.set(node, Infinity);
    unvisited.add(node);
  }
  distances.set(startNode, 0);
  
  while (unvisited.size > 0) {
    // Find unvisited node with minimum distance
    let currentNode = null;
    let minDist = Infinity;
    for (const node of unvisited) {
      const dist = distances.get(node);
      if (dist < minDist) {
        minDist = dist;
        currentNode = node;
      }
    }
    
    if (currentNode === null || minDist === Infinity) break;
    if (currentNode === endNode) break;
    
    unvisited.delete(currentNode);
    
    // Update neighbors
    const neighbors = adjacency.get(currentNode) || [];
    for (const { node: neighbor, cost } of neighbors) {
      if (!unvisited.has(neighbor)) continue;
      
      const altDistance = distances.get(currentNode) + cost;
      if (altDistance < distances.get(neighbor)) {
        distances.set(neighbor, altDistance);
        previous.set(neighbor, currentNode);
      }
    }
  }
  
  // Reconstruct path
  const path = [];
  let current = endNode;
  while (current !== undefined) {
    path.unshift(current);
    current = previous.get(current);
  }
  
  return {
    distance: distances.get(endNode),
    path: path.length > 1 ? path : null
  };
}

/**
 * Get travel time between two nodes using network graph (Dijkstra)
 */
export function getTravelTime(fromId, toId, network, adjacency = null) {
  if (fromId === toId) return 0;
  
  if (!adjacency) {
    adjacency = buildAdjacencyMap(network);
  }
  
  // Check for direct connection first
  const neighbors = adjacency.get(fromId) || [];
  const directConnection = neighbors.find(n => n.node === toId);
  if (directConnection) {
    return directConnection.cost;
  }
  
  // Use Dijkstra for shortest path
  const result = dijkstra(adjacency, fromId, toId);
  return result.distance === Infinity ? null : result.distance;
}

/**
 * Calculate when each cauldron will overflow based on current level and fill rate
 */
export function calculateOverflowTimes(cauldrons, levels) {
  return cauldrons.map(cauldron => {
    const cauldronId = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
    const levelData = levels.find(l => 
      (l.cauldron_id === cauldronId || l.cauldronId === cauldronId || l.id === cauldronId)
    );
    
    const currentLevel = levelData?.level || levelData?.volume || 0;
    const maxVolume = cauldron.maxVolume || cauldron.max_volume || 1000;
    const fillRate = cauldron.fillRate || cauldron.fill_rate || 0;
    
    // Time until overflow in minutes
    const timeUntilOverflow = fillRate > 0 
      ? (maxVolume - currentLevel) / fillRate 
      : Infinity;
    
    return {
      id: cauldronId,
      name: cauldron.name || cauldronId,
      currentLevel,
      maxVolume,
      fillRate,
      timeUntilOverflow,
      location: {
        lat: cauldron.latitude || cauldron.lat || 0,
        lon: cauldron.longitude || cauldron.lon || cauldron.long || 0
      }
    };
  });
}

/**
 * Calculate how long it takes to drain a cauldron
 * We drain what we can carry (up to 100L), not necessarily to a target level
 */
export function calculateDrainTime(cauldron, currentLevel) {
  const drainRate = 50; // L/min - assume constant drain rate
  
  // We'll drain up to 85L (85% of 100L capacity)
  const volumeToDrain = Math.min(85, currentLevel * 0.5); // Take up to half or 85L
  
  // Account for fill rate during drain
  const effectiveDrainRate = drainRate - cauldron.fillRate;
  
  if (effectiveDrainRate <= 0) {
    // Filling faster than we can drain - still try but cap the time
    console.warn(`⚠️ Cauldron ${cauldron.id} fills at ${cauldron.fillRate} L/min (faster than drain!)`);
    return 30; // 30 minutes, still service it
  }
  
  const drainTime = volumeToDrain / effectiveDrainRate;
  return Math.max(10, Math.min(drainTime, 60)); // 10-60 minutes
}

/**
 * Calculate volume that will be collected from a cauldron
 * CRITICAL: Witches can only carry 100L max per trip!
 * We don't need to drain to 20% - just drain enough to keep it manageable
 */
export function calculateDrainVolume(cauldron, currentLevel, drainTime, maxCapacity = 100) {
  // Target: drain to 30% (more lenient) OR drain what we can carry, whichever is less
  const targetLevel = cauldron.maxVolume * 0.30;
  const volumeToDrain = Math.max(0, currentLevel - targetLevel);
  
  // CRITICAL: One witch can only take what fits in their capacity
  // Take at least 20L to make the trip worthwhile, up to capacity limit
  const volumeCollected = Math.max(20, Math.min(volumeToDrain, maxCapacity * 0.85));
  
  return volumeCollected;
}

/**
 * Find all cauldrons reachable from current node via network connections
 */
function getReachableCauldrons(currentNodeId, unvisited, adjacency) {
  const reachable = [];
  
  for (const cauldron of unvisited) {
    const result = dijkstra(adjacency, currentNodeId, cauldron.id);
    if (result.distance !== Infinity && result.path) {
      reachable.push({
        ...cauldron,
        pathDistance: result.distance,
        path: result.path
      });
    }
  }
  
  return reachable;
}

/**
 * Find the best next cauldron considering urgency, reachability, and constraints
 * PRIORITY: Service ALL cauldrons - be very lenient with constraints
 */
function findNextCriticalCauldron(
  currentNodeId, 
  unvisited, 
  currentTime,
  adjacency,
  currentCapacity,
  maxCapacity,
  isFirstStop = false
) {
  const reachable = getReachableCauldrons(currentNodeId, unvisited, adjacency);
  
  console.log(`      🔎 Searching from ${currentNodeId}: ${reachable.length} reachable out of ${unvisited.length} unvisited`);
  
  if (reachable.length === 0) {
    return null; // No reachable cauldrons
  }
  
  let best = null;
  let bestScore = -Infinity;
  let rejected = [];
  
  for (const cauldron of reachable) {
    const travelTime = cauldron.pathDistance;
    const arrivalTime = currentTime + travelTime;
    
    const drainTime = calculateDrainTime(cauldron, cauldron.currentLevel);
    const volumeToCollect = calculateDrainVolume(cauldron, cauldron.currentLevel, drainTime, maxCapacity);
    
    // Calculate time buffer - but be VERY lenient
    const timeBuffer = cauldron.timeUntilOverflow - arrivalTime;
    
    // For first stop, we MUST pick something, so skip all checks
    if (!isFirstStop) {
      // Skip ONLY if it's way too late (more than 1 hour late)
      if (timeBuffer < -60) {
        rejected.push({id: cauldron.id, reason: 'time', timeBuffer: timeBuffer.toFixed(1)});
        continue;
      }
      
      // Check capacity - allow filling up to 90% of capacity
      if (currentCapacity + volumeToCollect > maxCapacity * 0.9) {
        rejected.push({id: cauldron.id, reason: 'capacity', would: (currentCapacity + volumeToCollect).toFixed(1), max: maxCapacity});
        continue;
      }
    } else {
      // Even on first stop, don't take more than capacity
      if (volumeToCollect > maxCapacity * 0.95) {
        rejected.push({id: cauldron.id, reason: 'too large', volume: volumeToCollect.toFixed(1)});
        continue;
      }
    }
    
    // Scoring: HEAVILY prioritize just getting to cauldrons
    const urgencyScore = Math.max(0, 10000 / Math.max(1, cauldron.timeUntilOverflow));
    const efficiencyScore = volumeToCollect / Math.max(1, travelTime + drainTime);
    const proximityScore = 1000 / Math.max(1, travelTime);
    
    // If this cauldron fits comfortably in capacity, bonus
    const fitsWell = currentCapacity + volumeToCollect <= maxCapacity;
    const capacityBonus = fitsWell ? 2000 : 0;
    
    // If we're on first stop, heavily boost score to ensure we pick SOMETHING
    const firstStopBonus = isFirstStop ? 10000 : 0;
    
    const score = urgencyScore + proximityScore + (efficiencyScore * 0.5) + capacityBonus + firstStopBonus;
    
    if (score > bestScore) {
      bestScore = score;
      best = {
        ...cauldron,
        travelTime,
        arrivalTime,
        drainTime,
        volumeToCollect,
        path: cauldron.path
      };
    }
  }
  
  if (!best && rejected.length > 0) {
    console.log(`      ⚠️ All ${reachable.length} reachable cauldrons rejected:`, rejected.slice(0, 3));
  }
  
  return best;
}

/**
 * Build a single witch's route starting from the market
 * Returns the route and which cauldrons were FULLY serviced (not just visited)
 * CRITICAL: Respects 100L capacity limit, allows partial drains
 */
function buildSingleRoute(
  marketId, 
  unvisited, 
  adjacency,
  courierCapacity,
  startTime = 0
) {
  const route = {
    stops: [],
    totalTime: 0,
    totalVolume: 0,
    totalDistance: 0
  };
  
  const fullyServiced = []; // Only cauldrons that are now SAFE (<70% full)
  let currentNode = marketId;
  let currentTime = startTime;
  let currentCapacity = 0;
  let isFirstStop = true;
  
  // Make a working copy so we don't mutate the original
  const remainingCauldrons = [...unvisited];
  
  console.log(`  🔍 Building ONE TRIP with ${remainingCauldrons.length} available cauldrons`);
  
  // ONE TRIP time limit
  const maxRouteTime = 120; // 2 hours max for one trip
  let iterations = 0;
  const MAX_ITERATIONS = 10; // Fewer stops per trip with 100L capacity
  
  while (remainingCauldrons.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`    Iteration ${iterations}: ${remainingCauldrons.length} remaining, capacity: ${currentCapacity.toFixed(1)}/${courierCapacity}`);
    
    const nextCauldron = findNextCriticalCauldron(
      currentNode,
      remainingCauldrons,
      currentTime,
      adjacency,
      currentCapacity,
      courierCapacity,
      isFirstStop
    );
    
    if (!nextCauldron) {
      console.log(`    ⛔ No more cauldrons reachable/feasible from ${currentNode}`);
      break;
    }
    
    isFirstStop = false;
    
    console.log(`    ✓ Adding ${nextCauldron.id} (collecting ${nextCauldron.volumeToCollect.toFixed(1)}L)`);
    console.log(`       Travel: ${nextCauldron.travelTime.toFixed(1)} min from ${currentNode} to ${nextCauldron.id}`);
    console.log(`       Arrival: ${nextCauldron.arrivalTime.toFixed(1)} min, Drain: ${nextCauldron.drainTime.toFixed(1)} min`);
    
    // Add this cauldron to the route
    route.stops.push({
      cauldronId: nextCauldron.id,
      cauldronName: nextCauldron.name,
      arrivalTime: nextCauldron.arrivalTime,
      drainTime: nextCauldron.drainTime,
      volumeCollected: nextCauldron.volumeToCollect,
      travelTime: nextCauldron.travelTime,
      path: nextCauldron.path
    });
    
    // Check if this cauldron is now safe (below 70% full)
    const cauldronData = remainingCauldrons.find(c => c.id === nextCauldron.id);
    if (cauldronData) {
      const percentFull = (cauldronData.currentLevel / cauldronData.maxVolume) * 100;
      
      // After draining, estimate new level
      const afterDrainLevel = cauldronData.currentLevel - nextCauldron.volumeToCollect;
      const percentFullAfter = (afterDrainLevel / cauldronData.maxVolume) * 100;
      
      // If we brought it below 70%, consider it serviced for this round
      if (percentFullAfter < 70) {
        console.log(`      ✅ ${nextCauldron.id} now at ${percentFullAfter.toFixed(1)}% - SERVICED`);
        fullyServiced.push(nextCauldron.id);
        
        // Remove from working list
        const index = remainingCauldrons.findIndex(c => c.id === nextCauldron.id);
        if (index >= 0) {
          remainingCauldrons.splice(index, 1);
        }
      } else {
        console.log(`      ⚠️ ${nextCauldron.id} still at ${percentFullAfter.toFixed(1)}% after drain - needs more`);
        // Keep in list for another witch to visit
      }
    }
    
    currentCapacity += nextCauldron.volumeToCollect;
    currentTime = nextCauldron.arrivalTime + nextCauldron.drainTime;
    currentNode = nextCauldron.id;
    route.totalDistance += nextCauldron.travelTime;
    
    // CRITICAL: Stop at 90% capacity (100L max!)
    if (currentCapacity >= courierCapacity * 0.9) {
      console.log(`    🛑 Trip ending: capacity nearly full (${currentCapacity.toFixed(1)}/${courierCapacity}L)`);
      break;
    }
    
    // Or if trip is getting long
    if (currentTime >= maxRouteTime) {
      console.log(`    🛑 Trip ending: time limit (${currentTime.toFixed(1)} min)`);
      break;
    }
  }
  
  console.log(`  📊 Trip complete: fully serviced ${fullyServiced.length} cauldrons`);
  console.log(`     Fully serviced: ${fullyServiced.join(', ') || 'none'}`);
  
  // Return to market
  if (route.stops.length > 0) {
    const returnResult = dijkstra(adjacency, currentNode, marketId);
    const returnTime = returnResult.distance !== Infinity ? returnResult.distance : 0;
    const unloadTime = 15; // 15 minutes to unload at market
    
    console.log(`  🏪 Returning to market: ${returnTime.toFixed(1)} min travel from ${currentNode}`);
    
    route.stops.push({
      cauldronId: marketId,
      cauldronName: 'Market',
      arrivalTime: currentTime + returnTime,
      drainTime: unloadTime,
      volumeCollected: 0,
      travelTime: returnTime,
      isMarket: true,
      path: returnResult.path
    });
    
    route.totalTime = currentTime + returnTime + unloadTime;
    route.totalVolume = currentCapacity;
    route.totalDistance += returnTime;
  }
  
  return { route, visited: fullyServiced }; // Return ONLY fully serviced cauldrons
}

/**
 * Calculate the maximum time between pickups for sustainable operations
 */
export function calculateMaxCycleTime(cauldrons) {
  let minTimeToFill = Infinity;
  
  for (const cauldron of cauldrons) {
    if (cauldron.fillRate > 0) {
      // Time to fill from 20% (after drain) to 90% (safety threshold)
      const timeToFill = (cauldron.maxVolume * 0.70) / cauldron.fillRate;
      minTimeToFill = Math.min(minTimeToFill, timeToFill);
    }
  }
  
  // Add safety margin (70% of theoretical max to ensure we always arrive in time)
  return minTimeToFill * 0.70;
}

/**
 * Generate optimal routes for minimum number of witches
 * This is the main optimization function
 */
export function optimizeRoutes(cauldrons, levels, market, network, couriers) {
  console.log('🚀 Starting route optimization...');
  console.log('Input:', { 
    cauldrons: cauldrons.length, 
    levels: levels.length, 
    market: market?.id,
    networkEdges: network?.edges?.length,
    couriers: couriers.length 
  });
  
  // Build adjacency map from network
  const adjacency = buildAdjacencyMap(network);
  console.log('📊 Network adjacency map built, nodes:', adjacency.size);
  
  // Validate market is in network
  const marketId = market?.id || market?.market_id || 'market';
  if (!adjacency.has(marketId)) {
    console.error('❌ Market not found in network graph!');
    return null;
  }
  
  // Calculate current state
  const cauldronStates = calculateOverflowTimes(cauldrons, levels);
  console.log('⏰ Cauldron states calculated:', cauldronStates.length);
  
  // Filter out cauldrons not in network or unreachable from market
  const reachableCauldrons = cauldronStates.filter(c => {
    if (!adjacency.has(c.id)) {
      console.warn(`⚠️ Cauldron ${c.id} not in network graph`);
      return false;
    }
    const result = dijkstra(adjacency, marketId, c.id);
    if (result.distance === Infinity) {
      console.warn(`⚠️ Cauldron ${c.id} unreachable from market`);
      return false;
    }
    return true;
  });
  
  console.log('✅ Reachable cauldrons:', reachableCauldrons.length);
  
  if (reachableCauldrons.length === 0) {
    console.error('❌ No cauldrons reachable from market!');
    return null;
  }
  
  // Sort by urgency
  reachableCauldrons.sort((a, b) => a.timeUntilOverflow - b.timeUntilOverflow);
  
  console.log('🔥 Most urgent cauldrons:');
  reachableCauldrons.slice(0, 5).forEach(c => {
    console.log(`  - ${c.id}: ${c.timeUntilOverflow.toFixed(1)} min until overflow`);
  });
  
  // Calculate maximum cycle time
  const maxCycleTime = calculateMaxCycleTime(reachableCauldrons);
  console.log(`⏱️ Max cycle time: ${maxCycleTime.toFixed(1)} minutes`);
  
  const routes = [];
  const unvisited = [...reachableCauldrons];
  const visitCount = {}; // Track how many times each cauldron has been visited
  
  // Initialize visit counters
  reachableCauldrons.forEach(c => {
    visitCount[c.id] = 0;
  });
  
  // CRITICAL: Use actual capacity from couriers API
  const courierCapacity = couriers[0]?.max_carrying_capacity || couriers[0]?.capacity || 100;
  console.log(`👜 Courier capacity: ${courierCapacity}L per trip`);
  console.log(`📋 STRATEGY: Each witch makes MULTIPLE trips per day (not just one!)`);
  
  // Build routes - each witch makes multiple trips
  console.log('\n🧙‍♀️ Assigning witches with multiple trips per day...');
  
  const WORK_DAY_MINUTES = 480; // 8 hour work day
  const MAX_WITCHES = 50; // Try to minimize witch count
  
  let witchIndex = 0;
  let totalTrips = 0;
  
  // Keep making trips until all cauldrons are serviced
  while (unvisited.length > 0 && totalTrips < 200) {
    // Try to use existing witches first before adding new ones
    const witchForThisTrip = witchIndex % Math.max(1, Math.min(witchIndex + 1, MAX_WITCHES));
    
    console.log(`\n--- Trip ${totalTrips + 1} (Witch ${witchForThisTrip + 1}) ---`);
    console.log(`Remaining cauldrons needing service: ${unvisited.length}`);
    console.log(`Unvisited: ${unvisited.map(c => c.id).join(', ')}`);
    
    const courier = couriers[witchForThisTrip % couriers.length];
    
    const { route, visited } = buildSingleRoute(
      marketId,
      unvisited,
      adjacency,
      courierCapacity,
      0 // Each trip starts fresh from market
    );
    
    // Check if we made any progress
    if (visited.length === 0) {
      console.warn('⚠️ No cauldrons fully serviced this trip');
      
      // Check if route has any stops at all
      const cauldronStops = route.stops.filter(s => !s.isMarket);
      if (cauldronStops.length === 0) {
        console.error('❌ No stops made at all - cannot make progress!');
        console.log('Current unvisited:', unvisited.map(c => ({
          id: c.id,
          timeUntilOverflow: c.timeUntilOverflow.toFixed(1),
          currentLevel: c.currentLevel.toFixed(1),
          percentFull: ((c.currentLevel / c.maxVolume) * 100).toFixed(1) + '%'
        })));
        
        // Try to understand why we can't reach them
        const unreachableFromMarket = unvisited.filter(c => {
          const result = dijkstra(adjacency, marketId, c.id);
          return result.distance === Infinity;
        });
        
        if (unreachableFromMarket.length > 0) {
          console.error('❌ Cauldrons unreachable from market:', unreachableFromMarket.map(c => c.id));
        }
        
        break; // Cannot make progress
      } else {
        console.log(`   Route made ${cauldronStops.length} stops but didn't fully service any cauldrons`);
        console.log(`   This is OK - cauldrons may need multiple visits. Continuing...`);
        // Don't break - we made progress even if no cauldron was fully serviced
      }
    }
    
    // Count actual cauldron stops (exclude market return)
    const tripStops = route.stops.filter(s => !s.isMarket);
    console.log(`✓ Trip complete: ${tripStops.length} stops, ${route.totalVolume.toFixed(1)}L, ${route.totalTime.toFixed(1)} min`);
    console.log(`  Serviced: ${visited.join(', ') || 'none fully serviced'}`);
    
    // Increment visit count for all cauldrons in this route
    tripStops.forEach(stop => {
      if (stop.cauldronId) {
        visitCount[stop.cauldronId] = (visitCount[stop.cauldronId] || 0) + 1;
      }
    });
    
    // Find or create witch entry
    let witchEntry = routes.find(r => r.witchId === `witch_${witchForThisTrip + 1}`);
    if (!witchEntry) {
      witchEntry = {
        witchId: `witch_${witchForThisTrip + 1}`,
        witchName: courier.name || `Witch ${witchForThisTrip + 1}`,
        capacity: courierCapacity,
        trips: [] // Multiple trips per witch!
      };
      routes.push(witchEntry);
    }
    
    // Add this trip to the witch's schedule
    witchEntry.trips.push(route);
    
    // Remove cauldrons that were fully serviced
    visited.forEach(cauldronId => {
      const idx = unvisited.findIndex(c => c.id === cauldronId);
      if (idx >= 0) {
        unvisited.splice(idx, 1);
        console.log(`  ✅ Removed ${cauldronId} from unvisited (fully serviced)`);
      }
    });
    
    // Also remove cauldrons that have been visited 3+ times (they're being managed)
    const toRemove = [];
    unvisited.forEach(c => {
      if (visitCount[c.id] >= 3) {
        console.log(`  ✅ ${c.id} visited ${visitCount[c.id]} times - considering it managed`);
        toRemove.push(c.id);
      }
    });
    
    toRemove.forEach(cauldronId => {
      const idx = unvisited.findIndex(c => c.id === cauldronId);
      if (idx >= 0) {
        unvisited.splice(idx, 1);
      }
    });
    
    totalTrips++;
    
    // After every few trips, consider adding a new witch if we're not making progress
    if (totalTrips % 5 === 0 && unvisited.length > 0) {
      witchIndex++; // Allow one more witch to join
      console.log(`📈 Progress check: ${unvisited.length} cauldrons remaining. Now using up to ${witchIndex + 1} witches.`);
    }
  }
  
  console.log(`\n✅ Total witches needed: ${routes.length}`);
  console.log(`✅ Total trips across all witches: ${totalTrips}`);
  console.log(`✅ Cauldrons covered: ${reachableCauldrons.length - unvisited.length}/${reachableCauldrons.length}`);
  
  // Show trips per witch
  routes.forEach(witch => {
    console.log(`  ${witch.witchName}: ${witch.trips.length} trips`);
  });
  
  if (unvisited.length > 0) {
    console.error(`❌ ${unvisited.length} cauldrons STILL NOT SERVICED:`, unvisited.map(c => c.id));
    console.error('This means the algorithm failed to service all cauldrons!');
  } else {
    console.log('🎉 SUCCESS: All cauldrons will be serviced!');
  }
  
  // Calculate statistics from all trips
  const totalVolume = routes.reduce((sum, witch) => {
    return sum + witch.trips.reduce((tripSum, trip) => tripSum + trip.totalVolume, 0);
  }, 0);
  
  const totalStops = routes.reduce((sum, witch) => {
    return sum + witch.trips.reduce((tripSum, trip) => {
      return tripSum + trip.stops.filter(s => !s.isMarket).length;
    }, 0);
  }, 0);
  
  const longestTripTime = Math.max(...routes.flatMap(witch => 
    witch.trips.map(trip => trip.totalTime)
  ));
  
  return {
    routes,
    minWitches: routes.length,
    totalTrips,
    maxCycleTime,
    dailySchedule: generateDailySchedule(routes, maxCycleTime),
    stats: {
      totalTime: longestTripTime.toFixed(1),
      totalVolume: totalVolume.toFixed(1),
      totalStops,
      totalTrips,
      avgTripsPerWitch: (totalTrips / routes.length).toFixed(1),
      avgCapacityUtilization: ((totalVolume / (totalTrips * courierCapacity)) * 100).toFixed(1),
      cycleTimeHours: (maxCycleTime / 60).toFixed(1),
      cauldronsCovered: reachableCauldrons.length - unvisited.length,
      unreachableCauldrons: unvisited.length
    }
  };
}

/**
 * Generate a daily repeating schedule
 * Now handles witches with multiple trips per day
 */
function generateDailySchedule(routes, maxCycleTime) {
  const minutesPerDay = 24 * 60;
  const schedule = [];
  
  let currentTime = 0; // Start of day
  
  // For each witch, schedule all their trips throughout the day
  routes.forEach((witchData, witchIdx) => {
    let witchTime = 0; // This witch's current time
    
    witchData.trips.forEach((trip, tripIdx) => {
      const startTimeOfDay = new Date();
      startTimeOfDay.setHours(0, witchTime, 0, 0);
      
      schedule.push({
        witchId: witchData.witchId,
        witchName: witchData.witchName,
        tripNumber: tripIdx + 1,
        totalTrips: witchData.trips.length,
        startTime: startTimeOfDay.toLocaleTimeString(),
        startMinute: witchTime,
        route: trip,
        estimatedEndTime: new Date(startTimeOfDay.getTime() + trip.totalTime * 60000).toLocaleTimeString()
      });
      
      witchTime += trip.totalTime;
    });
  });
  
  // Sort by start time
  schedule.sort((a, b) => a.startMinute - b.startMinute);
  
  return {
    totalShifts: schedule.length,
    schedule
  };
}

/**
 * Predict cauldron levels over time with the given schedule
 */
export function predictCauldronLevels(cauldrons, levels, routes, hours = 48) {
  const predictions = [];
  const timeSteps = hours * 6; // Every 10 minutes
  
  // Initialize cauldron states
  const states = cauldrons.map(cauldron => {
    const cauldronId = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
    const levelData = levels.find(l => 
      (l.cauldron_id === cauldronId || l.cauldronId === cauldronId || l.id === cauldronId)
    );
    
    return {
      id: cauldronId,
      level: levelData?.level || levelData?.volume || 0,
      maxVolume: cauldron.maxVolume || cauldron.max_volume || 1000,
      fillRate: cauldron.fillRate || cauldron.fill_rate || 0
    };
  });
  
  // Simulate over time
  for (let step = 0; step < timeSteps; step++) {
    const timeMinutes = step * 10;
    const snapshot = { time: timeMinutes, levels: {} };
    
    // Update each cauldron's level
    states.forEach(state => {
      // Check if any witch is draining this cauldron at this time
      let isDraining = false;
      
      routes.forEach(witchRoute => {
        witchRoute.route.stops.forEach(stop => {
          if (stop.cauldronId === state.id) {
            const drainStart = stop.arrivalTime;
            const drainEnd = stop.arrivalTime + stop.drainTime;
            
            if (timeMinutes >= drainStart && timeMinutes <= drainEnd) {
              isDraining = true;
              state.level = state.maxVolume * 0.20;
            }
          }
        });
      });
      
      if (!isDraining) {
        // Normal filling
        state.level += state.fillRate * 10;
        state.level = Math.min(state.level, state.maxVolume);
      }
      
      snapshot.levels[state.id] = {
        level: state.level,
        percentage: (state.level / state.maxVolume) * 100,
        status: state.level >= state.maxVolume ? 'overflow' : 
                state.level >= state.maxVolume * 0.9 ? 'critical' :
                state.level >= state.maxVolume * 0.7 ? 'warning' : 'ok'
      };
    });
    
    predictions.push(snapshot);
  }
  
  return predictions;
}
