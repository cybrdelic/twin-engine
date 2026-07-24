# Twin Engine

This repository has been replaced with the computational hardware, drone, path-tracing, digital-twin, and mechatronics code developed in the associated project.

## Source bundle

The complete browsable source tree is packaged in `twin-engine-source.tar.gz`.

Extract it from the repository root:

```bash
mkdir -p source
tar -xzf twin-engine-source.tar.gz -C source
```

The source bundle contains:

- AV-7 Swift drone structural and material/detail generators
- custom C++ CPU path tracer
- launch, convergence, and render tooling
- robotic-arm and camera-mount hardware generators
- reduced-order digital-twin dynamics, control, sensor, scenario, and test code
- unified mechatronics and shoulder-cartridge generators
- engineering documentation and compact manifests

Large PFM caches, rendered frame sequences, duplicated ZIP archives, generated videos, and known-invalid prototype outputs are intentionally excluded.

## Backup

The repository state that existed before this replacement is preserved on branch `backup/pre-conversation-overwrite`.

## Engineering boundary

This codebase contains research and engineering baselines, not certified production hardware.