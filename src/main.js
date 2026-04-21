import { createControlPanel } from './ui.js';
import { createFPSMeter } from './fpsMeter.js';
import { createHybridViewer } from './viewers/hybridViewer.js';
import { createSceneSettingsStore } from './viewers/store/sceneSettingsStore.js';

const SCENE_MODELS = discoverModelsFromModules(
  import.meta.glob('/public/3dgs/*', { eager: true, query: '?url', import: 'default' }),
  ['ply', 'splat', 'ksplat']
);
const MESH_MODELS = discoverModelsFromModules(
  import.meta.glob('/public/mesh/*', { eager: true, query: '?url', import: 'default' }),
  ['glb', 'gltf']
);

let viewer = null;
let pixelRatioScale = 1;
let meshScaleMultiplier = 1;
let loadedSceneFile = null;
const sceneSettingsStore = createSceneSettingsStore();

const ui = createControlPanel({
  sceneOptions: SCENE_MODELS,
  meshOptions: MESH_MODELS,
  onApplySelection: handleApplySelection,
  onResolutionChange: handleResolutionChange,
  onSceneChange: handleSceneChange,
  onMeshScaleChange: handleMeshScaleChange,
  onPathNodeIndexChange: handlePathNodeIndexChange,
  onPathNodeOffsetChange: handlePathNodeOffsetChange,
});

const fpsMeter = createFPSMeter({
  onFps: (fps) => ui.setFPS(fps),
});

setDefaultInfo();
ui.updateActualPixels(pixelRatioScale);
ui.updateMeshScale(meshScaleMultiplier);

window.addEventListener('resize', () => {
  ui.updateActualPixels(pixelRatioScale);
  if (viewer) {
    viewer.resize(pixelRatioScale);
  }
});

async function handleApplySelection({ sceneFile, meshFile }) {
  ui.setLoadTime(null);
  ui.setFPS(null);
  ui.setInfo('Loading...');
  fpsMeter.stop();

  if (!sceneFile && !meshFile) {
    ui.setInfo('Please select at least one model.');
    return;
  }

  disposeViewer();
  viewer = createHybridViewer();

  loadedSceneFile = sceneFile || null;
  meshScaleMultiplier = getSceneMeshScale(sceneFile);
  ui.updateMeshScale(meshScaleMultiplier);

  const loadStart = performance.now();
  try {
    const sceneExt = sceneFile ? getExt(sceneFile) : null;
    const pathNodeOverrides = getScenePathNodeOverrides(sceneFile);
    await viewer.load({
      sceneFile,
      sceneUrl: sceneFile ? `/3dgs/${sceneFile}` : null,
      sceneExt,
      meshUrl: meshFile ? `/mesh/${meshFile}` : null,
      meshScaleMultiplier,
      pathNodeOverrides,
    });

    syncPathNodeEditorState();

    viewer.resize(pixelRatioScale);
    const loadSeconds = ((performance.now() - loadStart) / 1000).toFixed(2);
    ui.setLoadTime(loadSeconds);
    ui.setInfo(`3DGS: ${sceneFile || 'None'} | Mesh: ${meshFile || 'None'}`);
    fpsMeter.start();
  } catch (error) {
    disposeViewer();
    ui.setPathNodeEditor(0);
    ui.setInfo(`Load failed: ${error?.message || 'Unknown error'}`);
    console.error(error);
  }
}

function handleResolutionChange(ratio) {
  pixelRatioScale = ratio;
  ui.updateResolution(ratio);
  ui.updateActualPixels(ratio);

  if (viewer) {
    viewer.resize(ratio);
  }
}

function handleSceneChange(sceneFile) {
  const scale = getSceneMeshScale(sceneFile);
  meshScaleMultiplier = scale;
  ui.updateMeshScale(scale);
}

function handleMeshScaleChange({ scale, sceneFile }) {
  meshScaleMultiplier = scale;
  setSceneMeshScale(sceneFile, scale);

  if (viewer && normalizeSceneKey(sceneFile) === normalizeSceneKey(loadedSceneFile)) {
    viewer.setMeshScaleMultiplier(scale);
  }
}

function disposeViewer() {
  if (!viewer) return;
  viewer.dispose();
  viewer = null;
  loadedSceneFile = null;
  ui.setPathNodeEditor(0);
}

function setDefaultInfo() {
  ui.setInfo('Select one 3DGS and one Mesh model, then click Load.');
  ui.setLoadTime(null);
  ui.setFPS(null);
}

function getExt(file) {
  return file.split('.').pop()?.toLowerCase() || '';
}

function discoverModelsFromModules(modules, allowedExts) {
  const allow = new Set(allowedExts.map((ext) => ext.toLowerCase()));

  return Object.keys(modules)
    .map((fullPath) => fullPath.split('/').pop())
    .filter((name) => allow.has(getExt(name)))
    .sort((a, b) => a.localeCompare(b));
}

function normalizeSceneKey(sceneFile) {
  return sceneFile || '__none__';
}

function getSceneMeshScale(sceneFile) {
  return sceneSettingsStore.getMeshScale(sceneFile);
}

function setSceneMeshScale(sceneFile, value) {
  sceneSettingsStore.setMeshScale(sceneFile, value);
}

function handlePathNodeIndexChange({ sceneFile, nodeIndex }) {
  if (!viewer) return;
  if (normalizeSceneKey(sceneFile) !== normalizeSceneKey(loadedSceneFile)) return;
  const offset = viewer.getPathNodeOffset?.(nodeIndex);
  if (!offset) return;
  ui.setPathNodeOffset(offset);
}

function handlePathNodeOffsetChange({ sceneFile, nodeIndex, offset }) {
  if (!viewer) return;
  if (normalizeSceneKey(sceneFile) !== normalizeSceneKey(loadedSceneFile)) return;
  const ok = viewer.setPathNodeOffset?.(nodeIndex, offset);
  if (!ok) return;

  const all = viewer.getPathNodeOffsets?.();
  if (!all || !Array.isArray(all)) return;
  setScenePathNodeOverrides(sceneFile, all);
}

function syncPathNodeEditorState() {
  if (!viewer) {
    ui.setPathNodeEditor(0);
    return;
  }
  const offsets = viewer.getPathNodeOffsets?.();
  if (!offsets || !offsets.length) {
    ui.setPathNodeEditor(0);
    return;
  }
  ui.setPathNodeEditor(offsets.length);
  ui.setPathNodeOffset(offsets[0]);
}

function getScenePathNodeOverrides(sceneFile) {
  return sceneSettingsStore.getPathNodeOffsets(sceneFile);
}

function setScenePathNodeOverrides(sceneFile, value) {
  sceneSettingsStore.setPathNodeOffsets(sceneFile, value);
}
