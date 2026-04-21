const SCENE_TRANSFORMS = {
  'ArcViz Room.ply': { eulerDeg: [-15, -33, 0] },
  'truck_high.ksplat': { eulerDeg: [172, 0, 0] },
  'stump_high.ksplat': { eulerDeg: [141.6, 23.6, 0] },
  'point_cloud.ply': { eulerDeg: [-168, 0, 0] },
  'bonsai_high.ksplat': { eulerDeg: [135, 0, 0] },
  'CP Bus Stop.ply': { eulerDeg: [4, 0, 0] },
  'Forest Scan.ply': { eulerDeg: [4, 0, 0] },
  'garden_high.ksplat': { eulerDeg: [150.4, 0, 0] },
  'Garden.ply': { eulerDeg: [4.5, 37.4, 0] },
  'filming.ply': { eulerDeg: [180, 0, 0] },
  'street.ply': { eulerDeg: [174.9, 0, 0] },

  // Also supported:
  // 'example.ksplat': { rotation: [x, y, z, w] },
  // 'example.ksplat': { position: [x, y, z], scale: [sx, sy, sz] },
};

export function getSceneTransform(sceneFile) {
  const key = String(sceneFile || '').trim();
  if (!key) return {};

  const raw = SCENE_TRANSFORMS[key];
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const transform = {};
  if (isVec3(raw.position)) {
    transform.position = [...raw.position];
  }
  if (isQuat(raw.rotation)) {
    transform.rotation = [...raw.rotation];
  }
  if (isVec3(raw.eulerDeg)) {
    transform.eulerDeg = [...raw.eulerDeg];
  }
  if (isVec3(raw.scale)) {
    transform.scale = [...raw.scale];
  }
  return transform;
}

function isVec3(value) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function isQuat(value) {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}
