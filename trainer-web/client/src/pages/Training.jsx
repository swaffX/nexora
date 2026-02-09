import { useParams, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { Suspense, useState, useRef, useEffect, lazy } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { CameraController } from '../utils/CameraController';
import { getAudioManager } from '../utils/AudioManager';
import Crosshair from '../components/Crosshair';
import PauseMenu from '../components/PauseMenu';
import GameUI from '../components/GameUI';
import ResultsScreen from '../components/ResultsScreen';
import axios from 'axios';

// Lazy load training scenes for code splitting
const GridshotScene = lazy(() => import('../scenes/GridshotScene'));
const TrackingScene = lazy(() => import('../scenes/TrackingScene'));
const FlickingScene = lazy(() => import('../scenes/FlickingScene'));
const MicroshotScene = lazy(() => import('../scenes/MicroshotScene'));
const SixshotScene = lazy(() => import('../scenes/SixshotScene'));
const SpidershotScene = lazy(() => import('../scenes/SpidershotScene'));

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SCENES = {
  gridshot: GridshotScene,
  tracking: TrackingScene,
  flicking: FlickingScene,
  microshot: MicroshotScene,
  sixshot: SixshotScene,
  spidershot: SpidershotScene
};

export default function Training() {
  const { mapId } = useParams();
  const navigate = useNavigate();
  const { sensitivity, crosshair, graphics } = useSettingsStore();
  const { user } = useAuthStore();
  
  const [gameState, setGameState] = useState('ready'); // ready, playing, finished
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [accuracy, setAccuracy] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const [reactionTimes, setReactionTimes] = useState([]);
  const [personalBest, setPersonalBest] = useState(null);
  const [leaderboardRank, setLeaderboardRank] = useState(null);
  
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const cameraControllerRef = useRef(null);
  const canvasRef = useRef(null);
  const audioManagerRef = useRef(null);

  const SceneComponent = SCENES[mapId] || GridshotScene;
  
  const loadPersonalBest = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/scores/user/${user?.id}/map/${mapId}`, {
        withCredentials: true
      });
      if (response.data && response.data.bestScore) {
        setPersonalBest(response.data.bestScore);
      }
    } catch (error) {
      console.error('Failed to load personal best:', error);
    }
  };
  
  useEffect(() => {
    // Initialize audio manager
    audioManagerRef.current = getAudioManager();
    
    // Load personal best
    if (user) {
      loadPersonalBest();
    }
    
    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.dispose();
      }
    };
  }, [user, mapId]);

  useEffect(() => {
    // ESC key handler for pause menu
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && gameState === 'playing') {
        if (isPaused) {
          resumeGame();
        } else {
          pauseGame();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearInterval(timerRef.current);
      if (cameraControllerRef.current) {
        cameraControllerRef.current.dispose();
      }
    };
  }, [gameState, isPaused]);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setHits(0);
    setMisses(0);
    setTimeLeft(60);
    setIsPaused(false);
    setReactionTimes([]);
    startTimeRef.current = Date.now();
    
    // Resume audio context
    if (audioManagerRef.current) {
      audioManagerRef.current.resume();
    }
    
    // Lock pointer for FPS controls
    if (canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        // Play countdown beep for last 3 seconds
        if (prev <= 3 && audioManagerRef.current) {
          audioManagerRef.current.playCountdownBeep(prev === 1);
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const pauseGame = () => {
    setIsPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (cameraControllerRef.current) {
      cameraControllerRef.current.unlockPointer();
    }
  };
  
  const resumeGame = () => {
    setIsPaused(false);
    if (canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
    
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
    
    // Unlock pointer
    if (cameraControllerRef.current) {
      cameraControllerRef.current.unlockPointer();
    }
    
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const finalAccuracy = hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0;
    const avgReactionTime = reactionTimes.length > 0 
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
    
    // Submit score
    try {
      const response = await axios.post(`${API_URL}/api/scores/submit`, {
        mapId,
        score,
        accuracy: finalAccuracy,
        hits,
        misses,
        avgReactionTime,
        duration,
        settings: { sensitivity, crosshair }
      }, {
        withCredentials: true
      });
      
      if (response.data && response.data.rank) {
        setLeaderboardRank(response.data.rank);
      }
      
      console.log('Score submitted:', response.data);
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
  };

  const handleHit = (points = 100, reactionTime = 0) => {
    setScore((prev) => prev + points);
    setHits((prev) => prev + 1);
    if (reactionTime > 0) {
      setReactionTimes((prev) => [...prev, reactionTime]);
    }
    updateAccuracy(hits + 1, misses);
    
    // Play hit sound
    if (audioManagerRef.current) {
      audioManagerRef.current.playHitSound();
    }
  };

  const handleMiss = () => {
    setMisses((prev) => prev + 1);
    updateAccuracy(hits, misses + 1);
    
    // Play miss sound
    if (audioManagerRef.current) {
      audioManagerRef.current.playMissSound();
    }
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
        ref={canvasRef}
        shadows
        className="w-full h-full"
        gl={{ 
          antialias: graphics.antialiasing !== false,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          depth: true
        }}
        onPointerMissed={gameState === 'playing' && !isPaused ? handleMiss : undefined}
        onCreated={({ camera, gl }) => {
          // Initialize camera controller
          cameraControllerRef.current = new CameraController(camera, gl.domElement);
          cameraControllerRef.current.setSensitivity(sensitivity);
          
          // Optimize renderer
          gl.shadowMap.enabled = graphics.shadows !== false;
          gl.shadowMap.type = 2; // PCFSoftShadowMap
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 1.6, 0]} fov={graphics.fov} />
        <Suspense fallback={null}>
          <SceneComponent
            gameState={gameState}
            onHit={handleHit}
            sensitivity={sensitivity}
          />
        </Suspense>
      </Canvas>

      {/* Crosshair */}
      {gameState === 'playing' && !isPaused && <Crosshair settings={crosshair} />}

      {/* Pause Menu */}
      {isPaused && (
        <PauseMenu
          onResume={resumeGame}
          onExit={() => {
            endGame();
            navigate('/dashboard');
          }}
        />
      )}

      {/* Game UI */}
      {gameState !== 'finished' && (
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
            setIsPaused(false);
            setReactionTimes([]);
          }}
          onExit={() => navigate('/dashboard')}
        />
      )}
      
      {/* Results Screen */}
      {gameState === 'finished' && (
        <ResultsScreen
          mapId={mapId}
          score={score}
          accuracy={accuracy}
          hits={hits}
          misses={misses}
          avgReactionTime={reactionTimes.length > 0 
            ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
            : 0}
          duration={Math.floor((Date.now() - startTimeRef.current) / 1000)}
          personalBest={personalBest}
          leaderboardRank={leaderboardRank}
        />
      )}
    </div>
  );
}
