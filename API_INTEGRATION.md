# HackUTD 2025 API Integration Guide

## ✅ Integration Complete!

Your PotionFlow application now fetches **REAL DATA** from the HackUTD 2025 competition API!

## 🔗 API Details

**Base URL**: `https://hackutd2025.eog.systems`
**Swagger Documentation**: https://hackutd2025.eog.systems/swagger/index.html

## 📊 Integrated Endpoints

### 1. Cauldrons (`/api/cauldrons`)
**Upstream**: `GET https://hackutd2025.eog.systems/api/Information/cauldrons`
**Your Backend**: `GET http://localhost:3001/api/cauldrons`

Fetches all cauldron information including:
- Cauldron ID
- Name
- Location (latitude/longitude)
- Maximum volume
- Fill rate
- Drain rate

### 2. Potion Levels (`/api/levels`)
**Upstream**: `GET https://hackutd2025.eog.systems/api/Data?start_date=X&end_date=Y`
**Your Backend**: `GET http://localhost:3001/api/levels`

Fetches historical potion level data with:
- Cauldron ID
- Timestamp
- Volume/Level

**Query Parameters**:
- `cauldron_id` - Filter by specific cauldron
- `start_date` - Start timestamp (Unix)
- `end_date` - End timestamp (Unix)
- `limit` - Max records to return

**Special Endpoint**: `/api/levels/latest` - Gets the most recent reading for each cauldron

### 3. Transport Tickets (`/api/tickets`)
**Upstream**: `GET https://hackutd2025.eog.systems/api/Tickets`
**Your Backend**: `GET http://localhost:3001/api/tickets`

Fetches all transport tickets with:
- Ticket ID
- Cauldron ID
- Date/Timestamp
- Volume collected

**Query Parameters**:
- `cauldron_id` - Filter by cauldron
- `date` - Filter by specific date (YYYY-MM-DD)
- `start_date` & `end_date` - Date range filter

### 4. Discrepancy Detection (`/api/reconcile`)
**Your Backend**: `POST http://localhost:3001/api/reconcile`

Custom endpoint that:
1. Fetches cauldrons, tickets, and level data from HackUTD API
2. Detects drain events (significant level decreases)
3. Matches drains with transport tickets
4. Identifies discrepancies (missing or excess tickets)

**Request**:
```json
{
  "date": "2025-11-07"
}
```

**Response**:
```json
{
  "date": "2025-11-07",
  "summary": {
    "totalCauldrons": 5,
    "cauldronsMismatched": 2,
    "totalDrains": 8,
    "totalTickets": 5
  },
  "details": [
    {
      "cauldron_id": "C001",
      "cauldron_name": "Mystic Brew",
      "drains": [...],
      "tickets": [...],
      "totalDrained": 750.5,
      "totalTicketed": 700.0,
      "discrepancy": 50.5,
      "status": "SUSPICIOUS",
      "message": "Missing tickets: 50.50 units unaccounted"
    }
  ]
}
```

## 🔧 Implementation Details

### Data Normalization

The backend handles different field name formats from the HackUTD API:

**Cauldron ID variants**:
- `cauldronId`, `cauldron_id`, `id`, `tankId`

**Volume variants**:
- `volume`, `level`, `volumeCollected`, `volume_collected`

**Timestamp variants**:
- `timestamp`, `date`

### Error Handling

All endpoints include try-catch error handling and return appropriate HTTP status codes:
- `200` - Success
- `400` - Bad request (missing required parameters)
- `404` - Resource not found
- `500` - Server error (upstream API issues)

## 🎯 Frontend Integration

The frontend components have been updated to handle the real API data structure:

### CauldronTable
- Displays all cauldrons from HackUTD API
- Shows fill percentages based on real-time levels
- Color-coded status (OK, Warning, Critical)

### TicketTable
- Lists all transport tickets
- Filterable by cauldron
- Shows volume collected and dates

### LevelChart
- Visualizes current potion levels
- Bar chart representation
- Auto-scales based on data

### ReconciliationPanel
- Interactive date picker
- Run discrepancy detection
- View detailed drain vs ticket analysis
- Flag suspicious activity

## 🚀 Testing the Integration

1. **Check Backend Health**:
   ```powershell
   Invoke-WebRequest http://localhost:3001/api/health
   ```

2. **Test Cauldrons Endpoint**:
   ```powershell
   Invoke-WebRequest http://localhost:3001/api/cauldrons
   ```

3. **Test Levels Endpoint**:
   ```powershell
   Invoke-WebRequest "http://localhost:3001/api/levels?limit=10"
   ```

4. **Test Tickets Endpoint**:
   ```powershell
   Invoke-WebRequest http://localhost:3001/api/tickets
   ```

5. **Test Reconciliation** (via dashboard):
   - Navigate to "Reconcile" tab
   - Select a date
   - Click "Run Reconciliation"

## 📝 Key Changes Made

1. ✅ Removed SQLite database dependency
2. ✅ Updated all route handlers to use `fetch()` for HackUTD API
3. ✅ Added data normalization for different field name formats
4. ✅ Updated frontend components to handle API data structure
5. ✅ Maintained backward compatibility with existing UI
6. ✅ Added comprehensive error handling
7. ✅ Updated README with API integration details

## 🎓 Next Steps for Your Hackathon

Now that you have real data integration, you can:

1. **Enhance Discrepancy Detection**: Improve the algorithm based on actual data patterns
2. **Add Visualization**: Use libraries like Chart.js or D3.js for better data viz
3. **Map Integration**: Use Leaflet/Mapbox to show cauldron locations
4. **Route Optimization**: Implement the bonus feature for witch courier routes
5. **Real-time Updates**: Add WebSocket support for live monitoring
6. **Forecasting**: Build ML models to predict fill levels and overflow times
7. **Alerts**: Add notification system for critical levels or discrepancies

## 🐛 Troubleshooting

**Issue**: Can't connect to HackUTD API
- Check your internet connection
- Verify the API is online: https://hackutd2025.eog.systems/swagger/index.html
- Check for CORS errors in browser console

**Issue**: Data not displaying
- Open browser DevTools (F12) and check Network tab
- Verify backend is running on port 3001
- Check console for error messages

**Issue**: Frontend shows old data
- Hard refresh the page (Ctrl+Shift+R)
- Clear browser cache
- Restart the frontend dev server

## 🏆 Good Luck!

Your PotionFlow application is now fully integrated with the HackUTD 2025 API and ready for competition! 🧙‍♀️✨
