import { Target, Clock, TrendingUp, X } from 'lucide-react';

export default function GameUI({ gameState, score, accuracy, timeLeft, hits, misses, mapId, onStart, onRestart, onExit }) {
  if (gameState === 'ready') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4 capitalize">{mapId}</h1>
          <p className="text-xl text-gray-300 mb-8">60 saniye içinde en yüksek skoru yap!</p>
          <button
            onClick={onStart}
            className="bg-nexora-primary hover:bg-nexora-primary/80 px-12 py-4 rounded-lg text-xl font-bold transition"
          >
            Başla
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-nexora-secondary border border-nexora-primary/30 rounded-lg p-8 max-w-md w-full">
          <h2 className="text-4xl font-bold mb-6 text-center">Oyun Bitti!</h2>
          
          <div className="space-y-4 mb-8">
            <StatRow label="Skor" value={score} />
            <StatRow label="Doğruluk" value={`${accuracy}%`} />
            <StatRow label="İsabet" value={hits} />
            <StatRow label="Kaçan" value={misses} />
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={onRestart}
              className="flex-1 bg-nexora-primary hover:bg-nexora-primary/80 px-6 py-3 rounded-lg font-bold transition"
            >
              Tekrar Oyna
            </button>
            <button
              onClick={onExit}
              className="flex-1 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-bold transition"
            >
              Çıkış
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing State - HUD
  return (
    <>
      {/* Top HUD */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-8 bg-black/50 backdrop-blur-sm px-6 py-3 rounded-lg border border-nexora-primary/20">
        <HUDItem icon={<Target size={20} />} label="Skor" value={score} />
        <HUDItem icon={<TrendingUp size={20} />} label="Doğruluk" value={`${accuracy}%`} />
        <HUDItem icon={<Clock size={20} />} label="Süre" value={`${timeLeft}s`} />
      </div>

      {/* Exit Button */}
      <button
        onClick={onExit}
        className="absolute top-4 right-4 p-3 bg-red-500/20 hover:bg-red-500/40 rounded-lg transition"
        title="Çıkış (ESC)"
      >
        <X size={24} />
      </button>
    </>
  );
}

function HUDItem({ icon, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-nexora-accent">{icon}</div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-nexora-accent">{value}</span>
    </div>
  );
}
