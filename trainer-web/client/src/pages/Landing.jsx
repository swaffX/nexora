import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Target, Zap, Trophy, Settings } from 'lucide-react';
import { useEffect } from 'react';

export default function Landing() {
  const { user, login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nexora-primary/20 via-nexora-secondary to-black"></div>
        
        <div className="relative z-10 text-center px-4">
          <h1 className="text-7xl font-bold mb-6 bg-gradient-to-r from-nexora-primary via-nexora-accent to-nexora-primary bg-clip-text text-transparent animate-pulse">
            NEXORA TRAINER
          </h1>
          <p className="text-2xl text-gray-300 mb-8">
            Web Tabanlı 3D Aim Trainer - Valorant Uyumlu
          </p>
          <button
            onClick={login}
            className="bg-nexora-primary hover:bg-nexora-primary/80 px-12 py-4 rounded-lg text-xl font-bold transition transform hover:scale-105 shadow-lg shadow-nexora-primary/50"
          >
            Hemen Başla
          </button>
        </div>

        {/* Animated Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-nexora-primary rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-nexora-accent rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-black/50">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Özellikler</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Target size={48} />}
              title="6 Farklı Harita"
              description="Gridshot, Tracking, Flicking ve daha fazlası"
            />
            <FeatureCard
              icon={<Zap size={48} />}
              title="Valorant Uyumlu"
              description="Sensitivity ve crosshair ayarlarınızı birebir taşıyın"
            />
            <FeatureCard
              icon={<Trophy size={48} />}
              title="Leaderboard"
              description="Her harita için Top 10 sıralaması"
            />
            <FeatureCard
              icon={<Settings size={48} />}
              title="Özelleştirilebilir"
              description="Crosshair, sensitivity, grafik ayarları"
            />
          </div>
        </div>
      </section>

      {/* Maps Preview */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Antrenman Haritaları</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MapCard name="Gridshot" description="Hızlı hedef değiştirme" />
            <MapCard name="Tracking" description="Hareketli hedef takibi" />
            <MapCard name="Flicking" description="Ani hedef geçişleri" />
            <MapCard name="Microshot" description="Hassas nişan alma" />
            <MapCard name="Sixshot" description="6 hedef eliminasyonu" />
            <MapCard name="Spidershot" description="360° hedef takibi" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-nexora-primary/20 to-nexora-accent/20">
        <div className="container mx-auto text-center">
          <h2 className="text-5xl font-bold mb-6">Hazır mısın?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Discord ile giriş yap ve antrenmanına başla!
          </p>
          <button
            onClick={login}
            className="bg-[#5865F2] hover:bg-[#4752C4] px-12 py-4 rounded-lg text-xl font-bold transition transform hover:scale-105"
          >
            Discord ile Giriş Yap
          </button>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-black/50 border border-nexora-primary/20 rounded-lg p-6 hover:border-nexora-accent transition">
      <div className="text-nexora-accent mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function MapCard({ name, description }) {
  return (
    <div className="bg-gradient-to-br from-nexora-secondary to-black border border-nexora-primary/30 rounded-lg p-6 hover:border-nexora-accent transition transform hover:scale-105">
      <h3 className="text-2xl font-bold mb-2">{name}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
