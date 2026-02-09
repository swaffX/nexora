export default function Crosshair({ settings }) {
  const { style, color, outlineColor, size, thickness, gap, outline, outlineThickness, centerDot, centerDotSize } = settings;

  const renderCross = () => (
    <svg width="100" height="100" viewBox="0 0 100 100" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      {/* Outline */}
      {outline && (
        <>
          <line x1="50" y1={50 - gap - size} x2="50" y2={50 - gap} stroke={outlineColor} strokeWidth={thickness + outlineThickness * 2} strokeLinecap="square" />
          <line x1="50" y1={50 + gap} x2="50" y2={50 + gap + size} stroke={outlineColor} strokeWidth={thickness + outlineThickness * 2} strokeLinecap="square" />
          <line x1={50 - gap - size} y1="50" x2={50 - gap} y2="50" stroke={outlineColor} strokeWidth={thickness + outlineThickness * 2} strokeLinecap="square" />
          <line x1={50 + gap} y1="50" x2={50 + gap + size} y2="50" stroke={outlineColor} strokeWidth={thickness + outlineThickness * 2} strokeLinecap="square" />
        </>
      )}
      
      {/* Main Cross */}
      <line x1="50" y1={50 - gap - size} x2="50" y2={50 - gap} stroke={color} strokeWidth={thickness} strokeLinecap="square" />
      <line x1="50" y1={50 + gap} x2="50" y2={50 + gap + size} stroke={color} strokeWidth={thickness} strokeLinecap="square" />
      <line x1={50 - gap - size} y1="50" x2={50 - gap} y2="50" stroke={color} strokeWidth={thickness} strokeLinecap="square" />
      <line x1={50 + gap} y1="50" x2={50 + gap + size} y2="50" stroke={color} strokeWidth={thickness} strokeLinecap="square" />
      
      {/* Center Dot */}
      {centerDot && (
        <>
          {outline && <circle cx="50" cy="50" r={centerDotSize + outlineThickness} fill={outlineColor} />}
          <circle cx="50" cy="50" r={centerDotSize} fill={color} />
        </>
      )}
    </svg>
  );

  const renderDot = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
      {outline && <circle cx="10" cy="10" r={size + outlineThickness} fill={outlineColor} />}
      <circle cx="10" cy="10" r={size} fill={color} />
    </svg>
  );

  return (
    <div className="crosshair-container pointer-events-none">
      {style === 'cross' && renderCross()}
      {style === 'dot' && renderDot()}
    </div>
  );
}
