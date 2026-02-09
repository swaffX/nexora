import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Suspense, useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import Crosshair from '../components/Crosshair';
import GameUI from '../components/GameUI';
import GridshotScene from '../scenes/GridshotScene';
import TrackingScene from '../scenes/TrackingScene';
import FlickingScene from '../scenes/FlickingScene';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SCENES = {
  gridshot: GridshotScene,
  tracking: TrackingScene,
  flicking: FlickingScene,
  microshot: GridshotScene, // Placeholder
  sixshot: GridshotScene, // Placeholder
  spidershot: TrackingScene // Placeholder
};

export default function Training() {
  const { mapId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { sensitivity, crosshair, graphics } = useSettingsStore();
  
  const [gameState, setGameState] = useState('ready'); // ready, playing, finished
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [accuracy, setAccuracy] = useState(100);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const SceneComponent = SCENES[mapId] || GridshotScene;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setHits(0);
    setMisses(0);
    setTimeLeft(60);
    startTimeRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const endGame = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('finished');
    
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const finalAccuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
    
    // Submit score
    try {
      const response = await axios.post(`${API_URL}/api/scores/submit`, {
        mapId,
        score,
        accuracy: finalAccuracy,
        hits,
        misses,
        duration,
        settings: { sensitivity, crosshair }
      });
      
      console.log('Score submitted:', response.data);
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  };

  const handleHit = (points = 100) => {
    setScore((prev) => prev + points);
    setHits((prev) => prev + 1);
    updateAccuracy(hits + 1, misses);
  };

  const handleMiss = () => {
    setMisses((prev) => prev + 1);
    updateAccuracy(hits, misses + 1);
  };

  const updateAccuracy = (h, m) => {
    if (h + m > 0) {
      setAccuracy(Math.round((h / (h + m)) * 100));
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        shadows
        className="w-full h-full"
        onPointerMissed={gameState === 'playing' ? handleMiss : undefined}
      >
        <PerspectiveCamera makeDefault position={[0, 1.6, 0]} fov={graphics.fov} />
        <Suspense fallback={null}>
          <SceneComponent
            gameState={gameState}
            onHit={handleHit}
            sensitivity={sensitivity}
          />
        </Suspense>
        <OrbitControls enabled={false} />
      </Canvas>

      {/* Crosshair */}
      {gameState === 'playing' && <Crosshair settings={crosshair} />}

      {/* Game UI */}
      <GameUI
        gameState={gameState}
        score={score}
        accuracy={accuracy}
        timeLeft={timeLeft}
        hits={hits}
        misses={misses}
        mapId={mapId}
        onStart={startGame}
        onRestart={() => {
          setGameState('ready');
          setScore(0);
          setHits(0);
          setMisses(0);
          setTimeLeft(60);
        }}
        onExit={() => navigate('/dashboard')}
      />
    </div>
  );
}
