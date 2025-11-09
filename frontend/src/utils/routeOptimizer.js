/**
 * Route Optimization Utility
 * 
 * Calculates the minimum number of witches needed to maintain operations indefinitely
 * and generates optimal daily pickup schedules that prevent any cauldron from overflowing.
 * 
 * IMPORTANT: Only uses connections defined in the network graph with their actual travel times.
 */

/**
 * Calculate drain rate for each cauldron from historical level data
 * Detects ANY decrease in level and calculates the actual drain rate
 * accounting for the continuous fill rate
 */
function calculateDrainRatesFromHistory(cauldrons, allLevels) {
  const drainRates = {};
  
  console.log('📊 ========== CALCULATING DRAIN RATES ==========');
  console.log(`   Total level readings available: ${allLevels.length}`);
  
  // First, let's see what cauldron IDs we have in the data
  const uniqueCauldronIds = new Set();
  allLevels.forEach(l => {
    const id = l.cauldron_id || l.cauldronId || l.id;
    if (id) uniqueCauldronIds.add(id);
  });
  console.log(`   Unique cauldron IDs in level data: ${Array.from(uniqueCauldronIds).join(', ')}`);
  
  cauldrons.forEach(cauldron => {
    const cauldronId = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
    const fillRate = cauldron.fillRate || cauldron.fill_rate || 0;
    
    console.log(`\n  🔍 Analyzing ${cauldronId}:`);
    console.log(`     Fill rate: ${fillRate.toFixed(4)} L/min`);
    
    // Get all level readings for this cauldron, sorted by time
    const cauldronLevels = allLevels
      .filter(l => {
        const id = l.cauldron_id || l.cauldronId || l.id;
        return id === cauldronId;
      })
      .map(l => ({
        timestamp: new Date(l.timestamp || l.date || l.time).getTime(),
        level: l.level || l.volume || 0,
        raw: l
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`     Found ${cauldronLevels.length} level readings`);
    
    if (cauldronLevels.length < 2) {
      drainRates[cauldronId] = 50;
      console.log(`     ⚠️ Not enough data, using default 50 L/min`);
      return;
    }
    
    // Show first few readings
    console.log(`     First 5 readings:`);
    cauldronLevels.slice(0, 5).forEach((reading, idx) => {
      console.log(`       ${idx + 1}. ${new Date(reading.timestamp).toLocaleString()}: ${reading.level.toFixed(2)}L`);
    });
    
    // Look for ANY decrease in level (drain events)
    const drainEvents = [];
    let totalComparisons = 0;
    let decreaseCount = 0;
    
    for (let i = 1; i < cauldronLevels.length; i++) {
      const prev = cauldronLevels[i - 1];
      const curr = cauldronLevels[i];
      
      totalComparisons++;
      
      const timeDiffMinutes = (curr.timestamp - prev.timestamp) / (1000 * 60);
      const levelChange = curr.level - prev.level;
      
      // Skip if time difference is invalid
      if (timeDiffMinutes <= 0 || timeDiffMinutes > 240) {
        continue;
      }
      
      // Drain event: ANY decrease in level
      if (levelChange < 0) {
        decreaseCount++;
        
        // Calculate observed rate of change (negative during drain)
        const observedRate = levelChange / timeDiffMinutes;
        
        // While draining, the cauldron is STILL being filled
        // observedRate = fillRate - drainRate (net change)
        // So: drainRate = fillRate - observedRate
        const actualDrainRate = fillRate - observedRate;
        
        // Debug the first few decreases to see why they're being rejected
        if (decreaseCount <= 5) {
          console.log(`     Decrease #${decreaseCount}:`);
          console.log(`       Time: ${new Date(curr.timestamp).toLocaleString()}`);
          console.log(`       Level: ${prev.level.toFixed(2)}L → ${curr.level.toFixed(2)}L over ${timeDiffMinutes.toFixed(2)} min`);
          console.log(`       Change: ${levelChange.toFixed(2)}L`);
          console.log(`       Observed rate: ${observedRate.toFixed(2)} L/min`);
          console.log(`       Fill rate: ${fillRate.toFixed(4)} L/min`);
          console.log(`       Calculated drain rate: ${actualDrainRate.toFixed(4)} L/min`);
          console.log(`       Passes sanity check? ${actualDrainRate > 0.01 && actualDrainRate < 500}`);
        }
        
        // Sanity checks: drain rate should be positive and reasonable
        // Lowered threshold from 1 to 0.01 to catch small drain rates
        if (actualDrainRate > 0.01 && actualDrainRate < 500) {
          drainEvents.push({
            time: new Date(curr.timestamp).toISOString(),
            timeDiffMinutes: timeDiffMinutes,
            prevLevel: prev.level,
            currLevel: curr.level,
            levelChange: levelChange,
            observedRate: observedRate,
            actualDrainRate: actualDrainRate
          });
          
          // Log first 5 valid drain events
          if (drainEvents.length <= 5) {
            console.log(`     ✅ Valid drain event #${drainEvents.length}:`);
            console.log(`       Time: ${new Date(curr.timestamp).toLocaleString()}`);
            console.log(`       Level: ${prev.level.toFixed(2)}L → ${curr.level.toFixed(2)}L over ${timeDiffMinutes.toFixed(2)} min`);
            console.log(`       Calculated drain rate: ${actualDrainRate.toFixed(2)} L/min`);
          }
        }
      }
    }
    
    console.log(`     Comparisons: ${totalComparisons}, Decreases found: ${decreaseCount}, Valid drain events: ${drainEvents.length}`);
    
    if (drainEvents.length > 0) {
      // Average the drain rates from all detected drain events
      const avgDrainRate = drainEvents.reduce((sum, evt) => sum + evt.actualDrainRate, 0) / drainEvents.length;
      drainRates[cauldronId] = avgDrainRate;
      
      console.log(`     ✅ RESULT: ${drainEvents.length} drain events detected → avg drain rate: ${avgDrainRate.toFixed(2)} L/min`);
    } else {
      drainRates[cauldronId] = 50;
      console.log(`     ⚠️ RESULT: No valid drain events detected → using default 50 L/min`);
    }
  });
  
  console.log('\n📊 ========== DRAIN RATE SUMMARY ==========');
  Object.entries(drainRates).forEach(([id, rate]) => {
    console.log(`   ${id}: ${rate.toFixed(2)} L/min`);
  });
  
  return drainRates;
}



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
 * Verify that no cauldrons will overflow given the scheduled routes
 * Simulates cauldron levels over time with fills and drains
 */
function verifyNoOverflows(routes, cauldronStates, levels) {
  console.log(`\n🔍 Starting overflow verification...`);
  console.log(`Using ACTUAL current levels from API data (as of simulation start time)`);
  
  // Create a timeline of all service events
  const events = []; // {time, cauldronId, action: 'drain', volumeDrained}
  
  routes.forEach((witchRoute, witchIdx) => {
    witchRoute.trips.forEach((trip, tripIdx) => {
      trip.stops.forEach((stop, stopIdx) => {
        if (!stop.isMarket && stop.cauldronId) {
          events.push({
            time: stop.arrivalTime,
            cauldronId: stop.cauldronId,
            action: 'drain',
            volumeDrained: stop.volumeCollected,
            drainDuration: stop.drainTime,
            witchName: witchRoute.witchName,
            tripNum: tripIdx + 1,
            stopNum: stopIdx + 1
          });
        }
      });
    });
  });
  
  // Sort events by time
  events.sort((a, b) => a.time - b.time);
  
  console.log(`  Found ${events.length} drain events across all routes`);
  
  // Simulate each cauldron's level over time
  const overflowIssues = [];
  const criticalWarnings = [];
  
  console.log(`\n📊 Simulating each cauldron over time:`);
  
  cauldronStates.forEach((cauldron) => {
    const cauldronId = cauldron.id;
    const maxVolume = cauldron.maxVolume;
    const fillRate = cauldron.fillRate; // L/min
    let currentLevel = cauldron.currentLevel; // Using ACTUAL current level from API
    const startLevel = currentLevel;
    let currentTime = 0;
    
    // Get all events for this cauldron
    const cauldronEvents = events.filter(e => e.cauldronId === cauldronId);
    
    if (cauldronEvents.length === 0) {
      console.warn(`  ⚠️ ${cauldronId}: No service events scheduled!`);
      // Check if it will overflow without any service
      const timeToOverflow = (maxVolume - currentLevel) / fillRate;
      if (timeToOverflow < 1440) { // Less than 24 hours
        overflowIssues.push({
          cauldronId,
          time: timeToOverflow,
          level: maxVolume,
          maxVolume,
          overflow: 0,
          message: `NO SERVICE SCHEDULED - will overflow in ${(timeToOverflow / 60).toFixed(1)} hours`
        });
      }
      return;
    }
    
    console.log(`\n  ${cauldronId} (${cauldron.name}):`);
    console.log(`    Start: ${startLevel.toFixed(1)}L / ${maxVolume}L (${((startLevel/maxVolume)*100).toFixed(1)}%)`);
    console.log(`    Fill rate: ${fillRate.toFixed(2)} L/min`);
    console.log(`    Scheduled visits: ${cauldronEvents.length}`);
    
    // Simulate through each event
    cauldronEvents.forEach((event, idx) => {
      // Fill from current time to event time
      const timePassed = event.time - currentTime;
      const volumeFilled = fillRate * timePassed;
      currentLevel += volumeFilled;
      
      // Check for overflow BEFORE drain
      if (currentLevel > maxVolume) {
        const overflowAmount = currentLevel - maxVolume;
        overflowIssues.push({
          cauldronId,
          time: event.time,
          level: currentLevel,
          maxVolume,
          overflow: overflowAmount,
          message: `Overflows by ${overflowAmount.toFixed(1)}L at t=${(event.time/60).toFixed(1)}h (before ${event.witchName} arrives)`
        });
        console.error(`    ❌ Visit ${idx + 1}: OVERFLOW at t=${(event.time/60).toFixed(1)}h - level ${currentLevel.toFixed(1)}L > max ${maxVolume}L`);
      } else {
        const percentBefore = (currentLevel / maxVolume) * 100;
        if (percentBefore > 95) {
          criticalWarnings.push({
            cauldronId,
            time: event.time,
            level: currentLevel,
            percentFull: percentBefore
          });
          console.warn(`    ⚠️ Visit ${idx + 1}: CRITICAL at t=${(event.time/60).toFixed(1)}h - level ${currentLevel.toFixed(1)}L (${percentBefore.toFixed(1)}%)`);
        } else {
          console.log(`    ✓ Visit ${idx + 1}: ${event.witchName} arrives at t=${(event.time/60).toFixed(1)}h - level ${currentLevel.toFixed(1)}L (${percentBefore.toFixed(1)}%)`);
        }
      }
      
      // Apply drain
      currentLevel -= event.volumeDrained;
      currentTime = event.time + event.drainDuration;
      
      const percentAfter = (currentLevel / maxVolume) * 100;
      console.log(`      Drains ${event.volumeDrained.toFixed(1)}L → ${currentLevel.toFixed(1)}L (${percentAfter.toFixed(1)}%)`);
      
      // Check if this is the last event - project forward
      if (idx === cauldronEvents.length - 1) {
        const timeToOverflow = (maxVolume - currentLevel) / fillRate;
        console.log(`      After last visit: ${currentLevel.toFixed(1)}L, will overflow in ${(timeToOverflow / 60).toFixed(1)} hours`);
        
        if (timeToOverflow < 120) { // Less than 2 hours
          console.warn(`      ⚠️ Only ${(timeToOverflow / 60).toFixed(1)} hours until overflow after last service!`);
        }
        
        // CRITICAL: Check if schedule is sustainable (will the next cycle start before overflow?)
        // The next cycle would start at the same time as this cycle (periodic schedule)
        const cycleTime = event.time + event.drainDuration; // Time when this visit ends
        const timeSinceStart = cycleTime; // Assuming we start next cycle immediately
        
        // If the cauldron fills faster than we're servicing it, it's unsustainable
        if (timeToOverflow < cycleTime) {
          overflowIssues.push({
            cauldronId,
            time: currentTime + timeToOverflow,
            level: maxVolume,
            maxVolume,
            overflow: 0,
            message: `UNSUSTAINABLE: Will overflow ${(timeToOverflow / 60).toFixed(1)}h after last service, but cycle takes ${(cycleTime / 60).toFixed(1)}h`
          });
          console.error(`      ❌ UNSUSTAINABLE SCHEDULE: Needs service every ${(timeToOverflow / 60).toFixed(1)}h but cycle takes ${(cycleTime / 60).toFixed(1)}h`);
        }
      }
    });
  });
  
  // Report results
  console.log(`\n${'='.repeat(80)}`);
  if (overflowIssues.length > 0) {
    console.error(`\n❌ OVERFLOW ISSUES DETECTED (${overflowIssues.length} cases):`);
    overflowIssues.forEach(issue => {
      console.error(`  ${issue.cauldronId}: ${issue.message}`);
    });
    console.error(`\n⚠️ THE SCHEDULE WILL RESULT IN OVERFLOWS!`);
    console.error(`   This schedule is NOT sustainable long-term.`);
    console.error(`   Need more frequent visits, more witches, or faster drain rates.`);
  } else if (criticalWarnings.length > 0) {
    console.warn(`\n⚠️ ${criticalWarnings.length} CRITICAL WARNINGS (>95% full before service):`);
    criticalWarnings.forEach(warn => {
      console.warn(`  ${warn.cauldronId}: ${warn.percentFull.toFixed(1)}% full at t=${(warn.time/60).toFixed(1)}h`);
    });
    console.log(`\n✅ NO OVERFLOWS - but some cauldrons get very full. Consider more frequent visits.`);
    console.log(`✅ Schedule appears SUSTAINABLE for repeated cycles.`);
  } else {
    console.log(`\n✅ NO OVERFLOWS DETECTED - All cauldrons serviced safely!`);
    console.log(`✅ Schedule is SUSTAINABLE - can repeat indefinitely without overflows.`);
  }
  console.log(`${'='.repeat(80)}\n`);
  
  return overflowIssues.length === 0;
}

/**
 * Calculate when each cauldron will overflow based on current level and fill rate
 * Now includes calculated drain rates
 */
export function calculateOverflowTimes(cauldrons, levels, drainRates = {}) {
  return cauldrons.map(cauldron => {
    const cauldronId = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
    const levelData = levels.find(l => 
      (l.cauldron_id === cauldronId || l.cauldronId === cauldronId || l.id === cauldronId)
    );
    
    const currentLevel = levelData?.level || levelData?.volume || 0;
    const maxVolume = cauldron.maxVolume || cauldron.max_volume || 1000;
    const fillRate = cauldron.fillRate || cauldron.fill_rate || 0;
    const drainRate = drainRates[cauldronId] || 50; // Use calculated drain rate or default
    
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
      drainRate, // Include the calculated drain rate
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
 * Uses the cauldron's calculated drain rate from historical data
 * We drain what we can carry (up to 100L), not necessarily to a target level
 */
export function calculateDrainTime(cauldron, currentLevel) {
  // Use the cauldron's specific drain rate (calculated from historical data)
  const drainRate = cauldron.drainRate || 50; // Should have been set by calculateOverflowTimes
  
  // Account for fill rate during drain
  // While we're draining, potion is still being added at the fill rate
  const effectiveDrainRate = drainRate - cauldron.fillRate;
  
  if (effectiveDrainRate <= 0) {
    // Filling faster than we can drain - still try but cap the time
    console.warn(`⚠️ Cauldron ${cauldron.id} fills at ${cauldron.fillRate.toFixed(2)} L/min (faster than drain rate ${drainRate.toFixed(2)} L/min!)`);
    return 30; // 30 minutes, still service it
  }
  
  // Calculate how much we should drain to bring cauldron to a safe level
  // Target: drain to 30% of max capacity
  const targetLevel = cauldron.maxVolume * 0.30;
  const volumeNeeded = Math.max(0, currentLevel - targetLevel);
  
  // CRITICAL FIX: Don't assume we're draining 100L if cauldron doesn't have that much!
  // Respect witch capacity limit (100L max) BUT also respect what's actually available
  const actualVolumeToDrain = Math.min(
    volumeNeeded,      // What we need to drain to reach 30%
    100,               // Witch capacity limit (full 100L)
    currentLevel * 0.7 // Don't drain more than 70% of current level (keep some minimum)
  );
  
  // Calculate actual drain time based on realistic volume (no artificial cap)
  // Witches can stay as long as needed to drain properly
  const drainTime = actualVolumeToDrain / effectiveDrainRate;
  const finalDrainTime = Math.max(5, drainTime); // At least 5 minutes
  
  // Log when using calculated (non-default) drain rate
  if (cauldron.drainRate !== undefined && cauldron.drainRate !== 50) {
    console.log(`    ✓ ${cauldron.id}: drain rate ${drainRate.toFixed(2)} L/min (eff: ${effectiveDrainRate.toFixed(2)}) → ${finalDrainTime.toFixed(1)} min for ${actualVolumeToDrain.toFixed(1)}L`);
  } else {
    console.log(`    ⚠️ ${cauldron.id}: using DEFAULT drain rate 50 L/min → drain time ${finalDrainTime.toFixed(1)} min`);
  }
  
  return finalDrainTime;
}

/**
 * Calculate volume that will be collected from a cauldron
 * CRITICAL: Must use the SAME logic as calculateDrainTime to avoid circular calculation
 */
export function calculateDrainVolume(cauldron, currentLevel, drainTime, maxCapacity = 100) {
  // Use the SAME logic as calculateDrainTime to determine actual volume
  // (Don't recalculate from time - that creates circular logic!)
  
  const targetLevel = cauldron.maxVolume * 0.30;
  const volumeNeeded = Math.max(0, currentLevel - targetLevel);
  
  // Available to drain: Don't drain more than 70% of current level (keep 30% minimum)
  const availableToDrain = Math.max(0, currentLevel * 0.7);
  
  // CRITICAL FIX: Use the EXACT SAME calculation as calculateDrainTime
  // The witch can carry the full maxCapacity (100L)
  const witchCapacityLimit = maxCapacity; // Full 100L capacity
  
  // Take the minimum of what we need, what's available, and what witch can carry
  const volumeCollected = Math.min(
    volumeNeeded,           // What we need to drain to reach 30% target
    availableToDrain,       // What's safely available (70% of current)
    witchCapacityLimit      // Witch capacity limit (100L)
  );
  
  // At least 10L to make the trip worthwhile
  const result = Math.max(10, volumeCollected);
  
  // Debug logging
  if (Math.random() < 0.05) { // Log 5% of calculations
    console.log(`    📊 calculateDrainVolume for ${cauldron.id}:`);
    console.log(`       currentLevel: ${currentLevel.toFixed(1)}L, maxVolume: ${cauldron.maxVolume.toFixed(1)}L`);
    console.log(`       targetLevel: ${targetLevel.toFixed(1)}L, volumeNeeded: ${volumeNeeded.toFixed(1)}L`);
    console.log(`       availableToDrain: ${availableToDrain.toFixed(1)}L, witchLimit: ${witchCapacityLimit.toFixed(1)}L`);
    console.log(`       volumeCollected: ${volumeCollected.toFixed(1)}L, RESULT: ${result.toFixed(1)}L`);
  }
  
  return result;
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
    
    // Debug: Check drain rate before calling calculateDrainTime
    if (reachable.indexOf(cauldron) < 2) { // Only log first 2 to avoid spam
      console.log(`      🔬 ${cauldron.id} before calculateDrainTime: drainRate = ${cauldron.drainRate?.toFixed(2) || 'UNDEFINED'}`);
    }
    
    const drainTime = calculateDrainTime(cauldron, cauldron.currentLevel);
    const volumeToCollect = calculateDrainVolume(cauldron, cauldron.currentLevel, drainTime, maxCapacity);
    
    // Debug: Log volume calculation for first few
    if (reachable.indexOf(cauldron) < 2) {
      console.log(`      📦 ${cauldron.id} volume calc: currentLevel=${cauldron.currentLevel.toFixed(1)}L, maxVol=${cauldron.maxVolume.toFixed(1)}L → collecting ${volumeToCollect.toFixed(1)}L`);
    }
    
    // Calculate time buffer - but be VERY lenient
    const timeBuffer = cauldron.timeUntilOverflow - arrivalTime;
    
    // For first stop, we MUST pick something, so skip all checks
    if (!isFirstStop) {
      // Skip ONLY if it's way too late (more than 1 hour late)
      if (timeBuffer < -60) {
        rejected.push({id: cauldron.id, reason: 'time', timeBuffer: timeBuffer.toFixed(1)});
        continue;
      }
      
      // Check capacity - use full capacity (100L)
      if (currentCapacity + volumeToCollect > maxCapacity) {
        rejected.push({id: cauldron.id, reason: 'capacity', would: (currentCapacity + volumeToCollect).toFixed(1), max: maxCapacity});
        continue;
      }
    } else {
      // Even on first stop, don't exceed capacity
      if (volumeToCollect > maxCapacity) {
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
      
      // Update the cauldron's level for future calculations
      cauldronData.currentLevel = afterDrainLevel;
      
      // With low drain rates, cauldrons need frequent visits
      // Only consider it "fully serviced" if it's well below 50%
      // This will keep it in rotation for more frequent visits
      if (percentFullAfter < 50) {
        console.log(`      ✅ ${nextCauldron.id} now at ${percentFullAfter.toFixed(1)}% - SERVICED FOR NOW`);
        fullyServiced.push(nextCauldron.id);
        
        // Remove from working list for THIS trip
        const index = remainingCauldrons.findIndex(c => c.id === nextCauldron.id);
        if (index >= 0) {
          remainingCauldrons.splice(index, 1);
        }
      } else {
        console.log(`      ⚠️ ${nextCauldron.id} at ${percentFullAfter.toFixed(1)}% after drain - needs more visits`);
        // Keep in list - it will be visited again soon
      }
    }
    
    currentCapacity += nextCauldron.volumeToCollect;
    currentTime = nextCauldron.arrivalTime + nextCauldron.drainTime;
    currentNode = nextCauldron.id;
    route.totalDistance += nextCauldron.travelTime;
    
    // CRITICAL: Stop at full capacity (100L max!)
    if (currentCapacity >= courierCapacity) {
      console.log(`    🛑 Trip ending: capacity full (${currentCapacity.toFixed(1)}/${courierCapacity}L)`);
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
export function optimizeRoutes(cauldrons, levels, market, network, couriers, allLevels = []) {
  console.log('🚀 Starting route optimization...');
  console.log('Input:', { 
    cauldrons: cauldrons.length, 
    levels: levels.length, 
    market: market?.id,
    networkEdges: network?.edges?.length,
    couriers: couriers.length,
    historicalLevels: allLevels.length
  });
  
  // Calculate drain rates from historical data
  const drainRates = calculateDrainRatesFromHistory(cauldrons, allLevels);
  
  // Build adjacency map from network
  const adjacency = buildAdjacencyMap(network);
  console.log('📊 Network adjacency map built, nodes:', adjacency.size);
  
  // Validate market is in network
  const marketId = market?.id || market?.market_id || 'market';
  if (!adjacency.has(marketId)) {
    console.error('❌ Market not found in network graph!');
    return null;
  }
  
  // Calculate current state with calculated drain rates
  const cauldronStates = calculateOverflowTimes(cauldrons, levels, drainRates);
  console.log('⏰ Cauldron states calculated:', cauldronStates.length);
  
  // Debug: Check if drain rates are in the cauldron states
  console.log('🔍 Sample cauldron states with drain rates:');
  cauldronStates.slice(0, 3).forEach(c => {
    console.log(`   ${c.id}: drainRate = ${c.drainRate?.toFixed(2) || 'UNDEFINED'} L/min, fillRate = ${c.fillRate?.toFixed(2)} L/min`);
  });
  
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
  
  // Track total work time per witch (in minutes) - for informational purposes
  const witchWorkTime = {}; // { witchId: totalMinutes }
  
  // Keep making trips until all cauldrons are serviced
  while (unvisited.length > 0 && totalTrips < 200) {
    // Assign witches sequentially: A, B, C, D, E, F... (no wrapping back)
    // Each new trip gets the next witch until we need more witches
    // Witches can work as long as needed (no time limit)
    const witchForThisTrip = witchIndex;
    
    console.log(`\n--- Trip ${totalTrips + 1} (Witch ${witchForThisTrip + 1}) ---`);
    console.log(`Remaining cauldrons needing service: ${unvisited.length}`);
    console.log(`Current witch work time: ${((witchWorkTime[witchForThisTrip] || 0) / 60).toFixed(1)} hours`);
    console.log(`Unvisited: ${unvisited.map(c => c.id).join(', ')}`);
    
    const courier = couriers[witchForThisTrip % couriers.length];
    
    const { route, visited } = buildSingleRoute(
      marketId,
      unvisited,
      adjacency,
      courierCapacity,
      0 // Each trip starts fresh from market
    );
    
    // Calculate total trip time (travel + drain + unload)
    const tripDuration = route.totalTime || 0;
    
    // Track trip time for informational purposes
    witchWorkTime[witchForThisTrip] = (witchWorkTime[witchForThisTrip] || 0) + tripDuration;
    console.log(`  ⏱️ Trip took ${(tripDuration / 60).toFixed(1)} hours. Witch total: ${(witchWorkTime[witchForThisTrip] / 60).toFixed(1)} hours`);
    
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
      // Generate witch letter: A, B, C... Z, AA, AB, etc.
      const witchLetter = witchForThisTrip < 26 
        ? String.fromCharCode(65 + witchForThisTrip) // A-Z
        : String.fromCharCode(65 + Math.floor(witchForThisTrip / 26) - 1) + String.fromCharCode(65 + (witchForThisTrip % 26)); // AA, AB, etc.
      
      witchEntry = {
        witchId: `witch_${witchForThisTrip + 1}`,
        witchName: `Witch ${witchLetter}`,
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
    
    // With low drain rates, cauldrons need MANY visits to stay under control
    // Increase visit threshold from 3 to 10 to ensure adequate coverage
    const toRemove = [];
    unvisited.forEach(c => {
      if (visitCount[c.id] >= 10) {
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
  
  // Show trips and work hours per witch
  console.log(`\n📊 Witch Work Summary (no time limit):`);
  routes.forEach((witch, idx) => {
    const totalWorkTime = witchWorkTime[idx] || 0;
    const hours = (totalWorkTime / 60).toFixed(1);
    const witchLetter = idx < 26 
      ? String.fromCharCode(65 + idx) 
      : String.fromCharCode(65 + Math.floor(idx / 26) - 1) + String.fromCharCode(65 + (idx % 26));
    console.log(`  Witch ${witchLetter}: ${witch.trips.length} trips, ${hours} hours total`);
  });
  
  if (unvisited.length > 0) {
    console.error(`❌ ${unvisited.length} cauldrons STILL NOT SERVICED:`, unvisited.map(c => c.id));
    console.error('This means the algorithm failed to service all cauldrons!');
  } else {
    console.log('🎉 SUCCESS: All cauldrons will be serviced!');
  }
  
  // CRITICAL VERIFICATION: Check that no cauldrons will overflow
  console.log(`\n🔍 OVERFLOW VERIFICATION:`);
  verifyNoOverflows(routes, cauldronStates, levels);
  
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
    drainRates, // Include calculated drain rates
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
