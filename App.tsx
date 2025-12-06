
import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Grid as GridIcon, Cpu, Zap, Flame, Aperture, Wind, Settings, MoreVertical, Play, 
  Menu, MousePointer2, Move, Rotate3d, Layers, BarChart, Activity, Bug, CheckCircle2, 
  AlertTriangle, Monitor, Pause, AlertOctagon, Thermometer, Scale, Waves, Magnet, ArrowRight, Fan
} from 'lucide-react';
import UnifiedRenderer from './components/MeshViewer';
import { DesignMode, ViewMode } from './types';

const getGpuInfo = () => {
  const canvas = document.createElement('canvas');
  let gl;
  let renderer = 'Unknown GPU';
  try {
    gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      else renderer = (gl as any).getParameter((gl as any).RENDERER);
    }
  } catch (e) {}
  return renderer;
};

const MenuBar = () => (
  <div className="h-8 bg-[#18181b] flex items-center px-2 border-b border-[#27272a] select-none text-xs z-50 relative shrink-0">
    <div className="flex gap-4 px-2">
      <span className="font-bold text-blue-500 flex items-center gap-2 mr-4"><Aperture size={14}/> TWIN.ENGINE</span>
      <span className="text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded">File</span>
      <span className="text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded">Edit</span>
      <span className="text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded">View</span>
      <span className="text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded">Simulation</span>
      <span className="text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded">Tools</span>
      <span className="text-zinc-400 hover:text-white cursor-pointer hover:bg-zinc-800 px-2 py-1 rounded">Help</span>
    </div>
  </div>
);

const Toolbar = ({ 
    airflow, setAirflow, rpm, setRpm, isPlaying, setIsPlaying, integrity, stress, safetyFactor, exploded, eccentricity, 
    designMode, setDesignMode, viewMode, setViewMode, showVectors, setShowVectors, showEM, setShowEM, showSound, setShowSound,
    motorMode, setMotorMode, activePhases, togglePhase
}: any) => (
  <div className="h-10 bg-[#202023] border-b border-[#27272a] flex items-center px-2 gap-2 shrink-0 overflow-x-auto">
    <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded">
        <button onClick={() => setDesignMode('EDF')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${designMode === 'EDF' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'}`}><Zap size={12}/> EDF</button>
        <button onClick={() => setDesignMode('TURBOFAN')} className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${designMode === 'TURBOFAN' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-white'}`}><Flame size={12}/> JET</button>
    </div>
    <div className="w-[1px] h-6 bg-zinc-700 mx-2"></div>
    <div className="flex items-center gap-1">
      <button onClick={() => setIsPlaying(!isPlaying)} className={`p-1.5 rounded hover:bg-zinc-700 ${isPlaying ? 'text-green-400' : 'text-red-400'}`}>{isPlaying ? <Pause size={16}/> : <Play size={16}/>}</button>
      <button onClick={() => setAirflow(!airflow)} className={`p-1.5 rounded hover:bg-zinc-700 ${airflow ? 'text-cyan-400 bg-cyan-900/30' : 'text-zinc-400'}`} title="Airflow"><Wind size={16}/></button>
      <button onClick={() => setShowVectors(!showVectors)} className={`p-1.5 rounded hover:bg-zinc-700 ${showVectors ? 'text-yellow-400 bg-yellow-900/30' : 'text-zinc-400'}`} title="Vector Field"><ArrowRight size={16}/></button>
      <button onClick={() => setShowSound(!showSound)} className={`p-1.5 rounded hover:bg-zinc-700 ${showSound ? 'text-green-400 bg-green-900/30' : 'text-zinc-400'}`} title="Acoustics"><Waves size={16}/></button>
    </div>
    <div className="w-[1px] h-6 bg-zinc-700 mx-2"></div>
    
    <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded">
        <button onClick={() => setViewMode(0)} className={`px-2 py-1 rounded text-xs ${viewMode===0 ? 'bg-zinc-600 text-white' : 'text-zinc-400'}`}>Real</button>
        <button onClick={() => setViewMode(1)} className={`px-2 py-1 rounded text-xs ${viewMode===1 ? 'bg-red-600 text-white' : 'text-zinc-400'}`}>Heat</button>
        <button onClick={() => setViewMode(2)} className={`px-2 py-1 rounded text-xs ${viewMode===2 ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}>Stress</button>
    </div>

    {designMode === 'EDF' && (
        <>
            <div className="w-[1px] h-6 bg-zinc-700 mx-2"></div>
            <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded">
                <button onClick={() => setMotorMode('AUTO')} className={`px-2 py-1 rounded text-xs ${motorMode === 'AUTO' ? 'bg-green-600 text-white' : 'text-zinc-400'}`}>Auto</button>
                <button onClick={() => setMotorMode('MANUAL')} className={`px-2 py-1 rounded text-xs ${motorMode === 'MANUAL' ? 'bg-amber-600 text-white' : 'text-zinc-400'}`}>Manual</button>
            </div>
            {motorMode === 'MANUAL' && (
                <div className="flex items-center gap-1">
                    <button onClick={() => togglePhase(0)} className={`w-6 h-6 rounded text-xs font-bold border ${activePhases[0] ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-transparent border-zinc-600 text-zinc-500'}`}>A</button>
                    <button onClick={() => togglePhase(1)} className={`w-6 h-6 rounded text-xs font-bold border ${activePhases[1] ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-transparent border-zinc-600 text-zinc-500'}`}>B</button>
                    <button onClick={() => togglePhase(2)} className={`w-6 h-6 rounded text-xs font-bold border ${activePhases[2] ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-transparent border-zinc-600 text-zinc-500'}`}>C</button>
                </div>
            )}
        </>
    )}

    <div className="w-[1px] h-6 bg-zinc-700 mx-2"></div>
     <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1 rounded border border-zinc-800">
        <span className="text-[10px] text-zinc-500 font-mono uppercase">Throttle</span>
        <input type="range" min="0" max="12000" step="100" value={rpm} onChange={(e) => setRpm(parseFloat(e.target.value))} className="w-24 h-1 bg-zinc-700 rounded-full appearance-none accent-blue-500 cursor-pointer" />
        <span className={`text-xs font-mono w-16 text-right ${rpm > 10000 ? 'text-red-500 font-bold' : 'text-zinc-300'}`}>{rpm}</span>
     </div>
  </div>
);

const PanelHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
  <div className="h-8 border-b border-[#27272a] flex items-center px-2 gap-2 bg-[#202023]">
     <Icon size={12} className="text-zinc-400"/>
     <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{title}</span>
  </div>
);

const App: React.FC = () => {
  const [designMode, setDesignMode] = useState<DesignMode>('EDF');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.STANDARD);
  
  const [alpha, setAlpha] = useState<number>(0.0);
  const [wireframe, setWireframe] = useState(false);
  const [gridSnap, setGridSnap] = useState(1.0);
  const [adaptiveLOD, setAdaptiveLOD] = useState(false);
  const [structuralGradient, setStructuralGradient] = useState(false);
  const [damage, setDamage] = useState(0.0);
  
  // Viz toggles
  const [airflow, setAirflow] = useState(true);
  const [debugAirflow, setDebugAirflow] = useState(false);
  const [showVectors, setShowVectors] = useState(false);
  const [showEM, setShowEM] = useState(false);
  const [showSound, setShowSound] = useState(false);

  const [rpm, setRpm] = useState(600); 
  const [isPlaying, setIsPlaying] = useState(true);
  
  const [stress, setStress] = useState(0.0);
  const [strain, setStrain] = useState(0.0);
  const [temperature, setTemperature] = useState(300.0);
  const [safetyFactor, setSafetyFactor] = useState(5.0);
  const [integrity, setIntegrity] = useState(1.0);
  const [exploded, setExploded] = useState(false);
  const [eccentricity, setEccentricity] = useState(0.0);
  
  // EDF State
  const [motorMode, setMotorMode] = useState<'AUTO'|'MANUAL'>('AUTO');
  const [activePhases, setActivePhases] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [phaseAngle, setPhaseAngle] = useState(0);
  const [voltage, setVoltage] = useState(0.0);
  const [current, setCurrent] = useState(0.0);
  const [power, setPower] = useState(0.0);
  const [copperTemp, setCopperTemp] = useState(300.0);

  // Jet State
  const [fuelFlow, setFuelFlow] = useState(0.0);
  const [egt, setEgt] = useState(300.0);
  const [compressionRatio, setCompressionRatio] = useState(1.0);
  const [pressure, setPressure] = useState(1.0);

  const requestRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef<number>(0);
  
  const [showAxes, setShowAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [gpuName, setGpuName] = useState<string>("Detecting GPU...");

  useEffect(() => { setTimeout(() => setGpuName(getGpuInfo()), 100); }, []);
  
  const togglePhase = (idx: number) => {
      const next = [...activePhases] as [boolean, boolean, boolean];
      next[idx] = !next[idx];
      setActivePhases(next);
  };

  useEffect(() => {
    let currentStress = stress;
    let currentStrain = strain;
    let currentTemp = temperature;
    let currentIntegrity = integrity;
    let currentExploded = exploded;
    let currentEcc = eccentricity;
    
    // Sim State
    let simCuTemp = copperTemp;
    let simEgt = egt;
    let simPhaseAngle = phaseAngle;

    const updatePhysics = (time: number) => {
        if (isPlaying) {
            const omega = (rpm * 2 * Math.PI) / 60;
            
            // Common Structural Physics
            const DENSITY = 4430; 
            const YIELD = 880; 
            const RADIUS = 0.8; 
            
            let stressPa = DENSITY * (RADIUS * RADIUS) * (omega * omega);
            let stressMpa = stressPa / 1000000;
            
            // Runout
            const stiffness = 1000000; 
            const forceUnbalance = 0.01 * 0.5 * (omega * omega);
            const resonanceRatio = omega / 837; 
            const amp = 1 / Math.sqrt((1 - resonanceRatio**2)**2 + (0.1 * resonanceRatio)**2);
            const runout = (forceUnbalance / stiffness) * amp;
            currentEcc += (runout - currentEcc) * 0.1;

            if (designMode === 'EDF') {
                // --- EDF PHYSICS ---
                const genVoltage = rpm * 0.05;
                const loadR = 5.0; 
                const totalCurrent = genVoltage / (loadR + 0.5);
                const heatGen = (totalCurrent ** 2 * 0.5) * 0.01;
                simCuTemp += (heatGen - (simCuTemp - 300) * 0.05) * 0.1;
                currentTemp = 300 + (simCuTemp - 300) * 0.2; 
                
                // Commutation
                if (motorMode === 'AUTO') {
                    simPhaseAngle += omega * 0.016; // Advance phase
                    // Simple simulated commutation visual
                    const pA = Math.sin(simPhaseAngle) > 0;
                    const pB = Math.sin(simPhaseAngle + 2.09) > 0;
                    const pC = Math.sin(simPhaseAngle + 4.18) > 0;
                    // We don't update state every frame to avoid react thrash, but we update the shader uniforms in the renderer
                    // Actually, for React state, we only update throttle. 
                    // However, we need to pass `activePhases` to renderer.
                    // In AUTO mode, let the shader handle sine wave logic based on uTime?
                    // Or let's just do a slow UI update for the buttons.
                }

                if (time - lastUiUpdateRef.current > 100) {
                    setVoltage(genVoltage);
                    setCurrent(totalCurrent);
                    setPower((genVoltage * totalCurrent) / 1000);
                    setCopperTemp(simCuTemp);
                    
                    if (motorMode === 'AUTO') {
                        const pA = Math.sin(time * 0.01) > 0;
                        const pB = Math.sin(time * 0.01 + 2.09) > 0;
                        const pC = Math.sin(time * 0.01 + 4.18) > 0;
                        setActivePhases([pA, pB, pC]);
                    }
                }
            } else {
                // --- TURBOFAN PHYSICS ---
                const maxRatio = 30; 
                const compRatio = 1 + (maxRatio - 1) * (rpm / 12000);
                const fuel = (rpm / 12000) ** 2;
                const targetEGT = 300 + fuel * 1400; 
                simEgt += (targetEGT - simEgt) * 0.05;
                currentTemp = 300 + (simEgt - 300) * 0.4; 
                
                if (time - lastUiUpdateRef.current > 100) {
                    setFuelFlow(fuel);
                    setEgt(simEgt);
                    setCompressionRatio(compRatio);
                    setPressure(compRatio); 
                }
            }

            const tempFactor = Math.max(0, (1941 - currentTemp) / 1641);
            const currentYield = YIELD * tempFactor;
            let fos = currentYield / (stressMpa + 0.001);
            if (stressMpa < 1) fos = 10;
            const strainVal = stressMpa / 113000;

            currentStress += (stressMpa - currentStress) * 0.1;
            currentStrain += (strainVal - currentStrain) * 0.1;

            if (fos < 1.0 || currentEcc > 0.01) {
                currentIntegrity = Math.max(0, currentIntegrity - 0.05);
                if (currentIntegrity <= 0) currentExploded = true;
            } else if (!currentExploded) {
                currentIntegrity = Math.min(1.0, currentIntegrity + 0.001);
            }

            if (time - lastUiUpdateRef.current > 100) {
                setStress(currentStress);
                setStrain(currentStrain);
                setTemperature(currentTemp);
                setSafetyFactor(fos);
                setIntegrity(currentIntegrity);
                setExploded(currentExploded);
                setEccentricity(currentEcc);
                lastUiUpdateRef.current = time;
            }
        }
        requestRef.current = requestAnimationFrame(updatePhysics);
    };
    requestRef.current = requestAnimationFrame(updatePhysics);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, rpm, exploded, designMode, motorMode, activePhases]); // Added dependencies

  const resetSimulation = () => {
      setIntegrity(1.0); setExploded(false); setRpm(600); setStress(0); setTemperature(300); setCopperTemp(300); setEccentricity(0); setEgt(300);
  };

  const activeRpm = isPlaying ? rpm : 0;
  const mach = ((activeRpm * 2 * Math.PI / 60) * 0.8) / 343;

  return (
    <div className="h-screen w-screen bg-[#09090b] text-zinc-200 font-sans overflow-hidden flex flex-col select-none">
      <MenuBar />
      <Toolbar 
        airflow={airflow} setAirflow={setAirflow} 
        rpm={rpm} setRpm={setRpm} 
        isPlaying={isPlaying} setIsPlaying={setIsPlaying} 
        integrity={integrity} stress={stress} safetyFactor={safetyFactor} exploded={exploded} eccentricity={eccentricity} 
        designMode={designMode} setDesignMode={setDesignMode}
        viewMode={viewMode} setViewMode={setViewMode}
        showVectors={showVectors} setShowVectors={setShowVectors}
        showEM={showEM} setShowEM={setShowEM}
        showSound={showSound} setShowSound={setShowSound}
        motorMode={motorMode} setMotorMode={setMotorMode}
        activePhases={activePhases} togglePhase={togglePhase}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative bg-[#111]">
          <div className="absolute top-2 right-2 z-10 flex gap-1 pointer-events-auto">
             <div className="flex bg-[#18181b]/90 backdrop-blur rounded border border-zinc-700 shadow-xl p-1">
                 <button onClick={() => setShowGrid(!showGrid)} className={`p-1.5 rounded ${showGrid ? 'text-zinc-200' : 'text-zinc-600'} hover:bg-zinc-700`}><GridIcon size={14} /></button>
                 <button onClick={() => setShowAxes(!showAxes)} className={`p-1.5 rounded ${showAxes ? 'text-zinc-200' : 'text-zinc-600'} hover:bg-zinc-700`}><Move size={14} /></button>
             </div>
          </div>
          {exploded && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                  <div className="bg-red-500/20 backdrop-blur-sm border border-red-500 p-8 rounded-lg flex flex-col items-center animate-in fade-in zoom-in duration-300">
                      <AlertOctagon size={48} className="text-red-500 mb-4 animate-bounce" />
                      <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">CATASTROPHIC FAILURE</h1>
                      <button onClick={resetSimulation} className="pointer-events-auto bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded mt-4">RESET SIMULATION</button>
                  </div>
              </div>
          )}
          <div className={`w-full h-full relative cursor-crosshair transition-all duration-100 ${exploded ? 'grayscale-[50%] contrast-125' : ''}`}>
            <UnifiedRenderer 
                designMode={designMode}
                viewMode={viewMode}
                alpha={alpha} wireframe={wireframe} gridSnap={gridSnap} color="#a1a1aa" adaptiveLOD={adaptiveLOD} structuralGradient={structuralGradient} damage={damage} 
                airflow={airflow} debugAirflow={debugAirflow} 
                showVectors={showVectors} showEM={showEM} showSound={showSound}
                rpm={activeRpm} showAxes={showAxes} showGrid={showGrid} 
                stress={stress} strain={strain} temperature={temperature} integrity={integrity} safetyFactor={safetyFactor} explode={exploded} current={current} voltage={voltage} power={power} copperTemp={copperTemp} eccentricity={eccentricity} 
                fuelFlow={fuelFlow} egt={egt} compressionRatio={compressionRatio} pressure={pressure} afterburner={false}
                motorMode={motorMode} activePhases={activePhases} phaseAngle={phaseAngle}
            />
          </div>
        </div>
        <div className="w-80 bg-[#18181b] border-l border-[#27272a] flex flex-col z-30 shadow-2xl">
          <div className="h-1/4 min-h-[150px] border-b border-[#27272a] flex flex-col">
             <PanelHeader title="Scene Graph" icon={Layers} />
             <div className="flex-1 overflow-y-auto p-2 text-xs font-mono space-y-1">
                <div className="flex items-center gap-2 bg-blue-900/30 p-1 rounded text-zinc-300"><Box size={10} className="text-blue-400"/> {designMode === 'EDF' ? 'EDF_Assembly_01' : 'Turbofan_Core_X'}</div>
                <div className="flex items-center gap-2 text-zinc-500 pl-4 p-1"><Cpu size={10}/> Material_Titanium</div>
                {designMode === 'EDF' ? (
                    <div className="flex items-center gap-2 text-zinc-500 pl-4 p-1"><Zap size={10} className="text-orange-400"/> Electric_Motor_Cu</div>
                ) : (
                    <>
                        <div className="flex items-center gap-2 text-zinc-500 pl-4 p-1"><Fan size={10} className="text-blue-400"/> Compressor_Stage</div>
                        <div className="flex items-center gap-2 text-zinc-500 pl-4 p-1"><Flame size={10} className="text-red-500"/> Combustor_Liner</div>
                    </>
                )}
                {showEM && <div className="flex items-center gap-2 text-zinc-500 pl-4 p-1"><Magnet size={10} className="text-purple-400"/> Magnetic_Flux</div>}
                {airflow && <div className="flex items-center gap-2 text-zinc-500 pl-4 p-1"><Wind size={10}/> Aerodynamics</div>}
             </div>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
             <PanelHeader title="Properties" icon={Settings} />
             <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                    <div className="text-[10px] font-bold text-zinc-500 mb-2 uppercase flex justify-between">
                        <span>{designMode} Simulation</span>
                        {airflow && isPlaying && <span className="text-cyan-500 animate-pulse">● RUNNING</span>}
                    </div>
                    <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800 space-y-3">
                         <div className="grid grid-cols-2 gap-2 text-[9px] text-zinc-400">
                             {designMode === 'EDF' ? (
                                 <>
                                     <div className="flex items-center gap-1 text-orange-400"><Zap size={10}/> Electrical</div><div className="justify-end flex">{power.toFixed(1)} kW</div>
                                     <div className="flex items-center gap-1 text-zinc-500">Voltage</div><div className="justify-end flex">{voltage.toFixed(0)} V</div>
                                     <div className="flex items-center gap-1 text-zinc-500">Current</div><div className="justify-end flex">{current.toFixed(0)} A</div>
                                     <div className="flex items-center gap-1"><Thermometer size={10}/> Winding</div><div className="justify-end flex">{(copperTemp - 273.15).toFixed(0)}°C</div>
                                 </>
                             ) : (
                                 <>
                                     <div className="flex items-center gap-1 text-red-400"><Flame size={10}/> EGT</div><div className="justify-end flex">{(egt - 273.15).toFixed(0)}°C</div>
                                     <div className="flex items-center gap-1 text-zinc-500">Fuel Flow</div><div className="justify-end flex">{(fuelFlow * 100).toFixed(1)} %</div>
                                     <div className="flex items-center gap-1 text-zinc-500">Compression</div><div className="justify-end flex">{compressionRatio.toFixed(1)}:1</div>
                                     <div className="flex items-center gap-1"><Thermometer size={10}/> Casing</div><div className="justify-end flex">{(temperature - 273.15).toFixed(0)}°C</div>
                                 </>
                             )}
                             <div className="flex items-center gap-1 text-purple-400"><Scale size={10}/> Runout</div><div className="justify-end flex">{(eccentricity * 1000).toFixed(2)} mm</div>
                         </div>
                    </div>
                </div>
                
                {viewMode === 1 && (
                    <div className="bg-red-900/10 border border-red-900/30 p-2 rounded">
                        <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold mb-1">
                            <Thermometer size={12}/> THERMAL VIEW ACTIVE
                        </div>
                        <p className="text-[9px] text-zinc-400">Blue: Cool (300K) → Red: Hot (1300K)</p>
                    </div>
                )}
                {viewMode === 2 && (
                    <div className="bg-blue-900/10 border border-blue-900/30 p-2 rounded">
                        <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold mb-1">
                            <Activity size={12}/> STRESS VIEW ACTIVE
                        </div>
                        <p className="text-[9px] text-zinc-400">Blue: Low Stress → Red: Yield Point</p>
                    </div>
                )}
             </div>
          </div>
        </div>
      </div>
      <div className={`h-6 ${exploded ? 'bg-red-900' : 'bg-[#007acc]'} text-white flex items-center px-2 text-[11px] justify-between select-none shadow-inner z-50 transition-colors duration-500`}>
         <div className="flex gap-4"><span className="flex items-center gap-1 font-semibold">{exploded ? <AlertOctagon size={12}/> : <CheckCircle2 size={12}/>} {exploded ? 'FAILURE' : 'Ready'}</span>{airflow && <span className="flex items-center gap-1 opacity-80"><Wind size={10}/> Mach {mach.toFixed(2)}</span>}</div>
         <div className="flex gap-4 items-center"><span className="flex items-center gap-1"><Monitor size={12} className="opacity-70"/> {gpuName}</span><span className="opacity-50">|</span><span>Grid: {gridSnap}m</span></div>
      </div>
    </div>
  );
};

export default App;
