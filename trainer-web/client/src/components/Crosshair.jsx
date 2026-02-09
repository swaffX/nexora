import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';

export default function Crosshair() {
  const canvasRef = useRef(null);
  const { crosshair } = useSettingsStore();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(dpr, dpr);
    
    // Render crosshair
    renderCrosshair(ctx, canvas.width / dpr, canvas.height / dpr, crosshair);
    
    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      renderCrosshair(ctx, canvas.width / dpr, canvas.height / dpr, crosshair);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [crosshair]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="crosshair-canvas"
    />
  );
}

function renderCrosshair(ctx, width, height, settings) {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Calculate center
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Extract settings
  const {
    color = '#00FF00',
    size = 4,
    thickness = 2,
    gap = 2,
    outlineThickness = 1,
    outlineColor = '#000000',
    opacity = 1
  } = settings;
  
  // Convert size and gap to pixels
  const lineLength = size * 2;
  const gapSize = gap * 2;
  
  // Set global alpha
  ctx.globalAlpha = opacity;
  
  // Draw outline first (if enabled)
  if (outlineThickness > 0) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = thickness + (outlineThickness * 2);
    ctx.lineCap = 'butt';
    
    drawCrosshairLines(ctx, centerX, centerY, lineLength, gapSize);
  }
  
  // Draw main crosshair with glow
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.lineCap = 'butt';
  
  drawCrosshairLines(ctx, centerX, centerY, lineLength, gapSize);
  
  // Reset shadow
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawCrosshairLines(ctx, centerX, centerY, lineLength, gapSize) {
  // Top line
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - gapSize);
  ctx.lineTo(centerX, centerY - gapSize - lineLength);
  ctx.stroke();
  
  // Bottom line
  ctx.beginPath();
  ctx.moveTo(centerX, centerY + gapSize);
  ctx.lineTo(centerX, centerY + gapSize + lineLength);
  ctx.stroke();
  
  // Left line
  ctx.beginPath();
  ctx.moveTo(centerX - gapSize, centerY);
  ctx.lineTo(centerX - gapSize - lineLength, centerY);
  ctx.stroke();
  
  // Right line
  ctx.beginPath();
  ctx.moveTo(centerX + gapSize, centerY);
  ctx.lineTo(centerX + gapSize + lineLength, centerY);
  ctx.stroke();
}
