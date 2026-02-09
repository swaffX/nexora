import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function MovingTarget({ onHit, gameState }) {
  const meshRef = useRef();
  const [position, setPosition] = useState([0, 1.5, -5]);
  const [velocity] = useState([
    (Math.random() - 0.5) * 0.05,
    (Math.random() - 0.5) * 0.02,
    0
  ]);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (gameState === 'playing' && meshRef.current) {
      const newPos = [
        position[0] + velocity[0],
        position[1] + velocity[1],
        position[2]
      ];

      // Bounce off walls
      if (Math.abs(newPos[0]) > 4) velocity[0] *= -1;
      if (newPos[1] > 3 || newPos[1] < 0.5) velocity[1] *= -1;

      setPosition(newPos);
      meshRef.current.position.set(...newPos);
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (gameState === 'playing') {
      onHit(150); // Tracking daha zor, daha fazla puan
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
      <sphereGeometry args={[0.25, 32, 32]} />
      <meshStandardMaterial color={hovered ? '#ff4655' : '#00ff88'} emissive={hovered ? '#ff4655' : '#00ff88'} emissiveIntensity={0.5} />
    </mesh>
  );
}

export default function TrackingScene({ gameState, onHit }) {
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

      {gameState === 'playing' && (
        <>
          <MovingTarget onHit={onHit} gameState={gameState} />
          <MovingTarget onHit={onHit} gameState={gameState} />
          <MovingTarget onHit={onHit} gameState={gameState} />
        </>
      )}
    </>
  );
}
