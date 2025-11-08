import { useMemo } from 'react';

function LevelChart({ levels }) {
  const chartData = useMemo(() => {
    const grouped = {};
    levels.forEach(level => {
      const id = level.cauldronId || level.cauldron_id || level.tankId;
      const volume = level.volume || level.level || 0;
      if (!grouped[id]) {
        grouped[id] = volume;
      }
    });
    return Object.entries(grouped).map(([id, volume]) => ({
      id,
      volume
    }));
  }, [levels]);

  const maxVolume = Math.max(...chartData.map(d => d.volume), 1);

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden">
      <div className="p-4 bg-white/5 border-b border-white/20">
        <h2 className="text-xl font-bold text-white">📊 Current Levels Overview</h2>
      </div>
      <div className="p-6">
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-purple-300">
            No level data available
          </div>
        ) : (
          <div className="space-y-4">
            {chartData.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-white">{item.id}</span>
                  <span className="text-sm text-purple-200">{item.volume.toFixed(1)} L</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 h-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${(item.volume / maxVolume) * 100}%` }}
                  >
                    <span className="text-xs font-semibold text-white">
                      {item.volume > maxVolume * 0.3 ? `${item.volume.toFixed(0)}L` : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LevelChart;
