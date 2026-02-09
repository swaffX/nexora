import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TargetManager } from '../utils/TargetManager';
import { HitDetector } from '../utils/HitDetector';

// Movement patterns for tracking
const PATTERNS = {
  circular: (time, radius = 5) => ({
    x: Math.cos(time) * radius,
    y: Math.sin(time) * radius,
    z: -10
  }),
  
  linear: (time, speed = 2) => {
    const t = (time * speed) % 20;
    return {
      x: t - 10, // -10 to 10
      y: 0,
      z: -10
    };
  },
  
  figure8: (time, radius = 5) => ({
    x: Math.sin(time) * radius,
    y: Math.sin(time * 2) * radius / 2,
    z: -10
  })
};

export default function TrackingScene({ gameState, onHit, sensitivity }) {
  const sceneRef = useRef();
  const targetManagerRef = useRef();
  const hitDetectorRef = useRef();
  const cameraRef = useRef();
  const trackingTimeRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const currentPatternRef = useRef('circular');
  const patternStartTimeRef = useRef(0);
  
  // Initialize scene
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Get camera from parent
    cameraRef.current = sceneRef.current.parent?.camera;
    if (!cameraRef.current) return;
    
    // Create managers
    targetManagerRef.current = new TargetManager(sceneRef.current, 10);
    hitDetectorRef.current = new HitDetector(cameraRef.current);
    
    // Spawn initial target
    spawnTrackingTarget();
    
    return () => {
      if (targetManagerRef.current) {
        targetManagerRef.current.dispose();
      }
      if (hitDetectorRef.current) {
        hitDetectorRef.current.dispose();
      }
    };
  }, []);
  
  // Game loop
  useFrame((state) => {
    if (gameState !== 'playing' || !targetManagerRef.current || !hitDetectorRef.current) return;
    
    const time = state.clock.getElapsedTime();
    const deltaTime = time - lastFrameTimeRef.current;
    lastFrameTimeRef.current = time;
    
    // Update target position based on pattern
    updateTargetPosition(time);
    
    // Check if crosshair is on target
    const activeTargets = targetManagerRef.current.getActiveTargets();
    if (activeTargets.length > 0) {
      const target = activeTargets[0];
      const isTracking = hitDetectorRef.current.isTrackingTarget(target);
      
      if (isTracking) {
        trackingTimeRef.current += deltaTime;
        
        // Award points for tracking (10 points per second)
        if (onHit) {
          onHit(Math.floor(deltaTime * 10));
        }
      }
    }
    
    // Change pattern every 10 seconds
    if (time - patternStartTimeRef.current > 10) {
      cyclePattern();
      patternStartTimeRef.current = time;
    }
  });
  
  const spawnTrackingTarget = () => {
    if (!targetManagerRef.current) return;
    
    const position = new THREE.Vector3(0, 0, -10);
    targetManagerRef.current.spawnTarget(position, 1.0, { type: 'tracking' });
    patternStartTimeRef.current = 0;
  };
  
  const updateTargetPosition = (time) => {
    if (!targetManagerRef.current) return;
    
    const activeTargets = targetManagerRef.current.getActiveTargets();
    if (activeTargets.length === 0) return;
    
    const target = activeTargets[0];
    const pattern = PATTERNS[currentPatternRef.current];
    const newPos = pattern(time);
    
    target.position.set(newPos.x, newPos.y, newPos.z);
    target.mesh.position.copy(target.position);
  };
  
  const cyclePattern = () => {
    const patterns = ['circular', 'linear', 'figure8'];
    const currentIndex = patterns.indexOf(currentPatternRef.current);
    const nextIndex = (currentIndex + 1) % patterns.length;
    currentPatternRef.current = patterns[nextIndex];
  };
  
  return (
    <group ref={sceneRef}>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1} 
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[0, 5, 0]} intensity={0.5} color="#ff0080" />
      <pointLight position={[-5, 2, -10]} intensity={0.3} color="#00f0ff" />
      <pointLight position={[5, 2, -10]} intensity={0.3} color="#ffd700" />
      
      {/* Ground */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -5, 0]} 
        receiveShadow
      >
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial 
          color="#0a0a0f" 
          metalness={0.3}
          roughness={0.8}
        />
      </mesh>
      
      {/* Grid */}
      <gridHelper 
        args={[50, 50, '#ff0080', '#1a1a2e']} 
        position={[0, -4.99, 0]} 
      />
      
      {/* Back wall */}
      <mesh position={[0, 0, -15]} receiveShadow>
        <planeGeometry args={[50, 20]} />
        <meshStandardMaterial 
          color="#1a1a2e" 
          metalness={0.2}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}
