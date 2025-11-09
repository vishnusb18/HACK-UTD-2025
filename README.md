# 🧙‍♀️ PotionFlow - Potion Monitoring Dashboard

# 🧙‍♀️ Poyo's Potion Dashboard

A real-time monitoring dashboard for tracking potion levels across magical cauldrons in the Enchanted Market.

## 🏗️ Project Structure

```
HACK-UTD-2025/
├── backend/                 # Node.js + Express API
│   ├── database/
│   │   ├── init.js         # Database initialization script
│   │   └── potionflow.db   # SQLite database (generated)
│   ├── routes/
│   │   ├── cauldrons.js    # Cauldron endpoints
│   │   ├── tickets.js      # Transport ticket endpoints
│   │   ├── levels.js       # Potion level endpoints
│   │   └── reconcile.js    # Discrepancy detection
│   ├── server.js           # Express server
│   └── package.json
├── frontend/               # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── CauldronTable.jsx
│   │   │   ├── TicketTable.jsx
│   │   │   ├── LevelChart.jsx
│   │   │   └── ReconciliationPanel.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)

### Backend Setup

1. Navigate to the backend directory:
   ```powershell
   cd backend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Initialize the database with sample data:
   ```powershell
   npm run init-db
   ```

4. Start the backend server:
   ```powershell
   npm start
   ```

   The API will be available at `http://localhost:3001`

### Frontend Setup

1. Open a **new terminal** and navigate to the frontend directory:
   ```powershell
   cd frontend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Start the development server:
   ```powershell
   npm run dev
   ```

   The dashboard will be available at `http://localhost:3000`

## 📡 API Integration

**This app now connects to the REAL HackUTD 2025 API!** 🎉

- **Base URL**: `https://hackutd2025.eog.systems`
- **Swagger Docs**: https://hackutd2025.eog.systems/swagger/index.html

### HackUTD API Endpoints (Upstream)

- `GET /api/Information/cauldrons` - All cauldrons info
- `GET /api/Data?start_date=X&end_date=Y` - Historical level data
- `GET /api/Tickets` - Transport tickets

### Your Backend API Endpoints (Proxy)

Your backend (`http://localhost:3001`) proxies and processes the HackUTD API:

### GET `/api/cauldrons`
Get all cauldrons with their properties (location, capacity, fill rates)

### GET `/api/tickets`
Get all transport tickets. Supports query parameters:
- `cauldron_id` - Filter by cauldron
- `date` - Filter by specific date
- `start_date` & `end_date` - Filter by date range

### GET `/api/levels`
Get potion level readings. Supports query parameters:
- `cauldron_id` - Filter by cauldron
- `start_date` & `end_date` - Filter by timestamp range (Unix timestamps)
- `limit` - Maximum number of records

### GET `/api/levels/latest`
Get the most recent level reading for each cauldron

### POST `/api/reconcile`
Detect drain events and match with transport tickets

**Request Body:**
```json
{
  "date": "2025-11-07"
}
```

**Response:**
```json
{
  "date": "2025-11-07",
  "summary": {
    "totalCauldrons": 5,
    "cauldronsMismatched": 2,
    "totalDrains": 8,
    "totalTickets": 5
  },
  "details": [...]
}
```

## 🎯 Features

### ✅ Implemented

- **Real HackUTD API Integration**: Fetches live data from `https://hackutd2025.eog.systems`
- **Cauldron Management**: Track all cauldrons with location, capacity, and fill rates
- **Real-time Level Monitoring**: View current potion levels across all cauldrons
- **Transport Ticket Tracking**: Log and review all potion collection tickets
- **Discrepancy Detection**: Automatically detect drains and match with tickets
- **Dashboard UI**: Beautiful, responsive dashboard with multiple views
- **Data Processing**: Backend proxies and processes HackUTD API data

### 🌟 Ready for Extension (Bonus Features)

The base structure is ready for these enhancements:
- **Potion Network Map**: Visualize cauldrons and routes on a map
- **Real-time Updates**: WebSocket integration for live monitoring
- **Forecasting**: Predict fill levels and overflow times
- **Route Optimization**: Calculate optimal witch courier routes
- **Alert System**: Notifications for critical levels or discrepancies

## 🗄️ Database Schema

### Cauldrons Table
- `id`: Primary key
- `cauldron_id`: Unique identifier (e.g., "C001")
- `name`: Cauldron name
- `latitude` / `longitude`: Location coordinates
- `max_volume`: Maximum capacity
- `fill_rate`: Potion accumulation rate (L/min)
- `drain_rate`: Collection rate (L/min)

### Potion Levels Table
- `id`: Primary key
- `cauldron_id`: Foreign key to cauldrons
- `timestamp`: Reading timestamp
- `volume`: Current potion volume (L)

### Transport Tickets Table
- `id`: Primary key
- `ticket_id`: Unique identifier
- `cauldron_id`: Foreign key to cauldrons
- `date`: Collection date
- `volume_collected`: Amount collected (L)

## 🛠️ Technology Stack

**Backend:**
- Node.js + Express
- SQLite with better-sqlite3
- CORS enabled

**Frontend:**
- React 18
- Vite (build tool)
- Tailwind CSS (styling)
- Modern ES6+ JavaScript

## 📝 Development Scripts

### Backend
```powershell
npm start      # Start server
npm run dev    # Start with hot reload (Node 18+)
npm run init-db # Initialize database
```

### Frontend
```powershell
npm run dev     # Start dev server
npm run build   # Build for production
npm run preview # Preview production build
```

## 🎨 Dashboard Features

1. **Overview Tab**: Summary stats and current cauldron status
2. **Cauldrons Tab**: Detailed view of all cauldrons with fill percentages
3. **Tickets Tab**: Searchable list of transport tickets
4. **Reconcile Tab**: Run discrepancy detection for any date

## 🧪 Data Source

The app now fetches **REAL DATA** from the HackUTD 2025 API:
- **Live Cauldrons**: Actual cauldron configurations from the competition
- **Historical Data**: Real potion level readings over time
- **Transport Tickets**: Actual collection records for validation

## 🔧 Troubleshooting

**Backend won't start:**
- Make sure port 3001 is not in use
- Run `npm run init-db` to create the database

**Frontend can't connect to backend:**
- Ensure backend is running on port 3001
- Check Vite proxy configuration in `vite.config.js`

**Database errors:**
- Delete `backend/database/potionflow.db` and run `npm run init-db` again

## 🎓 Hackathon Notes

This is the base setup for the HACK UTD 2025 PotionFlow project. The structure is designed to be easily extended with:
- Real API integration for actual data
- Map visualization libraries (Leaflet, Mapbox)
- WebSocket for real-time updates
- Advanced analytics and ML forecasting
- Route optimization algorithms

## 📄 License

MIT License - feel free to use and modify for your hackathon project!

---

Made with ✨ magic for HACK UTD 2025