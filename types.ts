
export interface MazePoint {
  x: number;
  z: number;
}

export interface MazeData {
  maze: number[][];
  start: MazePoint;
  end: MazePoint;
}

export type GameState = 'loading' | 'intro' | 'playing' | 'won' | 'error';

export type Vector3Tuple = [number, number, number];

export interface LaserData {
  id: string;
  position: Vector3Tuple;
  direction: Vector3Tuple;
}

export interface AlienTargetState {
  position: Vector3Tuple;
  orientation: 'x' | 'z';
  gridPos: MazePoint;
  isDestroyed: boolean;
}
