# Project Structure

## Root
- `index.html`: page shell.
- `src/`: application source code.
- `public/3dgs`: splat scenes (`.ply/.ksplat`).
- `public/mesh`: mesh models (`.glb/.gltf`).
- `dist/`: build output.

## src
- `main.js`: app entry, model discovery, load flow, UI + viewer wiring.
- `ui.js`: control panel and calibration UI.
- `fpsMeter.js`: FPS sampling.
- `viewers/hybridViewer.js`: main viewer orchestrator (`3DGS + mesh + runtime update loop`).

### src/viewers/config
- `robotConfig.js`: clip/expression key mapping and face mesh config.
- `sceneTransformConfig.js`: per-scene transform correction.
- `sceneExperienceConfig.js`: per-scene path/experience config.

### src/viewers/controllers
- `followCameraController.js`: third-person follow camera controls.

### src/viewers/runtime
- `meshRuntime.js`: mesh loading, animation state, face tracking, update/dispose.
- `meshPlacement.js`: mesh-to-scene alignment + scaling.
- `sceneExperienceRuntime.js`: path movement state machine, node interaction gating.

### src/viewers/visuals
- `expressionOverlay.js`: procedural face expressions.
- `pathGuidanceVisuals.js`: anchor nodes, guide dots, point labels.

### src/viewers/store
- `sceneSettingsStore.js`: per-scene mesh scale + path node offset persistence.

## Generated / Local
- `node_modules/`: dependencies.
- `.tmp_ppt_parse/`: local temp files.
