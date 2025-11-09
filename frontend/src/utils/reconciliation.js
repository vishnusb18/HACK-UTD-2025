// Minimal reconciliation utilities for PotionFlow
// Functions: loadTickets, fetchLevelsForDay, computePerCauldronSeries,
// detectDrainEvents, estimateFillRate, correctedDrainVolume, aggregateDrainsPerCauldron, matchTickets

export async function loadTickets() {
  const res = await fetch('/api/tickets');
  if (!res.ok) throw new Error('Failed to load tickets');
  const data = await res.json();
  // handle possible shapes: array, { tickets: [...] }, or error object
  let tickets = [];
  if (Array.isArray(data)) tickets = data;
  else if (data && Array.isArray(data.tickets)) tickets = data.tickets;
  else if (data && data.error && typeof data.error === 'string') {
    // backend returned an error object
    console.warn('loadTickets: API returned error object', data.error);
    tickets = [];
  } else if (data && typeof data === 'object') {
    // maybe single ticket
    tickets = [data];
  }

  return tickets.map(t => ({
    ...t,
    dateStr: t.date ? (new Date(t.date)).toISOString().slice(0, 10) : (t.timestamp ? new Date(t.timestamp).toISOString().slice(0,10) : null),
    amount: Number(t.amount ?? t.volume ?? t.value ?? 0)
  }));
}

export async function fetchLevelsForDay(dateStr) {
  // backend expects UNIX timestamps in seconds for start_date/end_date
  const day = new Date(dateStr + 'T00:00:00Z');
  const start = Math.floor(day.getTime() / 1000);
  const end = Math.floor((new Date(day.getTime() + 24 * 3600 * 1000)).getTime() / 1000) - 1;
  const res = await fetch(`/api/levels?start_date=${start}&end_date=${end}`);
  if (!res.ok) throw new Error('Failed to fetch level data');
  return res.json();
}

export function computePerCauldronSeries(allLevels) {
  const byId = {};
  allLevels.forEach(r => {
    const id = r.cauldronId || r.cauldron_id || r.tankId || r.id;
    const ts = new Date(r.timestamp || r.date).getTime();
    const volume = Number(r.volume ?? r.level ?? r.value ?? 0);
    if (!byId[id]) byId[id] = [];
    byId[id].push({ ts, volume });
  });
  Object.values(byId).forEach(arr => arr.sort((a, b) => a.ts - b.ts));
  return byId;
}

export function detectDrainEvents(series, minDrop = 0.5) {
  // series: [{ts, volume}, ...] sorted
  const events = [];
  let inEvent = false;
  let ev = null;
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    const delta = cur.volume - prev.volume;
    if (delta < 0) {
      if (!inEvent) {
        inEvent = true;
        ev = { startTs: prev.ts, endTs: cur.ts, drop: -delta };
        events.push(ev);
      } else {
        ev.endTs = cur.ts;
        ev.drop += -delta;
      }
    } else {
      inEvent = false;
      ev = null;
    }
  }
  return events.filter(e => e.drop >= minDrop);
}

export function estimateFillRate(series) {
  const slopes = [];
  for (let i = 1; i < series.length; i++) {
    const dtMin = (series[i].ts - series[i - 1].ts) / 60000;
    if (dtMin <= 0) continue;
    const slope = (series[i].volume - series[i - 1].volume) / dtMin;
    if (slope > 0) slopes.push(slope);
  }
  if (!slopes.length) return 0;
  slopes.sort((a, b) => a - b);
  return slopes[Math.floor(slopes.length / 2)];
}

export function correctedDrainVolume(event, fillRate) {
  const durationMin = Math.max(1, (event.endTs - event.startTs) / 60000);
  return event.drop + fillRate * durationMin;
}

export function aggregateDrainsPerCauldron(byId) {
  const out = {};
  Object.entries(byId).forEach(([id, series]) => {
    const fill = estimateFillRate(series);
    const events = detectDrainEvents(series);
    const total = events.reduce((sum, ev) => sum + correctedDrainVolume(ev, fill), 0);
    out[id] = { events, fillRate: fill, drained: total };
  });
  return out;
}

export function aggregateDrainsByDate(perCauldronAgg) {
  // expects perCauldronAgg from aggregateDrainsPerCauldron but we only have per-day series
  const byDate = {};
  Object.entries(perCauldronAgg).forEach(([id, info]) => {
    info.events.forEach(ev => {
      const day = new Date(ev.startTs).toISOString().slice(0, 10);
      byDate[day] = byDate[day] || 0;
      const cv = info.fillRate != null ? correctedDrainVolume(ev, info.fillRate) : ev.drop;
      byDate[day] += cv;
    });
  });
  return byDate;
}

export function matchTicketsToDrains(ticketsForDay, totalDrained, tolPct = 0.15) {
  const ticketSum = ticketsForDay.reduce((s, t) => s + (t.amount || 0), 0);
  const ok = Math.abs(ticketSum - totalDrained) <= Math.max(1, tolPct * ticketSum);
  return { ticketSum, totalDrained, ok, diff: ticketSum - totalDrained };
}
