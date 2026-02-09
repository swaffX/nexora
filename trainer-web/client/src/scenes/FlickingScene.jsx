import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

function FlickTarget({ position, onHit, gameState, onDestroy }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Auto-destroy after 2 seconds
    const timer = setTimeout(() => {
      onDestroy();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onDestroy]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (gameState === 'playing') {
      onHit(200); // Flicking en zor, en fazla puan
      onDestroy();
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
      <sphereGeometry args={[0.2, 32, 32]} />
      <meshStandardMaterial color={hovered ? '#ff4655' : '#ffaa00'} emissive={hovered ? '#ff4655' : '#ffaa00'} emissiveIntensity={0.7} />
    </mesh>
  );
}

export default function FlickingScene({ gameState, onHit }) {
  const [targets, setTargets] = useState([]);

  useEffect(() => {
    if (gameState === 'playing') {
      spawnTarget();
    }
  }, [gameState]);

  const spawnTarget = () => {
    const newTarget = {
      id: Math.random(),
      position: [
        (Math.random() - 0.5) * 10,
        Math.random() * 3 + 0.5,
        (Math.random() - 0.5) * 10 - 5
      ]
    };
    setTargets([newTarget]);
  };

  const handleDestroy = (id) => {
    setTargets([]);
    setTimeout(spawnTarget, 300);
  };

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[0, 5, 0]} intensity={0.5} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1f2e" />
      </mesh>

      <gridHelper args={[20, 20, '#ff4655', '#333']} position={[0, 0.01, 0]} />

      {targets.map((target) => (
        <FlickTarget
          key={target.id}
          position={target.position}
          onHit={onHit}
          gameState={gameState}
          onDestroy={() => handleDestroy(target.id)}
        />
      ))}
    </>
  );
}
