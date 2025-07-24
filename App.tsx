
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls, KeyboardControlsEntry } from '@react-three/drei';
import { Vector3 } from 'three';
import type { MazeData, GameState, Vector3Tuple, LaserData, MazePoint, AlienTargetState } from './types';
import { generateMaze } from './services/mazeGenerator';
import LoadingScreen from './components/common/LoadingScreen';
import ErrorScreen from './components/common/ErrorScreen';
import HUD from './components/hud/HUD';
import Maze3D from './components/maze/Maze3D';
import Player from './components/player/Player';
import { MAZE_SIZE, WALL_THICKNESS, WALL_HEIGHT } from './constants';

enum Controls {
  forward = 'forward',
  backward = 'backward',
  left = 'left',
  right = 'right',
}

const App = () => {
  const [gameState, setGameState] = useState<GameState>('loading');
  const [mazeData, setMazeData] = useState<MazeData | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Vector3Tuple[]>([]);
  const [lasers, setLasers] = useState<LaserData[]>([]);
  const [error, setError] = useState<string>('');
  const [resetKey, setResetKey] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [alienTarget, setAlienTarget] = useState<AlienTargetState | null>(null);
  const [explodingAlienPos, setExplodingAlienPos] = useState<Vector3Tuple | null>(null);

  const controlMap: KeyboardControlsEntry<Controls>[] = useMemo(() => [
    { name: Controls.forward, keys: ['ArrowUp', 'w', 'W'] },
    { name: Controls.backward, keys: ['ArrowDown', 's', 'S'] },
    { name: Controls.left, keys: ['ArrowLeft', 'a', 'A'] },
    { name: Controls.right, keys: ['ArrowRight', 'd', 'D'] },
  ], []);

  const addBreadcrumb = useCallback((position: Vector3Tuple) => {
    setBreadcrumbs(prev => [...prev, position]);
  }, []);

  const addLaser = useCallback((position: Vector3Tuple, direction: Vector3Tuple) => {
    setLasers(prev => [...prev, {
      id: Math.random().toString(36).substring(2, 9),
      position,
      direction
    }]);
  }, []);

  const removeLaser = useCallback((id: string) => {
    setLasers(prev => prev.filter(laser => laser.id !== id));
  }, []);

  const handleAlienHit = useCallback((laserId: string) => {
    setLasers(prev => prev.filter(l => l.id !== laserId));
    if (alienTarget && !alienTarget.isDestroyed) {
      setExplodingAlienPos(alienTarget.position);
      setAlienTarget(prev => prev ? { ...prev, isDestroyed: true } : null);
    }
  }, [alienTarget]);

  const checkWallCollision = useCallback((position: Vector3) => {
    if (!mazeData) return false;
    const { maze } = mazeData;
    const halfMazeSize = (MAZE_SIZE * WALL_THICKNESS) / 2;
    const gridX = Math.floor((position.x + halfMazeSize) / WALL_THICKNESS);
    const gridZ = Math.floor((position.z + halfMazeSize) / WALL_THICKNESS);

    if (gridX < 0 || gridX >= MAZE_SIZE || gridZ < 0 || gridZ >= MAZE_SIZE) {
      return true; // Collide with outer bounds
    }
    return maze[gridZ]?.[gridX] === 1;
  }, [mazeData]);

  const checkPlayerCollision = useCallback((position: Vector3) => {
    if (checkWallCollision(position)) return true;

    if (alienTarget && !alienTarget.isDestroyed) {
        const halfMazeSize = (MAZE_SIZE * WALL_THICKNESS) / 2;
        const gridX = Math.floor((position.x + halfMazeSize) / WALL_THICKNESS);
        const gridZ = Math.floor((position.z + halfMazeSize) / WALL_THICKNESS);
        if (gridX === alienTarget.gridPos.x && gridZ === alienTarget.gridPos.z) {
            return true;
        }
    }
    return false;
  }, [checkWallCollision, alienTarget]);

  const placeAlienTarget = (maze: number[][], start: MazePoint, end: MazePoint) => {
    const possibleLocations: { x: number; z: number; orientation: 'x' | 'z' }[] = [];
    for (let z = 1; z < MAZE_SIZE - 1; z++) {
        for (let x = 1; x < MAZE_SIZE - 1; x++) {
            if ((x === start.x && z === start.z) || (x === end.x && z === end.z)) continue;

            if (maze[z][x] === 0) {
                const isNorthSouthCorridor = maze[z - 1]?.[x] === 0 && maze[z + 1]?.[x] === 0 && maze[z][x - 1] === 1 && maze[z][x + 1] === 1;
                const isEastWestCorridor = maze[z][x - 1] === 0 && maze[z][x + 1] === 0 && maze[z - 1]?.[x] === 1 && maze[z + 1]?.[x] === 1;
                
                if (isNorthSouthCorridor) possibleLocations.push({ x, z, orientation: 'z' });
                if (isEastWestCorridor) possibleLocations.push({ x, z, orientation: 'x' });
            }
        }
    }

    if (possibleLocations.length > 0) {
        const loc = possibleLocations[Math.floor(Math.random() * possibleLocations.length)];
        const halfMazeSize = (MAZE_SIZE * WALL_THICKNESS) / 2;
        const centerOffset = WALL_THICKNESS / 2;
        const position: Vector3Tuple = [
            loc.x * WALL_THICKNESS - halfMazeSize + centerOffset,
            WALL_HEIGHT / 2,
            loc.z * WALL_THICKNESS - halfMazeSize + centerOffset
        ];
        setAlienTarget({
            position,
            orientation: loc.orientation,
            isDestroyed: false,
            gridPos: { x: loc.x, z: loc.z }
        });
    } else {
        setAlienTarget(null);
    }
  };

  const startNewGame = useCallback(async () => {
    setGameState('loading');
    setHasStarted(false);
    setMazeData(null);
    setBreadcrumbs([]);
    setLasers([]);
    setAlienTarget(null);
    setExplodingAlienPos(null);
    try {
      const data = await generateMaze();
      setMazeData(data);
      placeAlienTarget(data.maze, data.start, data.end);
      setGameState('intro');
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
      setGameState('error');
    }
  }, []);

  const resetCurrentGame = useCallback(() => {
    setBreadcrumbs([]);
    setLasers([]);
    setExplodingAlienPos(null);
    if (alienTarget) {
      setAlienTarget(prev => prev ? { ...prev, isDestroyed: false } : null);
    }
    setResetKey(prev => prev + 1);
    setGameState('playing');
  }, [alienTarget]);

  const handlePlay = () => {
    if (!hasStarted) {
      setHasStarted(true);
    }
    setGameState('playing');
  };

  useEffect(() => {
    startNewGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handlePointerLockChange = () => {
      if (document.pointerLockElement === null && gameState === 'playing') {
        setGameState('intro');
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [gameState]);


  const renderContent = () => {
    switch (gameState) {
      case 'loading':
        return <LoadingScreen />;
      case 'error':
        return <ErrorScreen message={error} onRetry={startNewGame} />;
      default:
        if (!mazeData) return <LoadingScreen />;
        return (
          <>
            <HUD 
              gameState={gameState} 
              onPlay={handlePlay}
              hasStarted={hasStarted}
              onPlayAgain={startNewGame} 
              onReset={resetCurrentGame}
            />
            <KeyboardControls map={controlMap}>
              <Canvas shadows camera={{ fov: 75, near: 0.1, far: 1000 }}>
                <Player 
                  key={resetKey}
                  mazeData={mazeData} 
                  gameState={gameState} 
                  onWin={() => setGameState('won')}
                  addBreadcrumb={addBreadcrumb}
                  addLaser={addLaser}
                  checkCollision={checkPlayerCollision}
                />
                <Maze3D 
                  mazeData={mazeData} 
                  breadcrumbs={breadcrumbs} 
                  lasers={lasers}
                  onRemoveLaser={removeLaser}
                  alienTarget={alienTarget}
                  checkWallCollision={checkWallCollision}
                  onAlienHit={handleAlienHit}
                  explodingAlienPos={explodingAlienPos}
                  onExplosionComplete={() => setExplodingAlienPos(null)}
                />
              </Canvas>
            </KeyboardControls>
          </>
        );
    }
  };

  return <div className="w-screen h-screen bg-black">{renderContent()}</div>;
};

export default App;
