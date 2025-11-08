# 📡 API Calls Reference Guide

## Frontend API Calls Location

### 1. **App.jsx** - Main Data Fetching
**Location**: `frontend/src/App.jsx`  
**Lines**: 18-45

#### API Calls Made:
```javascript
const fetchData = async () => {
  try {
    setLoading(true);
    const [cauldronRes, ticketRes, levelRes] = await Promise.all([
      fetch('/api/cauldrons'),        // ← Fetches all cauldrons
      fetch('/api/tickets'),          // ← Fetches all tickets
      fetch('/api/levels/latest')     // ← Fetches latest levels
    ]);

    const cauldronData = await cauldronRes.json();
    const ticketData = await ticketRes.json();
    const levelData = await levelRes.json();

    setCauldrons(cauldronData);
    setTickets(ticketData);
    setLevels(levelData);
  } catch (err) {
    setError(err.message);
  }
};
```

**When Called**: On component mount (page load)

**Data Flow**:
- `cauldronData` → passed to `<CauldronTable />` component
- `ticketData` → passed to `<TicketTable />` component
- `levelData` → passed to `<LevelChart />` and `<CauldronTable />` components

---

### 2. **ReconciliationPanel.jsx** - Discrepancy Detection
**Location**: `frontend/src/components/ReconciliationPanel.jsx`  
**Lines**: 13-36

#### API Call Made:
```javascript
const handleReconcile = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const response = await fetch('/api/reconcile', {  // ← POST request
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ date: selectedDate }),  // ← Sends selected date
    });

    const data = await response.json();
    setResults(data);  // ← Display reconciliation results
  } catch (err) {
    setError(err.message);
  }
};
```

**When Called**: When user clicks "Run Reconciliation" button

**User Interaction**:
1. User selects a date
2. User clicks "Run Reconciliation"
3. `handleReconcile()` is triggered
4. Results displayed in the same component

---

## Component Data Flow

### Components That **Make** API Calls:
1. ✅ **App.jsx** - Makes 3 API calls on mount
2. ✅ **ReconciliationPanel.jsx** - Makes 1 API call on button click

### Components That **Receive** Data (Props):
1. ❌ **CauldronTable.jsx** - Receives `cauldrons` and `levels` as props
2. ❌ **TicketTable.jsx** - Receives `tickets` as props
3. ❌ **LevelChart.jsx** - Receives `levels` as props

---

## Complete API Call Summary

| Component | API Endpoint | Method | When | Purpose |
|-----------|-------------|--------|------|---------|
| **App.jsx** | `/api/cauldrons` | GET | Page load | Fetch all cauldrons |
| **App.jsx** | `/api/tickets` | GET | Page load | Fetch all tickets |
| **App.jsx** | `/api/levels/latest` | GET | Page load | Fetch latest levels |
| **ReconciliationPanel.jsx** | `/api/reconcile` | POST | Button click | Detect discrepancies |

---

## Backend API Routes (What They Call)

### Backend Location: `backend/routes/`

#### 1. **cauldrons.js**
```javascript
// Line 7-17
router.get('/', async (req, res) => {
  const response = await fetch(`${HACKUTD_API}/api/Information/cauldrons`);
  // Fetches from: https://hackutd2025.eog.systems/api/Information/cauldrons
});
```

#### 2. **tickets.js**
```javascript
// Line 7-16
router.get('/', async (req, res) => {
  const response = await fetch(`${HACKUTD_API}/api/Tickets`);
  // Fetches from: https://hackutd2025.eog.systems/api/Tickets
});
```

#### 3. **levels.js**
```javascript
// Line 7-34 (main endpoint)
router.get('/', async (req, res) => {
  const response = await fetch(`${HACKUTD_API}/api/Data?start_date=${startDate}&end_date=${endDate}`);
  // Fetches from: https://hackutd2025.eog.systems/api/Data
});

// Line 37-58 (latest endpoint)
router.get('/latest', async (req, res) => {
  const response = await fetch(`${HACKUTD_API}/api/Data?start_date=0&end_date=2000000000`);
  // Fetches from: https://hackutd2025.eog.systems/api/Data
  // Then groups by cauldron to get latest
});
```

#### 4. **reconcile.js**
```javascript
// Line 7-24 (fetches ALL data)
const [cauldronRes, ticketRes, dataRes] = await Promise.all([
  fetch(`${HACKUTD_API}/api/Information/cauldrons`),
  fetch(`${HACKUTD_API}/api/Tickets`),
  fetch(`${HACKUTD_API}/api/Data?start_date=0&end_date=2000000000`)
]);
// Then processes to detect discrepancies
```

---

## How to Find API Calls in Code

### Search Patterns:
```javascript
// Pattern 1: Frontend API calls
fetch('/api/

// Pattern 2: Backend upstream API calls
fetch(`${HACKUTD_API}

// Pattern 3: Async functions that likely call APIs
const fetchData = async () => {
const handleReconcile = async () => {
```

### VS Code Search:
1. Press `Ctrl+Shift+F` (Search in files)
2. Search for: `fetch\(/api`
3. Or search for: `await fetch`

---

## Quick Reference - File Locations

```
frontend/
  └── src/
      ├── App.jsx                          ← 3 API calls (GET)
      └── components/
          ├── ReconciliationPanel.jsx      ← 1 API call (POST)
          ├── CauldronTable.jsx            ← No API calls (receives props)
          ├── TicketTable.jsx              ← No API calls (receives props)
          └── LevelChart.jsx               ← No API calls (receives props)

backend/
  └── routes/
      ├── cauldrons.js                     ← Calls HackUTD cauldrons API
      ├── tickets.js                       ← Calls HackUTD tickets API
      ├── levels.js                        ← Calls HackUTD data API
      └── reconcile.js                     ← Calls all 3 HackUTD APIs
```

---

## Adding New API Calls

### Frontend Example:
```javascript
// In App.jsx or any component
const fetchNewData = async () => {
  try {
    const response = await fetch('/api/your-endpoint');
    const data = await response.json();
    // Use data...
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### Backend Example:
```javascript
// In backend/routes/yourroute.js
import express from 'express';
const router = express.Router();
const HACKUTD_API = 'https://hackutd2025.eog.systems';

router.get('/', async (req, res) => {
  try {
    const response = await fetch(`${HACKUTD_API}/api/YourEndpoint`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

## Debugging API Calls

### Browser DevTools:
1. Press `F12` to open DevTools
2. Go to **Network** tab
3. Refresh page to see all API calls
4. Click on any request to see:
   - Request URL
   - Response data
   - Headers
   - Timing

### Console Logs:
All API errors are logged to console:
```javascript
console.error('Error fetching data:', err);
console.error('Reconciliation error:', err);
```

---

**Summary**: Only 2 components make API calls:
- ✅ `App.jsx` - 3 GET calls on load
- ✅ `ReconciliationPanel.jsx` - 1 POST call on button click
- All other components receive data via props
