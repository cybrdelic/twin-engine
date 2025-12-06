
export enum PrimitiveMode {
  TRIANGLE = 0,
  SPLAT = 1,
  POINT = 2,
  VOXEL = 3
}

export type DesignMode = 'EDF' | 'TURBOFAN';

export enum ViewMode {
  STANDARD = 0,
  THERMAL = 1,  // Heat Map
  STRESS = 2,   // Structural Stress (FEM)
}

export interface PrimitiveConfig {
  designMode: DesignMode;

  alpha: number; 
  wireframe: boolean;
  gridSnap: number;
  color: string;
  adaptiveLOD: boolean; 
  structuralGradient: boolean; 
  damage: number; 
  
  // Visualizations
  viewMode: ViewMode;
  airflow: boolean; 
  debugAirflow: boolean;
  showVectors: boolean; // Vector Field
  showEM: boolean;      // Electromagnetic Field
  showSound: boolean;   // Acoustic Waves
  
  rpm: number; 
  showAxes: boolean; 
  showGrid: boolean; 
  
  // Shared Physics
  stress: number; 
  strain: number; 
  temperature: number; 
  integrity: number; 
  safetyFactor: number;
  explode: boolean;
  eccentricity: number; 

  // EDF Specific (Motor Control)
  motorMode: 'AUTO' | 'MANUAL';
  activePhases: [boolean, boolean, boolean]; // Phase A, B, C status
  phaseAngle: number; // For auto commutation visualization (0-2PI)
  voltage: number; 
  current: number; 
  power: number; 
  copperTemp: number;

  // Turbofan Specific
  fuelFlow: number; 
  egt: number; 
  compressionRatio: number; 
  pressure: number; 
  afterburner: boolean;
}
