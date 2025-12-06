
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import * as THREE from 'three';
import { PrimitiveConfig, DesignMode } from '../types';

// --- LOOP ENFORCER ---
const LoopEnforcer = () => {
  const { invalidate } = useThree();
  useFrame(() => {
    invalidate();
  });
  return null;
};

interface ThreeShader {
  uniforms: { [key: string]: { value: any } };
  vertexShader: string;
  fragmentShader: string;
}

// --- PHYSICS SHADER INJECTION ---
const injectPhysicsShader = (shader: ThreeShader, type: string) => {
  shader.uniforms.uTime = { value: 0 };
  shader.uniforms.uRpm = { value: 0 };
  shader.uniforms.uStrain = { value: 0 };
  shader.uniforms.uTemperature = { value: 300 };
  shader.uniforms.uExplode = { value: 0 };
  shader.uniforms.uCurrent = { value: 0 };
  shader.uniforms.uEccentricity = { value: 0 };
  shader.uniforms.uFuel = { value: 0 };
  shader.uniforms.uViewMode = { value: 0 };
  shader.uniforms.uPhases = { value: new THREE.Vector3(0,0,0) };
  shader.uniforms.uVoltage = { value: 0 };

  const commonHeader = `
    uniform float uTime;
    uniform float uRpm;
    uniform float uStrain;
    uniform float uTemperature;
    uniform float uExplode;
    uniform float uCurrent;
    uniform float uEccentricity;
    uniform float uFuel;
    uniform float uViewMode;
    uniform vec3 uPhases;
    uniform float uVoltage;
    
    varying float vTemp;
    varying float vStress;
    varying float vFriction;
    varying vec3 vWorldPos;
    varying float vPhaseID;
    
    float hash(vec3 p) {
        p = fract(p * 0.3183099 + .1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    
    vec3 turboColormap(float t) {
        return mix(vec3(0,0,1), mix(vec3(0,1,0), vec3(1,0,0), smoothstep(0.5, 1.0, t)), smoothstep(0.0, 0.5, t));
    }
    
    vec3 blackbody(float T) {
        vec3 c = vec3(255.0);
        c.x = 5.6e7 * pow(T, -1.5) + 148.0;
        c.y = 1.0e8 * pow(T, -1.5) + 28.0;
        c.z = 1.9e8 * pow(T, -1.5);
        return clamp(c, 0.0, 255.0) / 255.0;
    }
  `;
  
  // Attribute only injected into Vertex Shader
  const vertexHeader = `
    ${type === 'coil' ? 'attribute float aPhase;' : ''}
  `;

  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + commonHeader + vertexHeader);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + commonHeader);

  // --- VERTEX LOGIC ---
  const vertexLogic = `
    vec3 transformed = vec3( position );
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vPhaseID = ${type === 'coil' ? 'aPhase' : '0.0'};

    // Eccentricity (Shaft Runout)
    if (${type === 'rotor' || type === 'shaft' || type === 'blade_hot' || type === 'compressor' ? 'true' : 'false'}) {
        if (uEccentricity > 0.0001) {
            float rotSpeed = uRpm * 0.1047;
            float angle = uTime * rotSpeed; 
            transformed.x += cos(angle) * uEccentricity * 50.0; 
            transformed.y += sin(angle) * uEccentricity * 50.0;
        }
    }

    vec3 radial = normalize(vec3(transformed.x, transformed.y, 0.0));
    float r = length(transformed.xy);
    
    // Deformation
    if (uExplode < 0.01) {
        // Centrifugal Expansion
        if (${type === 'rotor' || type === 'blade_hot' || type === 'compressor' ? 'true' : 'false'}) {
            transformed += radial * (uStrain * 5.0 * r);
        }
        
        // Thermal Expansion
        float tDelta = max(0.0, uTemperature - 300.0);
        if (${type === 'combustor' ? 'true' : 'false'}) tDelta += uFuel * 1000.0;
        
        transformed += normalize(normal) * (tDelta * 0.00005);
        
        // Vibration
        if (uRpm > 100.0) {
           float vibFreq = uRpm * 0.1;
           float vibAmp = (uRpm * uRpm) * 1e-11; 
           if (${type === 'bolt' ? 'true' : 'false'}) vibAmp *= 10.0;
           
           // Coil Vibration (Lorentz)
           if (${type === 'coil' ? 'true' : 'false'}) {
               float activePh = 0.0;
               if (abs(vPhaseID - 0.0) < 0.1) activePh = uPhases.x;
               else if (abs(vPhaseID - 1.0) < 0.1) activePh = uPhases.y;
               else if (abs(vPhaseID - 2.0) < 0.1) activePh = uPhases.z;
               if (activePh > 0.5) vibAmp *= 50.0;
           }
           transformed += normalize(normal) * sin(uTime * vibFreq + transformed.z) * vibAmp;
        }
    } else {
        // Explosion
        vec3 randDir = normalize(vec3(hash(position)-0.5, hash(position*2.0)-0.5, hash(position*3.0)-0.5));
        vec3 velocity = radial * 10.0;
        transformed += (velocity + randDir * 5.0) * uExplode;
    }

    // Varyings
    vTemp = uTemperature;
    
    float tipSpeed = r * uRpm * 0.001; 
    vFriction = tipSpeed * tipSpeed * 0.2;
    if (${type === 'stator' || type === 'casing' ? 'true' : 'false'}) vFriction *= 0.1; 
    vTemp += vFriction; 

    if (${type === 'coil' ? 'true' : 'false'}) vTemp += uCurrent * 0.5;
    if (${type === 'combustor' ? 'true' : 'false'}) vTemp += uFuel * 1500.0;
    if (${type === 'blade_hot' ? 'true' : 'false'}) vTemp += uFuel * 1200.0;
    
    vStress = (r*r) * (uRpm*uRpm) * 1e-9;
    vStress += max(0.0, vTemp - 300.0) * 0.0005;
  `;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', vertexLogic);

  // --- NORMAL LOGIC ---
  const normalLogic = `
    vec3 objectNormal = vec3( normal );
    if (uExplode > 0.01) {
       float rnd = hash(position + vec3(floor(uExplode * 10.0)));
       vec3 randDir = normalize(vec3(rnd - 0.5, hash(position * 2.0) - 0.5, hash(position * 3.0) - 0.5));
       objectNormal = normalize(objectNormal + randDir * uExplode);
    }
  `;
  shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', normalLogic);

  // --- FRAGMENT LOGIC ---
  const colorLogic = `
    #include <color_fragment>
    
    if (abs(uViewMode - 1.0) < 0.1) {
        // Thermal
        float tNorm = clamp((vTemp - 300.0) / 1000.0, 0.0, 1.0);
        vec3 heatMap = turboColormap(tNorm);
        if (vFriction > 50.0) heatMap += vec3(1.0, 1.0, 0.0) * (vFriction / 500.0);
        diffuseColor.rgb = mix(vec3(0.1, 0.1, 0.4), heatMap, 0.8);
        diffuseColor.rgb += vec3(0.1); 
    } 
    else if (abs(uViewMode - 2.0) < 0.1) {
        // Stress
        float sNorm = clamp(vStress * 2.0, 0.0, 1.0); 
        diffuseColor.rgb = mix(vec3(0.0, 0.2, 0.8), vec3(1.0, 0.0, 0.0), sNorm);
        float stripes = sin(vStress * 100.0);
        diffuseColor.rgb += smoothstep(0.9, 1.0, stripes) * 0.3;
    }
  `;
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', colorLogic);

  const emissiveLogic = `
    vec3 heatColor = vec3(0.0);
    
    if (uViewMode < 0.5) { 
        if (vTemp > 800.0) heatColor += blackbody(vTemp);
        
        if (${type === 'coil' ? 'true' : 'false'}) {
             float activePh = 0.0;
             if (abs(vPhaseID - 0.0) < 0.1) activePh = uPhases.x;
             else if (abs(vPhaseID - 1.0) < 0.1) activePh = uPhases.y;
             else if (abs(vPhaseID - 2.0) < 0.1) activePh = uPhases.z;
             
             if (activePh > 0.1) {
                 float pulse = 0.8 + 0.2 * sin(uTime * 60.0);
                 vec3 voltageColor = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.8, 0.0), clamp(uVoltage / 100.0, 0.0, 1.0));
                 heatColor += voltageColor * activePh * 3.0; 
             }
        }

        if (${type === 'combustor' ? 'true' : 'false'}) {
          if (uFuel > 0.05) {
             float noise = sin(vWorldPos.x*30.0 + uTime*60.0) * cos(vWorldPos.y*30.0);
             heatColor += vec3(1.0, 0.5, 0.1) * (uFuel * 3.0) * (0.5 + 0.5*noise);
          }
        }
    }
    totalEmissiveRadiance += heatColor;
  `;
  shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', emissiveLogic);
};

// --- VISUALIZERS ---

const AirflowVisualizer = React.memo(({ config, vectorMode }: { config: PrimitiveConfig, vectorMode: boolean }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const count = 5000;

    const { geometry } = useMemo(() => {
        const g = vectorMode 
            ? new THREE.ConeGeometry(0.08, 0.4, 8) 
            : new THREE.BoxGeometry(0.04, 0.04, 2.5);
        if (vectorMode) g.rotateX(Math.PI/2); 

        const offset = new Float32Array(count * 3);
        const speed = new Float32Array(count);
        for(let i=0; i<count; i++) {
            const r = 2.0 + Math.random() * 6.0; 
            const theta = Math.random() * 6.28;
            offset[i*3] = r*Math.cos(theta);
            offset[i*3+1] = r*Math.sin(theta);
            offset[i*3+2] = Math.random() * 60 - 30; 
            speed[i] = 0.5 + Math.random();
        }
        g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offset, 3));
        g.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speed, 1));
        return { geometry: g };
    }, [vectorMode]);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
            materialRef.current.uniforms.uSpeed.value = 2.0 + (config.rpm / 200.0); 
            materialRef.current.uniforms.uHeat.value = config.designMode === 'TURBOFAN' ? config.fuelFlow : 0;
        }
    });

    const vert = `
      uniform float uTime; uniform float uSpeed;
      attribute vec3 aOffset; attribute float aSpeed;
      varying float vAlpha;
      varying float vZ;
      void main() {
          float t = uTime * uSpeed * (0.5 + aSpeed); 
          float z = mod(aOffset.z - t + 30.0, 60.0) - 30.0;
          vZ = z;
          
          vec3 pos = position;
          vec3 center = vec3(aOffset.xy, z);
          
          if (z > 7.0) center.xy *= mix(1.0, 1.6, clamp((z-7.0)/5.0, 0.0, 1.0)); 
          if (z < -8.0) center.xy *= mix(1.0, 0.7, clamp((-8.0-z)/5.0, 0.0, 1.0));

          vec3 worldPos = center + pos;
          gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
          
          vAlpha = smoothstep(-30.0, -25.0, z) * (1.0 - smoothstep(25.0, 30.0, z));
      }
    `;
    const frag = `
      varying float vAlpha;
      varying float vZ;
      uniform float uHeat;
      void main() { 
          vec3 color = vec3(0.5, 0.9, 1.0);
          if (uHeat > 0.01 && vZ < 0.0) {
              color = mix(color, vec3(1.0, 0.4, 0.0), uHeat * 3.0); 
          }
          gl_FragColor = vec4(color, vAlpha * 0.7); 
      }
    `;

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false} renderOrder={100}>
            <shaderMaterial ref={materialRef} transparent vertexShader={vert} fragmentShader={frag} uniforms={{uTime:{value:0}, uSpeed:{value:1}, uHeat:{value:0}}} depthWrite={false} blending={THREE.AdditiveBlending} />
        </instancedMesh>
    );
});

const FluxVisualizer = React.memo(({ active }: { active: boolean }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const count = 300;

    const { geometry } = useMemo(() => {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(3, 0, 0),
            new THREE.Vector3(5, 3, 0),
            new THREE.Vector3(7, 0, 0)
        ]);
        const g = new THREE.TubeGeometry(curve, 16, 0.03, 4, false);
        const offset = new Float32Array(count * 3);
        for(let i=0; i<count; i++) {
            offset[i*3] = (i/count) * Math.PI * 2; 
            offset[i*3+1] = Math.random(); 
            offset[i*3+2] = 0;
        }
        g.setAttribute('aData', new THREE.InstancedBufferAttribute(offset, 3));
        return { geometry: g };
    }, []);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
            materialRef.current.uniforms.uActive.value = active ? 1.0 : 0.0;
        }
    });

    const vert = `
        uniform float uTime;
        attribute vec3 aData;
        varying float vAlpha;
        void main() {
            float angle = aData.x + uTime * 0.5;
            float c = cos(angle);
            float s = sin(angle);
            vec3 pos = position;
            vec3 rotPos = vec3(pos.x*c - pos.y*s, pos.x*s + pos.y*c, pos.z);
            gl_Position = projectionMatrix * viewMatrix * vec4(rotPos, 1.0);
            vAlpha = 0.5 + 0.5 * sin(uTime * 15.0 + aData.y * 10.0);
        }
    `;
    const frag = `
        uniform float uActive;
        varying float vAlpha;
        void main() {
            if (uActive < 0.5) discard;
            gl_FragColor = vec4(0.6, 0.2, 1.0, vAlpha * 0.6);
        }
    `;

    return (
        <instancedMesh ref={meshRef} args={[geometry, undefined, count]} renderOrder={101}>
            <shaderMaterial ref={materialRef} transparent vertexShader={vert} fragmentShader={frag} uniforms={{uTime:{value:0}, uActive:{value:0}}} depthWrite={false} blending={THREE.AdditiveBlending} />
        </instancedMesh>
    );
});

const AcousticVisualizer = React.memo(({ rpm, active }: { rpm: number, active: boolean }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
            materialRef.current.uniforms.uFreq.value = rpm;
            materialRef.current.uniforms.uActive.value = active ? 1.0 : 0.0;
        }
    });

    const vert = `
        varying vec3 vPos;
        void main() {
            vPos = position;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
    `;
    const frag = `
        uniform float uTime;
        uniform float uFreq;
        uniform float uActive;
        varying vec3 vPos;
        void main() {
            if (uActive < 0.5 || uFreq < 100.0) discard;
            float dist = length(vPos);
            float wave = sin(dist * 2.0 - uTime * (uFreq * 0.02));
            float alpha = smoothstep(0.9, 1.0, wave) * (1.0 - smoothstep(0.0, 20.0, dist));
            vec3 color = mix(vec3(0.0, 1.0, 0.5), vec3(1.0, 0.0, 0.0), uFreq / 12000.0);
            gl_FragColor = vec4(color, alpha * 0.4);
        }
    `;

    return (
        <mesh ref={meshRef} scale={[1.5, 1.5, 1.5]}>
            <sphereGeometry args={[20, 64, 64]} />
            <shaderMaterial 
                ref={materialRef} 
                transparent 
                side={THREE.DoubleSide} 
                vertexShader={vert} 
                fragmentShader={frag} 
                uniforms={{uTime:{value:0}, uFreq:{value:0}, uActive:{value:0}}} 
                depthWrite={false} 
                blending={THREE.AdditiveBlending} 
            />
        </mesh>
    )
});

// --- SCENE 1: EDF ---

const EDFScene = ({ config, materials }: { config: PrimitiveConfig, materials: any }) => {
    const rotorRef = useRef<THREE.Group>(null);
    const statorRef = useRef<THREE.Group>(null);
    const bladesRef = useRef<THREE.InstancedMesh>(null);
    const coilsRef = useRef<THREE.InstancedMesh>(null);

    // Z-Aligned Geometries
    const shaftGeo = useMemo(() => { const g = new THREE.CylinderGeometry(1, 1, 20, 16); g.rotateX(Math.PI/2); return g; }, []);
    const magnetGeo = useMemo(() => { const g = new THREE.CylinderGeometry(3, 3, 6, 32); g.rotateX(Math.PI/2); return g; }, []);
    const casingGeo = useMemo(() => { const g = new THREE.CylinderGeometry(8.5, 8.5, 12, 48, 1, true); g.rotateX(Math.PI/2); return g; }, []);
    const ironGeo = useMemo(() => { const g = new THREE.CylinderGeometry(7.8, 7.8, 6, 24, 1, true); g.rotateX(Math.PI/2); return g; }, []);
    const bearingGeo = useMemo(() => { const g = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 16); g.rotateX(Math.PI/2); return g; }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const updateUniforms = (obj: any) => {
            if (obj.material?.userData?.shader) {
                const u = obj.material.userData.shader.uniforms;
                u.uTime.value = t;
                u.uRpm.value = config.rpm;
                u.uStrain.value = config.strain;
                u.uTemperature.value = config.temperature;
                u.uExplode.value = config.explode ? 1.0 + (t%10) : 0;
                u.uEccentricity.value = config.eccentricity;
                u.uCurrent.value = config.current;
                u.uViewMode.value = config.viewMode;
                u.uPhases.value.set(
                    config.activePhases[0] ? 1 : 0, 
                    config.activePhases[1] ? 1 : 0, 
                    config.activePhases[2] ? 1 : 0
                );
                u.uVoltage.value = config.voltage;
            }
        };
        rotorRef.current?.traverse(updateUniforms);
        statorRef.current?.traverse(updateUniforms);
        
        // Spin Rotor (CPU Rotation)
        if (rotorRef.current) {
            rotorRef.current.rotation.z = -t * (config.rpm * 0.1047);
        }
    });

    React.useLayoutEffect(() => {
        if(bladesRef.current) {
            const temp = new THREE.Object3D();
            for(let i=0; i<24; i++) {
                const a = (i/24)*Math.PI*2;
                temp.rotation.set(0.4, 0, a);
                temp.position.set(Math.cos(a)*4, Math.sin(a)*4, 7); 
                temp.updateMatrix();
                bladesRef.current.setMatrixAt(i, temp.matrix);
            }
            bladesRef.current.instanceMatrix.needsUpdate = true;
        }
        if(coilsRef.current) {
            const temp = new THREE.Object3D();
            const phaseAttr = new Float32Array(24);
            for(let i=0; i<24; i++) {
                const a = (i/24)*Math.PI*2;
                temp.rotation.set(0, 0, a);
                temp.position.set(Math.cos(a)*7.2, Math.sin(a)*7.2, 0); 
                temp.updateMatrix();
                coilsRef.current.setMatrixAt(i, temp.matrix);
                phaseAttr[i] = i % 3;
            }
            coilsRef.current.instanceMatrix.needsUpdate = true;
            coilsRef.current.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phaseAttr, 1));
        }
    }, []);

    return (
        <group>
            {/* Rotor */}
            <group ref={rotorRef}>
                <mesh material={materials.shaft} geometry={shaftGeo} />
                <mesh position={[0,0,9]} rotation={[-Math.PI/2, 0, 0]} material={materials.titaniumPolished}><coneGeometry args={[1.5, 4, 32]} /></mesh>
                <instancedMesh ref={bladesRef} args={[undefined, undefined, 24]} material={materials.titaniumPolished}><boxGeometry args={[3.5, 0.1, 1.5]} /></instancedMesh>
                <mesh material={materials.magnet} geometry={magnetGeo} />
            </group>
            {/* Stator */}
            <group ref={statorRef}>
                <mesh material={materials.casing} geometry={casingGeo} />
                <mesh material={materials.iron} geometry={ironGeo} />
                <instancedMesh ref={coilsRef} args={[undefined, undefined, 24]} material={materials.copper}><boxGeometry args={[0.4, 0.8, 8]} /></instancedMesh>
                <mesh position={[0,0,5]} material={materials.iron} geometry={bearingGeo} />
            </group>
        </group>
    );
};

// --- SCENE 2: TURBOFAN ---

const TurbofanScene = ({ config, materials }: { config: PrimitiveConfig, materials: any }) => {
    const rotorRef = useRef<THREE.Group>(null);
    const statorRef = useRef<THREE.Group>(null);
    const bladesRef = useRef<THREE.InstancedMesh>(null);
    const compRef = useRef<THREE.InstancedMesh>(null);
    const turbineRef = useRef<THREE.InstancedMesh>(null);

    // Z-Aligned Geometries
    const shaftGeo = useMemo(() => { const g = new THREE.CylinderGeometry(0.8, 0.8, 24, 16); g.rotateX(Math.PI/2); return g; }, []);
    const casingGeo = useMemo(() => { const g = new THREE.CylinderGeometry(8.5, 8.5, 22, 48, 1, true); g.rotateX(Math.PI/2); return g; }, []);
    const combustorGeo = useMemo(() => { const g = new THREE.CylinderGeometry(4, 4, 4, 32, 1, true); g.rotateX(Math.PI/2); return g; }, []);
    const bearingGeo = useMemo(() => { const g = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 16); g.rotateX(Math.PI/2); return g; }, []);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        const updateUniforms = (obj: any) => {
            if (obj.material?.userData?.shader) {
                const u = obj.material.userData.shader.uniforms;
                u.uTime.value = t;
                u.uRpm.value = config.rpm;
                u.uTemperature.value = config.temperature;
                u.uStrain.value = config.strain;
                u.uExplode.value = config.explode ? 1.0 + (t%10) : 0;
                u.uFuel.value = config.fuelFlow;
                u.uViewMode.value = config.viewMode;
                u.uEccentricity.value = config.eccentricity;
            }
        };
        rotorRef.current?.traverse(updateUniforms);
        statorRef.current?.traverse(updateUniforms);
        
        // Spin Rotor (CPU)
        if (rotorRef.current) {
            rotorRef.current.rotation.z = -t * (config.rpm * 0.1047);
        }
    });

    React.useLayoutEffect(() => {
        if(bladesRef.current) {
            const temp = new THREE.Object3D();
            for(let i=0; i<24; i++) {
                const a = (i/24)*Math.PI*2;
                temp.rotation.set(0.4, 0, a);
                temp.position.set(Math.cos(a)*4, Math.sin(a)*4, 9); 
                temp.updateMatrix();
                bladesRef.current.setMatrixAt(i, temp.matrix);
            }
            bladesRef.current.instanceMatrix.needsUpdate = true;
        }
        if (compRef.current) {
            const temp = new THREE.Object3D();
            let idx = 0;
            for(let stage=0; stage<4; stage++) {
                const z = 4 - stage*1.5;
                const scale = 0.9 - stage*0.1;
                for(let i=0; i<16; i++) {
                    const a = (i/16)*Math.PI*2;
                    temp.rotation.set(0.3, 0, a);
                    temp.position.set(Math.cos(a)*3*scale, Math.sin(a)*3*scale, z);
                    temp.scale.set(scale, scale, scale);
                    temp.updateMatrix();
                    compRef.current.setMatrixAt(idx++, temp.matrix);
                }
            }
            compRef.current.instanceMatrix.needsUpdate = true;
        }
        if (turbineRef.current) {
            const temp = new THREE.Object3D();
            let idx = 0;
            for(let stage=0; stage<2; stage++) {
                const z = -6 - stage*1.5;
                for(let i=0; i<16; i++) {
                    const a = (i/16)*Math.PI*2;
                    temp.rotation.set(-0.3, 0, a);
                    temp.position.set(Math.cos(a)*3, Math.sin(a)*3, z);
                    temp.updateMatrix();
                    turbineRef.current.setMatrixAt(idx++, temp.matrix);
                }
            }
            turbineRef.current.instanceMatrix.needsUpdate = true;
        }
    }, []);

    return (
        <group>
            {/* Rotor Group */}
            <group ref={rotorRef}>
                <mesh material={materials.shaft} geometry={shaftGeo} />
                <mesh position={[0,0,11]} rotation={[-Math.PI/2, 0, 0]} material={materials.titaniumPolished}><coneGeometry args={[1.5, 5, 32]} /></mesh>
                <instancedMesh ref={bladesRef} args={[undefined, undefined, 24]} material={materials.titaniumPolished}><boxGeometry args={[3.5, 0.1, 1.5]} /></instancedMesh>
                <instancedMesh ref={compRef} args={[undefined, undefined, 64]} material={materials.compressor}><boxGeometry args={[1.5, 0.05, 0.8]} /></instancedMesh>
                <instancedMesh ref={turbineRef} args={[undefined, undefined, 32]} material={materials.bladeHot}><boxGeometry args={[2.0, 0.05, 0.8]} /></instancedMesh>
            </group>
            {/* Stator Group */}
            <group ref={statorRef}>
                <mesh material={materials.casing} geometry={casingGeo} />
                <mesh position={[0,0,-1]} material={materials.combustor} geometry={combustorGeo} />
                <mesh position={[0,0,5]} material={materials.iron} geometry={bearingGeo} />
                <mesh position={[0,0,-5]} material={materials.iron} geometry={bearingGeo} />
            </group>
        </group>
    );
};

// --- MAIN RENDERER ---
const UnifiedRenderer: React.FC<PrimitiveConfig> = (props) => {
  const materials = useMemo(() => {
      const createMat = (color: string, rough: number, metal: number, type: string) => {
          const m = new THREE.MeshStandardMaterial({ 
              color, roughness: rough, metalness: metal, side: THREE.DoubleSide, envMapIntensity: 1.0 
          });
          m.onBeforeCompile = (shader) => {
              m.userData.shader = shader;
              injectPhysicsShader(shader as ThreeShader, type);
          };
          m.customProgramCacheKey = () => type; 
          return m;
      };

      return {
          titaniumPolished: createMat('#b0b5b9', 0.2, 1.0, 'rotor'),
          titaniumRough: createMat('#888899', 0.6, 0.8, 'rotor'),
          casing: createMat('#444444', 0.7, 0.5, 'casing'),
          copper: createMat('#b87333', 0.3, 1.0, 'coil'),
          iron: createMat('#222222', 0.8, 0.4, 'stator'),
          magnet: createMat('#e0e0e0', 0.1, 1.0, 'rotor'),
          bolt: createMat('#cccccc', 0.4, 0.9, 'bolt'),
          shaft: createMat('#555555', 0.3, 0.8, 'shaft'),
          combustor: createMat('#111111', 0.9, 0.1, 'combustor'),
          bladeHot: createMat('#554433', 0.6, 0.7, 'blade_hot'),
          compressor: createMat('#777777', 0.6, 0.8, 'compressor'),
      };
  }, []);

  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }} camera={{ position: [20, 15, 20], fov: 30 }}>
       <color attach="background" args={['#050505']} />
       <OrbitControls makeDefault minDistance={5} maxDistance={60} enableDamping />
       <ambientLight intensity={0.5} />
       <spotLight position={[30, 30, 10]} angle={0.3} penumbra={1} intensity={800} castShadow />
       <pointLight position={[-15, 5, -15]} intensity={100} color="#4466ff" />
       
       <Environment preset="city" background blur={0.8} />
       
       {props.designMode === 'EDF' ? (
           <EDFScene config={props} materials={materials} />
       ) : (
           <TurbofanScene config={props} materials={materials} />
       )}
       
       {props.airflow && <AirflowVisualizer config={props} vectorMode={props.showVectors} />}
       {props.showEM && props.designMode === 'EDF' && <FluxVisualizer active={props.current > 1 || props.motorMode === 'MANUAL'} />}
       {props.showSound && <AcousticVisualizer rpm={props.rpm} active={props.rpm > 100} />}
       
       {props.showGrid && <Grid args={[40, 40]} cellColor="#222" sectionColor="#444" fadeDistance={40} />}
       <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
         <GizmoViewport />
       </GizmoHelper>
       
       <EffectComposer enableNormalPass={false}>
         <Bloom luminanceThreshold={1.0} mipmapBlur intensity={1.5} radius={0.5} />
         <ToneMapping />
       </EffectComposer>
       <LoopEnforcer />
    </Canvas>
  );
};

export default UnifiedRenderer;
