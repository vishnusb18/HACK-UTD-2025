import { useState } from 'react';

function ReconciliationPanel() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleReconcile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/reconcile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: selectedDate }),
      });

      if (!response.ok) {
        throw new Error('Failed to reconcile data');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
      console.error('Reconciliation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden">
      <div className="p-4 bg-white/5 border-b border-white/20">
        <h2 className="text-xl font-bold text-white">🔍 Discrepancy Detection & Reconciliation</h2>
      </div>
      
      <div className="p-6">
        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-white/10 border border-white/20 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleReconcile}
              disabled={loading}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded shadow-lg transition"
            >
              {loading ? 'Analyzing...' : 'Run Reconciliation'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 p-4 rounded mb-6">
            Error: {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-3">Summary for {results.date}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-purple-200">Total Cauldrons</div>
                  <div className="text-2xl font-bold text-white">{results.summary.totalCauldrons}</div>
                </div>
                <div>
                  <div className="text-xs text-purple-200">Mismatched</div>
                  <div className="text-2xl font-bold text-yellow-400">{results.summary.cauldronsMismatched}</div>
                </div>
                <div>
                  <div className="text-xs text-purple-200">Total Drains</div>
                  <div className="text-2xl font-bold text-white">{results.summary.totalDrains}</div>
                </div>
                <div>
                  <div className="text-xs text-purple-200">Total Tickets</div>
                  <div className="text-2xl font-bold text-white">{results.summary.totalTickets}</div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Cauldron</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Drains</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Total Drained</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Tickets</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Total Ticketed</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Discrepancy</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {results.details.map((detail) => (
                    <tr key={detail.cauldron_id} className="hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white">{detail.cauldron_name}</div>
                        <div className="text-xs text-purple-300">{detail.cauldron_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-purple-200">{detail.drains.length}</td>
                      <td className="px-4 py-3 text-sm text-white font-semibold">
                        {detail.totalDrained.toFixed(2)} L
                      </td>
                      <td className="px-4 py-3 text-sm text-purple-200">{detail.tickets.length}</td>
                      <td className="px-4 py-3 text-sm text-white font-semibold">
                        {detail.totalTicketed.toFixed(2)} L
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${
                          Math.abs(detail.discrepancy) < 10 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {detail.discrepancy > 0 ? '+' : ''}{detail.discrepancy.toFixed(2)} L
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          detail.status === 'OK' 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {detail.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Suspicious Items */}
            {results.details.some(d => d.status === 'SUSPICIOUS') && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-red-300 mb-3">⚠️ Suspicious Activity Detected</h3>
                <div className="space-y-2">
                  {results.details
                    .filter(d => d.status === 'SUSPICIOUS')
                    .map(detail => (
                      <div key={detail.cauldron_id} className="text-sm text-red-200">
                        <span className="font-semibold">{detail.cauldron_name}:</span> {detail.message}
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        )}

        {!results && !loading && (
          <div className="text-center py-12 text-purple-300">
            Select a date and click "Run Reconciliation" to detect discrepancies
          </div>
        )}
      </div>
    </div>
  );
}

export default ReconciliationPanel;
