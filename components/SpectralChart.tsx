
import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface PrimitiveKernelPlotProps {
  alpha: number; // 0=Tri, 1=Splat, 2=Point, 3=Voxel
}

const PrimitiveKernelPlot: React.FC<PrimitiveKernelPlotProps> = ({ alpha }) => {
  const data = useMemo(() => {
    const points = [];
    // x from -1.5 to 1.5
    for (let x = -1.5; x <= 1.5; x += 0.05) {
      let density = 0;
      const absX = Math.abs(x);

      // Smoothstep-like easing function helper
      const smooth = (min: number, max: number, val: number) => {
          let t = Math.max(0, Math.min(1, (val - min) / (max - min)));
          return t * t * (3 - 2 * t);
      };

      // Matched logic to shader smoothsteps
      
      const tSplat = smooth(0.1, 0.9, alpha);
      const tPoint = smooth(1.1, 1.9, alpha);
      const tVoxel = smooth(2.1, 2.9, alpha);

      // Base Densities
      const triDensity = absX < 0.5 ? 1.0 : 0.0;
      const splatDensity = Math.exp(-4.0 * x * x);
      const pointDensity = Math.exp(-30.0 * x * x) * 1.5; // Taller peak for point
      const voxelDensity = absX < 0.8 ? 0.8 : 0.0; // Wider box for voxel

      // Blend
      let d = triDensity;
      d = d * (1 - tSplat) + splatDensity * tSplat;
      d = d * (1 - tPoint) + pointDensity * tPoint;
      d = d * (1 - tVoxel) + voxelDensity * tVoxel;
      
      points.push({
        x: x.toFixed(2),
        density: d,
      });
    }
    return points;
  }, [alpha]);

  return (
    <div className="w-full h-32 bg-black rounded border border-zinc-800 p-2 relative">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorDensity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
          <XAxis dataKey="x" hide />
          <YAxis hide domain={[0, 1.5]} />
          <ReferenceLine x={0} stroke="#444" strokeDasharray="3 3" />
          <Area 
            type="monotone" 
            dataKey="density" 
            stroke="#f97316" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorDensity)" 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PrimitiveKernelPlot;
