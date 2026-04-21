const MESH_SCALE_KEY = 'scene-mesh-scale-v1';
const PATH_NODE_KEY = 'scene-path-node-calibration-v1';

export function createSceneSettingsStore() {
  const meshScaleMap = loadMap(MESH_SCALE_KEY);
  const pathNodeMap = loadMap(PATH_NODE_KEY);

  return {
    getMeshScale(sceneFile) {
      const key = normalizeSceneKey(sceneFile);
      const value = meshScaleMap[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 1;
      }
      return clampMeshScale(value);
    },
    setMeshScale(sceneFile, value) {
      const key = normalizeSceneKey(sceneFile);
      meshScaleMap[key] = clampMeshScale(value);
      saveMap(MESH_SCALE_KEY, meshScaleMap);
    },
    getPathNodeOffsets(sceneFile) {
      const sceneKey = normalizeSceneKey(sceneFile);
      const raw = pathNodeMap[sceneKey];
      if (!Array.isArray(raw)) return null;
      return raw
        .filter((row) => Array.isArray(row) && row.length === 3)
        .map((row) => row.map((n) => Number(n) || 0));
    },
    setPathNodeOffsets(sceneFile, offsets) {
      const sceneKey = normalizeSceneKey(sceneFile);
      if (!Array.isArray(offsets)) return;
      pathNodeMap[sceneKey] = offsets
        .filter((row) => Array.isArray(row) && row.length === 3)
        .map((row) => row.map((n) => Number(n) || 0));
      saveMap(PATH_NODE_KEY, pathNodeMap);
    },
  };
}

function normalizeSceneKey(sceneFile) {
  return sceneFile || '__none__';
}

function clampMeshScale(scale) {
  return Math.min(1.3, Math.max(0.1, Number(scale) || 1));
}

function loadMap(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveMap(key, map) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore storage failures
  }
}
