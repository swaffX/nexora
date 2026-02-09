import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Target, Zap, Trophy, Award, TrendingUp, Users, Crosshair, Gamepad2, ArrowRight, Star } from 'lucide-react';
import { useEffect } from 'react';

export default function Landing() {
  const { user, login } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const features = [
    {
      icon: <Crosshair className="w-12 h-12" />,
      title: "6 Farklı Mod",
      description: "Gridshot, Tracking, Flicking, Microshot, Sixshot ve Spidershot"
    },
    {
      icon: <Target className="w-12 h-12" />,
      title: "Valorant Uyumlu",
      description: "Gerçek Valorant hassasiyeti ile 1:1 uyumlu aim training"
    },
    {
      icon: <Trophy className="w-12 h-12" />,
      title: "Liderlik Tablosu",
      description: "Dünya çapında oyuncularla yarış, en iyiler arasına gir"
    },
    {
      icon: <TrendingUp className="w-12 h-12" />,
      title: "İlerleme Takibi",
      description: "Detaylı istatistikler ve performans analizi"
    }
  ];

  const trainingModes = [
    {
      name: "Gridshot",
      description: "Hızlı hedef geçişleri ve refleks geliştirme",
      color: "from-pink-500 to-rose-500",
      icon: <Target className="w-8 h-8" />
    },
    {
      name: "Tracking",
      description: "Hareketli hedefleri takip etme yeteneği",
      color: "from-purple-500 to-indigo-500",
      icon: <Crosshair className="w-8 h-8" />
    },
    {
      name: "Flicking",
      description: "Uzak mesafe hızlı hedef değiştirme",
      color: "from-blue-500 to-cyan-500",
      icon: <Zap className="w-8 h-8" />
    },
    {
      name: "Microshot",
      description: "Küçük hedeflerde hassas nişan alma",
      color: "from-green-500 to-emerald-500",
      icon: <Award className="w-8 h-8" />
    },
    {
      name: "Sixshot",
      description: "6 hedef arası hızlı geçiş",
      color: "from-yellow-500 to-orange-500",
      icon: <Star className="w-8 h-8" />
    },
    {
      name: "Spidershot",
      description: "360 derece çoklu hedef kontrolü",
      color: "from-red-500 to-pink-500",
      icon: <Users className="w-8 h-8" />
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:64px_64px]"></div>
        
        {/* Gradient Orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>

        <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-8 animate-fade-in">
            <Gamepad2 className="w-4 h-4 text-pink-500" />
            <span className="text-sm text-gray-300">Web Tabanlı 3D Aim Trainer</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-6xl md:text-8xl font-black mb-6 leading-tight animate-slide-in">
            <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-yellow-500 bg-clip-text text-transparent">
              NEXORA
            </span>
            <br />
            <span className="text-white">TRAINER</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Valorant hassasiyeti ile profesyonel aim training. 
            <span className="text-white font-semibold"> Tamamen ücretsiz</span>, tarayıcıdan oyna.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <button
              onClick={login}
              className="group relative px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl font-bold text-lg text-white shadow-lg shadow-pink-500/50 hover:shadow-pink-500/70 transition-all duration-300 hover:scale-105"
            >
              <span className="relative z-10 flex items-center gap-2">
                Discord ile Giriş Yap
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl font-bold text-lg text-white hover:bg-white/10 transition-all duration-300"
            >
              Özellikleri Keşfet
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 mt-20 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-2">6</div>
              <div className="text-sm text-gray-400">Training Modu</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent mb-2">100%</div>
              <div className="text-sm text-gray-400">Ücretsiz</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent mb-2">3D</div>
              <div className="text-sm text-gray-400">Gerçekçi Grafik</div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/20 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 px-4 relative">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Neden <span className="bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">Nexora?</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Profesyonel oyuncular için tasarlanmış, bilimsel olarak kanıtlanmış training metodları
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:border-pink-500/50 transition-all duration-300 hover:scale-105"
              >
                <div className="text-pink-500 mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500/0 via-pink-500/5 to-purple-500/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Training Modes Section */}
      <section className="py-32 px-4 relative bg-black/30">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Training <span className="bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">Modları</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Her beceri seviyesi için özel olarak tasarlanmış 6 farklı antrenman modu
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trainingModes.map((mode, index) => (
              <div
                key={index}
                className="group relative bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:border-white/30 transition-all duration-300 overflow-hidden"
              >
                {/* Gradient Background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${mode.color} opacity-0 group-hover:opacity-10 transition-opacity`}></div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${mode.color} text-white`}>
                      {mode.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-white">{mode.name}</h3>
                  </div>
                  <p className="text-gray-400 leading-relaxed">{mode.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:64px_64px]"></div>
        
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Hazır mısın?
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 mb-12">
            Discord ile giriş yap ve <span className="text-pink-500 font-bold">ücretsiz</span> antrenmanına başla!
          </p>
          
          <button
            onClick={login}
            className="group relative px-12 py-5 bg-gradient-to-r from-[#5865F2] to-[#7289DA] rounded-xl font-bold text-xl text-white shadow-2xl shadow-[#5865F2]/50 hover:shadow-[#5865F2]/70 transition-all duration-300 hover:scale-105"
          >
            <span className="relative z-10 flex items-center gap-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Discord ile Giriş Yap
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>

          <p className="text-sm text-gray-500 mt-6">
            Giriş yaparak <a href="#" className="text-pink-500 hover:underline">Kullanım Koşulları</a> ve <a href="#" className="text-pink-500 hover:underline">Gizlilik Politikası</a>'nı kabul etmiş olursunuz
          </p>
        </div>
      </section>
    </div>
  );
}
