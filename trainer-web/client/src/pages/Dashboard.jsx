import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Target, TrendingUp, Clock, Award } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MAPS = [
  { id: 'gridshot', name: 'Gridshot', description: 'Hızlı hedef değiştirme', color: 'from-red-500 to-orange-500' },
  { id: 'tracking', name: 'Tracking', description: 'Hareketli hedef takibi', color: 'from-blue-500 to-cyan-500' },
  { id: 'flicking', name: 'Flicking', description: 'Ani hedef geçişleri', color: 'from-purple-500 to-pink-500' },
  { id: 'microshot', name: 'Microshot', description: 'Hassas nişan alma', color: 'from-green-500 to-emerald-500' },
  { id: 'sixshot', name: 'Sixshot', description: '6 hedef eliminasyonu', color: 'from-yellow-500 to-amber-500' },
  { id: 'spidershot', name: 'Spidershot', description: '360° hedef takibi', color: 'from-indigo-500 to-violet-500' }
];

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/scores/user/${user.id}/all`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Hoş Geldin, {user.username}!</h1>
        <p className="text-gray-400">Antrenman haritasını seç ve başla</p>
      </div>

      {/* Stats Overview */}
      {!loading && stats && Object.keys(stats).length > 0 && (
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Target />} label="Toplam Oyun" value={Object.values(stats).filter(s => s && s.bestScore > 0).length} />
          <StatCard icon={<TrendingUp />} label="En Yüksek Skor" value={Math.max(0, ...Object.values(stats).filter(s => s).map(s => s.bestScore || 0))} />
          <StatCard icon={<Award />} label="Ortalama Doğruluk" value={`${Math.round(Object.values(stats).filter(s => s).reduce((acc, s) => acc + (s.accuracy || 0), 0) / 6)}%`} />
          <StatCard icon={<Clock />} label="Toplam Süre" value="--" />
        </div>
      )}

      {/* Maps Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MAPS.map((map) => (
          <MapCard
            key={map.id}
            map={map}
            stats={stats?.[map.id]}
            onClick={() => navigate(`/training/${map.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-black/50 border border-nexora-primary/20 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="text-nexora-accent">{icon}</div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function MapCard({ map, stats, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-black/50 border border-nexora-primary/20 rounded-lg p-6 hover:border-nexora-accent transition cursor-pointer transform hover:scale-105"
    >
      <div className={`bg-gradient-to-r ${map.color} h-32 rounded-lg mb-4 flex items-center justify-center`}>
        <Target size={64} className="text-white" />
      </div>
      
      <h3 className="text-2xl font-bold mb-2">{map.name}</h3>
      <p className="text-gray-400 mb-4">{map.description}</p>
      
      {stats && stats.bestScore && stats.bestScore > 0 ? (
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">En İyi: <span className="text-nexora-accent font-bold">{stats.bestScore}</span></span>
          <span className="text-gray-400">Sıralama: <span className="text-nexora-accent font-bold">#{stats.rank || '--'}</span></span>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Henüz oynamadın</p>
      )}
    </div>
  );
}
