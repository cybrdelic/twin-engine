# Twin Engine Fabrication Inventions

Procedural engineering showcase created on `feature/fabrication-inventions`.

The project generates and animates three mechanically distinct systems:

- enclosed CoreXY additive-manufacturing cell
- compact CNC milling cell
- six-axis robotic assembly cell

The renderer is a deterministic multithreaded CPU Monte Carlo path tracer with analytic box, sphere, and cylinder intersections, multi-bounce transport, soft area lighting, metallic/rough materials, emissive indicators, and deterministic frame seeds.

Build:

```bash
cmake -S fabrication-inventions -B build/fabrication-inventions -DCMAKE_BUILD_TYPE=Release
cmake --build build/fabrication-inventions --config Release
./build/fabrication-inventions/twin_fabrication output
```

The executable writes a converged hero PPM and 48 animation frames for each invention. Encode the sequences with `scripts/encode.sh output`.

These are engineering visualization baselines, not certified production hardware designs.
