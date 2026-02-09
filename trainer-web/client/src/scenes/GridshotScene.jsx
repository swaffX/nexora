import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Target({ position, onHit, gameState }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current && hovered) {
      meshRef.current.scale.lerp(new THREE.Vector3(1.1, 1.1, 1.1), 0.1);
    } else if (meshRef.current) {
      meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (gameState === 'playing') {
      onHit(100);
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshStandardMaterial color={hovered ? '#ff4655' : '#00ff88'} emissive={hovered ? '#ff4655' : '#00ff88'} emissiveIntensity={0.5} />
    </mesh>
  );
}

export default function GridshotScene({ gameState, onHit }) {
  const [targets, setTargets] = useState([]);

  useEffect(() => {
    if (gameState === 'playing') {
      generateTargets();
    }
  }, [gameState]);

  const generateTargets = () => {
    const newTargets = [];
    for (let i = 0; i < 5; i++) {
      newTargets.push({
        id: Math.random(),
        position: [
          (Math.random() - 0.5) * 8,
          Math.random() * 3 + 0.5,
          (Math.random() - 0.5) * 8 - 5
        ]
      });
    }
    setTargets(newTargets);
  };

  const handleTargetHit = (id) => {
    onHit(100);
    setTargets((prev) => prev.filter((t) => t.id !== id));
    
    // Spawn new target
    setTimeout(() => {
      setTargets((prev) => [
        ...prev,
        {
          id: Math.random(),
          position: [
            (Math.random() - 0.5) * 8,
            Math.random() * 3 + 0.5,
            (Math.random() - 0.5) * 8 - 5
          ]
        }
      ]);
    }, 100);
  };

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[0, 5, 0]} intensity={0.5} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1f2e" />
      </mesh>

      {/* Grid */}
      <gridHelper args={[20, 20, '#ff4655', '#333']} position={[0, 0.01, 0]} />

      {/* Targets */}
      {targets.map((target) => (
        <Target
          key={target.id}
          position={target.position}
          onHit={() => handleTargetHit(target.id)}
          gameState={gameState}
        />
      ))}
    </>
  );
}
