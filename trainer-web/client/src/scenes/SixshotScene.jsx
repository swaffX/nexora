import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TargetManager } from '../utils/TargetManager';
import { HitDetector } from '../utils/HitDetector';

export default function SixshotScene({ gameState, onHit, sensitivity }) {
  const sceneRef = useRef();
  const targetManagerRef = useRef();
  const hitDetectorRef = useRef();
  const cameraRef = useRef();
  const setStartTimeRef = useRef(0);
  const setsCompletedRef = useRef(0);
  
  // Initialize scene
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Get camera from parent
    cameraRef.current = sceneRef.current.parent?.camera;
    if (!cameraRef.current) return;
    
    // Create managers
    targetManagerRef.current = new TargetManager(sceneRef.current, 50);
    hitDetectorRef.current = new HitDetector(cameraRef.current);
    
    // Spawn initial set
    spawnSixshotSet();
    
    // Setup click handler
    const handleClick = () => {
      if (gameState !== 'playing') return;
      
      const hitInfo = hitDetectorRef.current.checkHit(
        targetManagerRef.current.getActiveTargets()
      );
      
      if (hitInfo) {
        handleTargetHit(hitInfo.target);
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
  
  const spawnSixshotSet = () => {
    if (!targetManagerRef.current) return;
    
    const radius = 8;
    setStartTimeRef.current = Date.now();
    
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 2, // Slight vertical variation
        -Math.sin(angle) * radius
      );
      
      targetManagerRef.current.spawnTarget(position, 1.0, { 
        type: 'sixshot',
        setIndex: setsCompletedRef.current 
      });
    }
  };
  
  const handleTargetHit = (target) => {
    if (!targetManagerRef.current) return;
    
    // Flash hit effect
    targetManagerRef.current.flashHit(target);
    
    // Despawn target
    setTimeout(() => {
      targetManagerRef.current.despawnTarget(target);
      
      // Check if set is complete
      const activeTargets = targetManagerRef.current.getActiveTargets();
      if (activeTargets.length === 0) {
        handleSetComplete();
      }
    }, 100);
  };
  
  const handleSetComplete = () => {
    // Calculate set completion time
    const setCompletionTime = Date.now() - setStartTimeRef.current;
    
    // Speed bonus: under 3 seconds = 1.5x multiplier
    const speedBonus = setCompletionTime < 3000 ? 1.5 : 1.0;
    
    // Calculate points
    const points = Math.floor(600 * speedBonus);
    
    // Award points
    if (onHit) {
      onHit(points);
    }
    
    // Increment sets completed
    setsCompletedRef.current++;
    
    // Spawn new set
    setTimeout(() => {
      spawnSixshotSet();
    }, 500);
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
