import { useMemo } from 'react';

function CauldronTable({ cauldrons, levels, detailed = false }) {
  console.log('CauldronTable - cauldrons:', cauldrons);
  console.log('CauldronTable - levels:', levels);
  
  const cauldronData = useMemo(() => {
    return cauldrons.map(cauldron => {
      const cauldronId = cauldron.id || cauldron.cauldronId || cauldron.cauldron_id;
      const level = levels.find(l => 
        (l.cauldronId || l.cauldron_id || l.tankId) === cauldronId
      );
      
      console.log(`Cauldron ${cauldronId}:`, { cauldron, level, volume: level?.volume });
      
      const maxVolume = cauldron.maxVolume || cauldron.max_volume || 1000;
      const currentVolume = level?.volume || level?.level || 0;
      const fillPercentage = (currentVolume / maxVolume * 100);
      
      return {
        ...cauldron,
        id: cauldronId,
        name: cauldron.name || cauldron.cauldronName || cauldronId,
        latitude: cauldron.latitude || cauldron.lat || 0,
        longitude: cauldron.longitude || cauldron.lon || cauldron.long || 0,
        maxVolume: maxVolume,
        fillRate: cauldron.fillRate || cauldron.fill_rate || 0,
        drainRate: cauldron.drainRate || cauldron.drain_rate || 0,
        currentVolume,
        fillPercentage,
        status: fillPercentage > 90 ? 'Critical' : fillPercentage > 70 ? 'Warning' : 'OK'
      };
    });
  }, [cauldrons, levels]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Critical': return 'text-red-400 bg-red-500/20';
      case 'Warning': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-green-400 bg-green-500/20';
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg shadow-lg border border-white/20 overflow-hidden">
      <div className="p-4 bg-white/5 border-b border-white/20">
        <h2 className="text-xl font-bold text-white">🔮 Cauldrons Status</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5 border-b border-white/20">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Volume</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Fill %</th>
              {detailed && (
                <>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Max Vol</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Fill Rate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Location</th>
                </>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-purple-200 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {cauldronData.map((cauldron) => (
              <tr key={cauldron.id} className="hover:bg-white/5 transition">
                <td className="px-4 py-3 text-sm font-mono text-purple-200">{cauldron.id}</td>
                <td className="px-4 py-3 text-sm font-medium text-white">{cauldron.name}</td>
                <td className="px-4 py-3 text-sm text-purple-200">
                  {cauldron.currentVolume.toFixed(1)} L
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all"
                        style={{ width: `${Math.min(cauldron.fillPercentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-purple-200 w-12">
                      {cauldron.fillPercentage.toFixed(0)}%
                    </span>
                  </div>
                </td>
                {detailed && (
                  <>
                    <td className="px-4 py-3 text-sm text-purple-200">{cauldron.maxVolume} L</td>
                    <td className="px-4 py-3 text-sm text-purple-200">{cauldron.fillRate.toFixed(2)} L/min</td>
                    <td className="px-4 py-3 text-sm text-purple-200">
                      {cauldron.latitude.toFixed(4)}, {cauldron.longitude.toFixed(4)}
                    </td>
                  </>
                )}
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(cauldron.status)}`}>
                    {cauldron.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CauldronTable;
