import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TargetManager } from '../utils/TargetManager';
import { HitDetector } from '../utils/HitDetector';

export default function SpidershotScene({ gameState, onHit, sensitivity }) {
  const sceneRef = useRef();
  const targetManagerRef = useRef();
  const hitDetectorRef = useRef();
  const cameraRef = useRef();
  const nextSpawnTimeRef = useRef(0);
  const audioContextRef = useRef(null);
  
  // Initialize scene
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Get camera from parent
    cameraRef.current = sceneRef.current.parent?.camera;
    if (!cameraRef.current) return;
    
    // Create managers
    targetManagerRef.current = new TargetManager(sceneRef.current, 50);
    hitDetectorRef.current = new HitDetector(cameraRef.current);
    
    // Initialize Web Audio API for spatial audio
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
    
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
      if (audioContextRef.current) {
        audioContextRef.current.close();
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
      if (activeTargets.length < 2) { // Keep 2 targets active
        spawnSpidershotTarget();
        nextSpawnTimeRef.current = time + 0.5 + Math.random() * 0.5; // 0.5-1s
      }
    }
  });
  
  const spawnSpidershotTarget = () => {
    if (!targetManagerRef.current) return;
    
    // Full 360° horizontal, ±45° vertical
    const horizontalAngle = Math.random() * Math.PI * 2;
    const verticalAngle = (Math.random() - 0.5) * Math.PI / 2;
    const distance = 8 + Math.random() * 4; // 8-12 units
    
    const position = new THREE.Vector3(
      Math.cos(horizontalAngle) * Math.cos(verticalAngle) * distance,
      Math.sin(verticalAngle) * distance,
      -Math.sin(horizontalAngle) * Math.cos(verticalAngle) * distance
    );
    
    // Check if target is behind player (z > 0)
    const isBehind = position.z > 0;
    
    // Check if target is outside FOV (±60°)
    const angleFromCenter = Math.atan2(position.x, -position.z);
    const isOutsideFOV = Math.abs(angleFromCenter) > Math.PI / 3;
    
    // Play spatial audio cue if target is behind or outside FOV
    if ((isBehind || isOutsideFOV) && audioContextRef.current) {
      playSpawnSound(position);
    }
    
    targetManagerRef.current.spawnTarget(position, 1.0, { 
      type: 'spidershot',
      isOutsideFOV 
    });
  };
  
  const playSpawnSound = (position) => {
    if (!audioContextRef.current) return;
    
    try {
      // Create oscillator for spawn sound
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      const panner = audioContextRef.current.createPanner();
      
      // Configure panner for 3D audio
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.maxDistance = 20;
      panner.rolloffFactor = 1;
      panner.coneInnerAngle = 360;
      panner.coneOuterAngle = 0;
      panner.coneOuterGain = 0;
      
      // Set position
      panner.setPosition(position.x, position.y, position.z);
      
      // Configure sound
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContextRef.current.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.2);
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(audioContextRef.current.destination);
      
      // Play sound
      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + 0.2);
    } catch (e) {
      console.warn('Failed to play spawn sound:', e);
    }
  };
  
  const handleTargetHit = (target) => {
    if (!targetManagerRef.current) return;
    
    // Bonus for targets outside initial FOV
    const isOutsideFOV = target.userData.isOutsideFOV || false;
    const points = isOutsideFOV ? 150 : 100;
    
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
