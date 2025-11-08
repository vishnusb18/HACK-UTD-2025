# 🚀 Quick Start Guide - PotionFlow with HackUTD API

## Start Your Application

### Terminal 1 - Backend
```powershell
cd c:\Users\vishn\HACK-UTD-2025\backend
npm start
```
✅ Backend running at: `http://localhost:3001`

### Terminal 2 - Frontend
```powershell
cd c:\Users\vishn\HACK-UTD-2025\frontend
npm run dev
```
✅ Dashboard at: `http://localhost:3000`

## 🎯 What's Working Now

### ✅ Real Data Integration
- **Cauldrons**: Live from HackUTD API
- **Levels**: Historical potion data
- **Tickets**: Transport records
- **Discrepancy Detection**: Drain vs ticket matching

### ✅ Dashboard Features
1. **Overview Tab**: Summary cards + current levels
2. **Cauldrons Tab**: Detailed cauldron info with fill %
3. **Tickets Tab**: All transport tickets (filterable)
4. **Reconcile Tab**: Date-based discrepancy detection

## 📡 API Endpoints

| Your Backend | HackUTD Upstream |
|-------------|------------------|
| `GET /api/cauldrons` | `GET /api/Information/cauldrons` |
| `GET /api/levels` | `GET /api/Data?start_date=X&end_date=Y` |
| `GET /api/tickets` | `GET /api/Tickets` |
| `POST /api/reconcile` | Custom (uses all 3 above) |

## 🔧 Common Commands

### Backend
```powershell
# Start server
npm start

# Check if running
Invoke-WebRequest http://localhost:3001/api/health
```

### Frontend
```powershell
# Start dev server
npm run dev

# Build for production
npm run build
```

### Kill Processes (if needed)
```powershell
# Stop all Node processes
Get-Process node | Stop-Process -Force
```

## 🎨 Dashboard Usage

### View Cauldrons
1. Open `http://localhost:3000`
2. Check "Overview" or "Cauldrons" tab
3. See real-time fill percentages

### Check Tickets
1. Click "Tickets" tab
2. Filter by cauldron (dropdown)
3. View all collections

### Run Discrepancy Detection
1. Click "Reconcile" tab
2. Select a date
3. Click "Run Reconciliation"
4. View results:
   - ✅ Green = OK
   - ⚠️ Red = SUSPICIOUS

## 🐛 Quick Fixes

### Port Already in Use
```powershell
Get-Process node | Stop-Process -Force
```

### Data Not Loading
- Check both servers are running
- Hard refresh browser (Ctrl+Shift+R)
- Check DevTools console for errors

### API Connection Issues
- Verify internet connection
- Test upstream API: https://hackutd2025.eog.systems/swagger/index.html

## 📚 File Structure

```
backend/
  ├── routes/          ← API endpoint handlers
  │   ├── cauldrons.js
  │   ├── levels.js
  │   ├── tickets.js
  │   └── reconcile.js
  └── server.js        ← Main server file

frontend/
  ├── src/
  │   ├── components/  ← React components
  │   │   ├── CauldronTable.jsx
  │   │   ├── TicketTable.jsx
  │   │   ├── LevelChart.jsx
  │   │   └── ReconciliationPanel.jsx
  │   └── App.jsx      ← Main app
  └── vite.config.js   ← Proxy config
```

## 🏆 Ready for Demo!

Your app is now:
- ✅ Connected to real HackUTD data
- ✅ Displaying live cauldron levels
- ✅ Tracking transport tickets
- ✅ Detecting discrepancies
- ✅ Ready for presentation!

## 🌟 Bonus Features to Add

1. **Map Visualization** - Show cauldrons on a map
2. **Route Optimization** - Witch courier scheduling
3. **Forecasting** - Predict overflow times
4. **Alerts** - Notifications for critical levels
5. **Export Data** - CSV/JSON download
6. **Historical Playback** - Time-slider for data

---

Good luck at HackUTD 2025! 🧙‍♀️✨
