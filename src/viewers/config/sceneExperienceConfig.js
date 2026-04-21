const BASE_EXPERIENCE_CONFIG = {
  camera: {
    position: [0.2, 1.45, 2.6],
    lookAt: [0, 1.0, 0],
  },
  followCamera: {
    enabled: true,
    targetOffset: [0, 0, 0],
    distance: 2.8,
    minDistance: 1.2,
    maxDistance: 4.2,
    minPitchDeg: -20,
    maxPitchDeg: 45,
    smooth: 8.0,
  },
  spawnOffset: [0, 0, 0],
  robotPathYOffset: 0.12,
  nodeHotkeys: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'],
  moveSpeed: 1.15,
  pathNodes: createLinearNodes(4, 2.1),
  pathVisual: {
    // Unified defaults: all path visuals share one base size set.
    // Then sceneExperienceRuntime applies one global scaleRatio from robot scale.
    useAbsoluteSizes: true,
    anchorColor: 0x66eaff,
    anchorGlowColor: 0xb6f7ff,
    anchorRadius: 0.05,
    anchorBobAmp: 0.03,
    anchorBobSpeed: 1.9,
    trailColor: 0x66eaff,
    trailRadius: 0.004,
    labelColor: '#008694',
    labelYOffset: -0.14,
    labelXOffset: 0.0,
    labelSizeAbs: 0.04,
  },
  robotBillboard: {
    enabled: true,
    yOffset: 0.08,
    worldScale: 0.1,
    width: 1.8,
    height: 1.0,
    bgColor: '#1f7e8c',
    borderColor: '#6be9ff',
    textColor: '#dff9ff',
    textSizePx: 60,
  },
};

export const SCENE_EXPERIENCE_CONFIG = {
  'street.ply': {
    pathNodes: createLinearNodes(4, 2.1),
  },
  'filming.ply': {
    pathNodes: createLinearNodes(5, 1.9),
  },
  'garden_high.ksplat': {
    pathNodes: createLinearNodes(6, 2.2),
  },
  'truck_high.ksplat': {
    pathNodes: createLinearNodes(5, 2.3),
  },
  'Garden.ply': {
    pathNodes: createLinearNodes(5, 2.0),
  },
  'LivingRoom.ply': {
    pathNodes: createLinearNodes(4, 1.7),
  },
};

export function getSceneExperienceConfig(sceneFile) {
  const key = String(sceneFile || '').trim();
  if (!key) return null;

  const scenePatch = SCENE_EXPERIENCE_CONFIG[key] || {};
  return mergeSceneConfig(BASE_EXPERIENCE_CONFIG, scenePatch);
}

function createLinearNodes(count, spacing) {
  const n = Math.max(2, Number(count) || 4);
  const step = Math.max(0.4, Number(spacing) || 2);
  const points = [];
  for (let i = 0; i < n; i += 1) {
    points.push([0, 0, -step * i]);
  }
  return points;
}

function mergeSceneConfig(base, patch) {
  return {
    ...base,
    ...patch,
    camera: { ...base.camera, ...(patch.camera || {}) },
    followCamera: { ...base.followCamera, ...(patch.followCamera || {}) },
    pathVisual: { ...base.pathVisual, ...(patch.pathVisual || {}) },
    robotBillboard: { ...base.robotBillboard, ...(patch.robotBillboard || {}) },
    nodeHotkeys: Array.isArray(patch.nodeHotkeys) ? patch.nodeHotkeys.slice() : base.nodeHotkeys.slice(),
    pathNodes: Array.isArray(patch.pathNodes) ? patch.pathNodes.map((p) => [...p]) : base.pathNodes.map((p) => [...p]),
  };
}
