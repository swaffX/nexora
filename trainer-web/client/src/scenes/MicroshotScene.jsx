import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TargetManager } from '../utils/TargetManager';
import { HitDetector } from '../utils/HitDetector';

export default function MicroshotScene({ gameState, onHit, sensitivity }) {
  const sceneRef = useRef();
  const targetManagerRef = useRef();
  const hitDetectorRef = useRef();
  const cameraRef = useRef();
  const nextSpawnTimeRef = useRef(0);
  
  // Initialize scene
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Get camera from parent
    cameraRef.current = sceneRef.current.parent?.camera;
    if (!cameraRef.current) return;
    
    // Create managers
    targetManagerRef.current = new TargetManager(sceneRef.current, 50);
    hitDetectorRef.current = new HitDetector(cameraRef.current);
    
    // Setup click handler
    const handleClick = () => {
      if (gameState !== 'playing') return;
      
      const hitInfo = hitDetectorRef.current.checkHit(
        targetManagerRef.current.getActiveTargets()
      );
      
      if (hitInfo) {
        handleTargetHit(hitInfo);
      }
    };
    
    window.addEventListener('click', handleClick);
    
    return () => {
      window.removeEventListener('click', handleClick);
      if (targetManagerRef.current) {
        targetManagerRef.current.dispose();
      }
      if (hitDetectorRef.current) {
        hitDetectorRef.current.dispose();
      }
    };
  }, [gameState]);
  
  // Game loop
  useFrame((state) => {
    if (gameState !== 'playing' || !targetManagerRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Spawn new target if needed
    if (time >= nextSpawnTimeRef.current) {
      const activeTargets = targetManagerRef.current.getActiveTargets();
      if (activeTargets.length === 0) {
        spawnMicroshotTarget();
        nextSpawnTimeRef.current = time + 0.3 + Math.random() * 0.4; // 0.3-0.7s
      }
    }
  });
  
  const spawnMicroshotTarget = () => {
    if (!targetManagerRef.current) return;
    
    // Random angle (360°)
    const angle = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * Math.PI / 4; // ±45°
    
    // Random distance 5-15 units
    const distance = 5 + Math.random() * 10;
    
    const position = new THREE.Vector3(
      Math.cos(angle) * Math.cos(elevation) * distance,
      Math.sin(elevation) * distance,
      -Math.sin(angle) * Math.cos(elevation) * distance
    );
    
    // Small size (50% of normal)
    const size = 0.5;
    
    targetManagerRef.current.spawnTarget(position, size, { 
      type: 'microshot',
      distance 
    });
  };
  
  const handleTargetHit = (hitInfo) => {
    if (!targetManagerRef.current || !hitDetectorRef.current) return;
    
    const target = hitInfo.target;
    
    // Check if center hit (within 25% of radius)
    const isCenterHit = hitDetectorRef.current.isCenterHit(hitInfo, target);
    
    // Precision bonus for center hits
    const precisionBonus = isCenterHit ? 1.5 : 1.0;
    
    // Calculate points
    const points = Math.floor(100 * precisionBonus);
    
    // Flash hit effect
    targetManagerRef.current.flashHit(target);
    
    // Award points
    if (onHit) {
      onHit(points);
    }
    
    // Despawn target
    setTimeout(() => {
      targetManagerRef.current.despawnTarget(target);
    }, 100);
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
