import { Monitor, Smartphone } from 'lucide-react';

export default function MobileWarning() {
  return (
    <div className="fixed inset-0 bg-nexora-secondary flex items-center justify-center p-4 z-50">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center gap-4">
          <Smartphone size={64} className="text-red-400" />
          <div className="text-4xl">→</div>
          <Monitor size={64} className="text-nexora-accent" />
        </div>
        
        <h1 className="text-3xl font-bold mb-4">Masaüstü Gerekli</h1>
        
        <p className="text-gray-300 mb-6 leading-relaxed">
          Nexora Trainer, fare ve klavye ile oynamak için tasarlanmış profesyonel bir 3D nişan antrenörüdür.
        </p>
        
        <div className="bg-black/30 border border-nexora-primary/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-400 mb-2">Gereksinimler:</p>
          <ul className="text-left text-sm space-y-1">
            <li>✓ Masaüstü veya Laptop bilgisayar</li>
            <li>✓ Fare (oyun faresi önerilir)</li>
            <li>✓ Modern web tarayıcısı (Chrome, Firefox, Edge)</li>
            <li>✓ WebGL 2.0 desteği</li>
          </ul>
        </div>
        
        <p className="text-nexora-accent font-bold">
          Lütfen bir masaüstü bilgisayardan giriş yapın
        </p>
      </div>
    </div>
  );
}
