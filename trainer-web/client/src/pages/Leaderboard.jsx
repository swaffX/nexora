import { useState, useEffect, useCallback } from 'react';
import { Trophy, Target } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MAPS = [
  { id: 'gridshot', name: 'Gridshot' },
  { id: 'tracking', name: 'Tracking' },
  { id: 'flicking', name: 'Flicking' },
  { id: 'microshot', name: 'Microshot' },
  { id: 'sixshot', name: 'Sixshot' },
  { id: 'spidershot', name: 'Spidershot' }
];

export default function Leaderboard() {
  const [selectedMap, setSelectedMap] = useState('gridshot');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/scores/leaderboard/${selectedMap}`);
      setLeaderboard(response.data.leaderboard);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMap]);

  useEffect(() => {
    loadLeaderboard();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadLeaderboard, 30000);
    
    return () => clearInterval(interval);
  }, [loadLeaderboard]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold mb-4 flex items-center justify-center gap-3">
          <Trophy className="text-nexora-primary" size={48} />
          Leaderboard
        </h1>
        <p className="text-gray-400">En iyi oyuncular</p>
      </div>

      {/* Map Selector */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {MAPS.map((map) => (
          <button
            key={map.id}
            onClick={() => setSelectedMap(map.id)}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              selectedMap === map.id
                ? 'bg-nexora-primary text-white'
                : 'bg-black/50 border border-nexora-primary/20 hover:border-nexora-accent'
            }`}
          >
            {map.name}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="max-w-4xl mx-auto bg-black/50 border border-nexora-primary/20 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Yükleniyor...</div>
        ) : leaderboard.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Target size={48} className="mx-auto mb-4 opacity-50" />
            <p>Henüz kimse bu haritada oynamadı!</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-nexora-primary/10 border-b border-nexora-primary/20">
              <tr>
                <th className="px-6 py-4 text-left">Sıra</th>
                <th className="px-6 py-4 text-left">Oyuncu</th>
                <th className="px-6 py-4 text-right">Skor</th>
                <th className="px-6 py-4 text-right">Doğruluk</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => (
                <tr
                  key={entry.userId}
                  className={`border-b border-nexora-primary/10 hover:bg-nexora-primary/5 transition-all duration-300 ${
                    index < 3 ? 'bg-nexora-accent/5' : ''
                  } ${entry.userId === user?.id ? 'bg-nexora-primary/20 border-l-4 border-l-nexora-accent' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {index === 0 && <Trophy className="text-yellow-400 animate-pulse-glow" size={20} />}
                      {index === 1 && <Trophy className="text-gray-400" size={20} />}
                      {index === 2 && <Trophy className="text-amber-600" size={20} />}
                      <span className="font-bold text-lg">#{index + 1}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://cdn.discordapp.com/avatars/${entry.userId}/${entry.avatar}.png`}
                        alt={entry.username}
                        className="w-10 h-10 rounded-full border-2 border-nexora-primary/30"
                        onError={(e) => {
                          e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                        }}
                      />
                      <span className={`font-semibold ${entry.userId === user?.id ? 'text-nexora-accent' : ''}`}>
                        {entry.username}
                        {entry.userId === user?.id && <span className="ml-2 text-xs">(Sen)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-2xl font-bold text-nexora-accent">{entry.score}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-lg text-gray-300">{entry.accuracy}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
