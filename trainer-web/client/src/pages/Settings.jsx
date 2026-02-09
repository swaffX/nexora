import { useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { Save, Palette, Crosshair as CrosshairIcon, Monitor, Volume2 } from 'lucide-react';
import Crosshair from '../components/Crosshair';

export default function Settings() {
  const { sensitivity, dpi, crosshair, graphics, audio, updateSensitivity, updateCrosshair, updateGraphics, updateAudio } = useSettingsStore();
  const [activeTab, setActiveTab] = useState('crosshair');

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Ayarlar</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-nexora-primary/20">
        <Tab icon={<CrosshairIcon />} label="Crosshair" active={activeTab === 'crosshair'} onClick={() => setActiveTab('crosshair')} />
        <Tab icon={<Monitor />} label="Grafik" active={activeTab === 'graphics'} onClick={() => setActiveTab('graphics')} />
        <Tab icon={<Volume2 />} label="Ses" active={activeTab === 'audio'} onClick={() => setActiveTab('audio')} />
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Settings Panel */}
        <div className="space-y-6">
          {activeTab === 'crosshair' && (
            <>
              <SettingGroup title="Sensitivity">
                <Slider label="Sensitivity" value={sensitivity} onChange={updateSensitivity} min={0.001} max={2} step={0.001} />
                <Input label="DPI" value={dpi} onChange={(v) => updateCrosshair({ dpi: v })} type="number" />
              </SettingGroup>

              <SettingGroup title="Crosshair Stili">
                <Select
                  label="Stil"
                  value={crosshair.style}
                  onChange={(v) => updateCrosshair({ style: v })}
                  options={[
                    { value: 'cross', label: 'Haç' },
                    { value: 'dot', label: 'Nokta' }
                  ]}
                />
                <ColorPicker label="Renk" value={crosshair.color} onChange={(v) => updateCrosshair({ color: v })} />
                <ColorPicker label="Outline Rengi" value={crosshair.outlineColor} onChange={(v) => updateCrosshair({ outlineColor: v })} />
              </SettingGroup>

              <SettingGroup title="Crosshair Boyutları">
                <Slider label="Boyut" value={crosshair.size} onChange={(v) => updateCrosshair({ size: v })} min={1} max={20} step={1} />
                <Slider label="Kalınlık" value={crosshair.thickness} onChange={(v) => updateCrosshair({ thickness: v })} min={1} max={10} step={1} />
                <Slider label="Boşluk" value={crosshair.gap} onChange={(v) => updateCrosshair({ gap: v })} min={-5} max={20} step={1} />
              </SettingGroup>

              <SettingGroup title="Outline">
                <Checkbox label="Outline Aktif" checked={crosshair.outline} onChange={(v) => updateCrosshair({ outline: v })} />
                <Slider label="Outline Kalınlığı" value={crosshair.outlineThickness} onChange={(v) => updateCrosshair({ outlineThickness: v })} min={0} max={5} step={1} />
              </SettingGroup>

              <SettingGroup title="Merkez Nokta">
                <Checkbox label="Merkez Nokta" checked={crosshair.centerDot} onChange={(v) => updateCrosshair({ centerDot: v })} />
                <Slider label="Nokta Boyutu" value={crosshair.centerDotSize} onChange={(v) => updateCrosshair({ centerDotSize: v })} min={1} max={10} step={1} />
              </SettingGroup>
            </>
          )}

          {activeTab === 'graphics' && (
            <>
              <SettingGroup title="Görüntü">
                <Slider label="FOV" value={graphics.fov} onChange={(v) => updateGraphics({ fov: v })} min={60} max={120} step={1} />
              </SettingGroup>

              <SettingGroup title="HUD">
                <Checkbox label="FPS Göster" checked={graphics.showFPS} onChange={(v) => updateGraphics({ showFPS: v })} />
                <Checkbox label="Doğruluk Göster" checked={graphics.showAccuracy} onChange={(v) => updateGraphics({ showAccuracy: v })} />
                <Checkbox label="Zamanlayıcı Göster" checked={graphics.showTimer} onChange={(v) => updateGraphics({ showTimer: v })} />
              </SettingGroup>
            </>
          )}

          {activeTab === 'audio' && (
            <>
              <SettingGroup title="Ses Ayarları">
                <Slider label="Ana Ses" value={audio.masterVolume} onChange={(v) => updateAudio({ masterVolume: v })} min={0} max={1} step={0.01} />
                <Checkbox label="İsabet Sesi" checked={audio.hitSound} onChange={(v) => updateAudio({ hitSound: v })} />
                <Checkbox label="Kaçırma Sesi" checked={audio.missSound} onChange={(v) => updateAudio({ missSound: v })} />
                <Slider label="İsabet Ses Seviyesi" value={audio.hitSoundVolume} onChange={(v) => updateAudio({ hitSoundVolume: v })} min={0} max={1} step={0.01} />
              </SettingGroup>
            </>
          )}
        </div>

        {/* Preview Panel */}
        <div className="bg-black/50 border border-nexora-primary/20 rounded-lg p-8 flex items-center justify-center h-96 relative">
          {activeTab === 'crosshair' && (
            <>
              <div className="text-gray-500 text-sm absolute top-4">Crosshair Önizleme</div>
              <Crosshair settings={crosshair} />
            </>
          )}
          {activeTab === 'graphics' && (
            <div className="text-center text-gray-400">
              <Monitor size={64} className="mx-auto mb-4 opacity-50" />
              <p>Grafik ayarları oyun içinde uygulanır</p>
            </div>
          )}
          {activeTab === 'audio' && (
            <div className="text-center text-gray-400">
              <Volume2 size={64} className="mx-auto mb-4 opacity-50" />
              <p>Ses ayarları oyun içinde uygulanır</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tab({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 border-b-2 transition ${
        active ? 'border-nexora-primary text-nexora-primary' : 'border-transparent text-gray-400 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-semibold">{label}</span>
    </button>
  );
}

function SettingGroup({ title, children }) {
  return (
    <div className="bg-black/30 border border-nexora-primary/10 rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-sm text-gray-400">{label}</label>
        <span className="text-sm font-mono text-nexora-accent">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/50 border border-nexora-primary/20 rounded px-4 py-2 focus:border-nexora-accent outline-none"
      />
    </div>
  );
}

function ColorPicker({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-10 rounded cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-black/50 border border-nexora-primary/20 rounded px-4 py-2 focus:border-nexora-accent outline-none font-mono"
        />
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/50 border border-nexora-primary/20 rounded px-4 py-2 focus:border-nexora-accent outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded accent-nexora-primary"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
