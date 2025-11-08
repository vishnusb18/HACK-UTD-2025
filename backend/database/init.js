import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'potionflow.db'));

console.log('🧪 Initializing PotionFlow Database...');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS cauldrons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cauldron_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    max_volume REAL NOT NULL,
    fill_rate REAL NOT NULL,
    drain_rate REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS potion_levels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cauldron_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    volume REAL NOT NULL,
    FOREIGN KEY (cauldron_id) REFERENCES cauldrons(cauldron_id)
  );

  CREATE TABLE IF NOT EXISTS transport_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id TEXT UNIQUE NOT NULL,
    cauldron_id TEXT NOT NULL,
    date DATE NOT NULL,
    volume_collected REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cauldron_id) REFERENCES cauldrons(cauldron_id)
  );

  CREATE INDEX IF NOT EXISTS idx_levels_cauldron_time ON potion_levels(cauldron_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_tickets_date ON transport_tickets(date);
`);

console.log('✅ Tables created successfully');

// Insert sample cauldrons
const insertCauldron = db.prepare(`
  INSERT OR REPLACE INTO cauldrons (cauldron_id, name, latitude, longitude, max_volume, fill_rate, drain_rate)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const sampleCauldrons = [
  ['C001', 'Mystic Brew', 40.7128, -74.0060, 1000, 2.5, 50],
  ['C002', 'Dragon\'s Essence', 34.0522, -118.2437, 1500, 3.0, 60],
  ['C003', 'Moonlight Elixir', 41.8781, -87.6298, 800, 1.8, 40],
  ['C004', 'Phoenix Tears', 29.7604, -95.3698, 1200, 2.2, 55],
  ['C005', 'Starlight Potion', 33.4484, -112.0740, 900, 2.0, 45]
];

const insertMany = db.transaction((cauldrons) => {
  for (const cauldron of cauldrons) {
    insertCauldron.run(...cauldron);
  }
});

insertMany(sampleCauldrons);
console.log('✅ Sample cauldrons inserted');

// Insert sample potion levels (last 7 days, hourly data)
const insertLevel = db.prepare(`
  INSERT INTO potion_levels (cauldron_id, timestamp, volume)
  VALUES (?, ?, ?)
`);

const now = new Date();
const levels = [];

sampleCauldrons.forEach(([cauldronId, _, __, ___, maxVolume, fillRate]) => {
  for (let day = 6; day >= 0; day--) {
    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(now);
      timestamp.setDate(timestamp.getDate() - day);
      timestamp.setHours(hour, 0, 0, 0);
      
      // Simulate fill and drain cycles
      const hoursSinceStart = (6 - day) * 24 + hour;
      const cycleHours = hoursSinceStart % 20; // 20-hour cycle
      let volume = cycleHours < 15 ? cycleHours * fillRate * 60 : maxVolume * 0.2; // Fill for 15 hours, drain, repeat
      volume = Math.min(volume, maxVolume);
      
      levels.push([cauldronId, timestamp.toISOString(), volume]);
    }
  }
});

const insertLevels = db.transaction((levelData) => {
  for (const level of levelData) {
    insertLevel.run(...level);
  }
});

insertLevels(levels);
console.log('✅ Sample potion levels inserted');

// Insert sample transport tickets
const insertTicket = db.prepare(`
  INSERT OR REPLACE INTO transport_tickets (ticket_id, cauldron_id, date, volume_collected)
  VALUES (?, ?, ?, ?)
`);

const tickets = [];
sampleCauldrons.forEach(([cauldronId], index) => {
  for (let day = 6; day >= 1; day--) {
    const ticketDate = new Date(now);
    ticketDate.setDate(ticketDate.getDate() - day);
    const dateStr = ticketDate.toISOString().split('T')[0];
    
    const ticketId = `T${String(index + 1).padStart(3, '0')}-${dateStr}`;
    const volumeCollected = 600 + Math.random() * 200; // Random volume 600-800
    
    tickets.push([ticketId, cauldronId, dateStr, volumeCollected]);
  }
});

const insertTickets = db.transaction((ticketData) => {
  for (const ticket of ticketData) {
    insertTicket.run(...ticket);
  }
});

insertTickets(tickets);
console.log('✅ Sample transport tickets inserted');

// Summary
const cauldronCount = db.prepare('SELECT COUNT(*) as count FROM cauldrons').get();
const levelCount = db.prepare('SELECT COUNT(*) as count FROM potion_levels').get();
const ticketCount = db.prepare('SELECT COUNT(*) as count FROM transport_tickets').get();

console.log('\n📊 Database Summary:');
console.log(`   Cauldrons: ${cauldronCount.count}`);
console.log(`   Potion Levels: ${levelCount.count}`);
console.log(`   Transport Tickets: ${ticketCount.count}`);
console.log('\n🎉 Database initialization complete!\n');

db.close();
