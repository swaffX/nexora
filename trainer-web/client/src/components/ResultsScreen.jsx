import { useNavigate } from 'react-router-dom';
import { Target, TrendingUp, Clock, Zap, Award } from 'lucide-react';

export default function ResultsScreen({ 
  mapId, 
  score, 
  accuracy, 
  hits, 
  misses, 
  avgReactionTime,
  duration,
  personalBest,
  leaderboardRank
}) {
  const navigate = useNavigate();
  
  const isNewBest = personalBest ? score > personalBest : true;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50">
      <div className="bg-nexora-secondary border-2 border-nexora-primary/30 rounded-2xl p-8 max-w-2xl w-full mx-4 animate-slide-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 capitalize">{mapId}</h1>
          <p className="text-2xl text-nexora-accent">Oyun Bitti!</p>
          {isNewBest && (
            <div className="mt-4 inline-block bg-nexora-accent/20 border border-nexora-accent px-6 py-2 rounded-full">
              <p className="text-nexora-accent font-bold flex items-center gap-2">
                <Award size={20} />
                YENİ REKOR!
              </p>
            </div>
          )}
        </div>

        {/* Main Score */}
        <div className="text-center mb-8 p-6 bg-black/30 rounded-xl border border-nexora-primary/20">
          <p className="text-gray-400 text-sm mb-2">TOPLAM SKOR</p>
          <p className="text-6xl font-bold text-nexora-accent">{score}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard
            icon={<TrendingUp size={24} />}
            label="Doğruluk"
            value={`${accuracy}%`}
            color="text-green-400"
          />
          <StatCard
            icon={<Target size={24} />}
            label="İsabet / Kaçan"
            value={`${hits} / ${misses}`}
            color="text-blue-400"
          />
          <StatCard
            icon={<Zap size={24} />}
            label="Ort. Tepki"
            value={avgReactionTime ? `${avgReactionTime}ms` : '--'}
            color="text-yellow-400"
          />
          <StatCard
            icon={<Clock size={24} />}
            label="Süre"
            value={`${duration}s`}
            color="text-purple-400"
          />
        </div>

        {/* Comparison */}
        {personalBest && (
          <div className="mb-8 p-4 bg-black/20 rounded-lg border border-nexora-primary/10">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-400">Önceki En İyi</p>
                <p className="text-2xl font-bold">{personalBest}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Fark</p>
                <p className={`text-2xl font-bold ${score > personalBest ? 'text-green-400' : 'text-red-400'}`}>
                  {score > personalBest ? '+' : ''}{score - personalBest}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Position */}
        {leaderboardRank && leaderboardRank <= 10 && (
          <div className="mb-8 p-4 bg-nexora-accent/10 rounded-lg border border-nexora-accent">
            <p className="text-center text-nexora-accent font-bold">
              🏆 Liderlik Tablosunda #{leaderboardRank}!
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-nexora-primary hover:bg-nexora-primary/80 px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105"
          >
            Tekrar Oyna
          </button>
          <button
            onClick={() => navigate('/leaderboard')}
            className="flex-1 bg-nexora-secondary hover:bg-nexora-secondary/80 border-2 border-nexora-accent px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105"
          >
            Liderlik Tablosu
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 bg-gray-700 hover:bg-gray-600 px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105"
          >
            Ana Menü
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-black/30 border border-nexora-primary/20 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={color}>{icon}</div>
        <p className="text-sm text-gray-400">{label}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
