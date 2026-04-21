import * as THREE from 'three';

export function alignMeshToContext({ viewer, meshRoot, hasSplatScene }) {
  if (hasSplatScene) {
    alignMeshToSplatScene(viewer, meshRoot);
    return;
  }

  normalizeMeshStandalone(meshRoot);
}

export function createMeshScaleController(meshRoot) {
  const baseScale = meshRoot.scale.clone();
  const basePosition = meshRoot.position.clone();
  const baseBox = new THREE.Box3().setFromObject(meshRoot);

  return {
    applyMultiplier(multiplier) {
      if (baseBox.isEmpty()) {
        return;
      }

      const scale = clamp(multiplier, 0.1, 1.3);
      meshRoot.scale.copy(baseScale).multiplyScalar(scale);
      meshRoot.position.copy(basePosition);

      const box = new THREE.Box3().setFromObject(meshRoot);
      if (box.isEmpty()) {
        return;
      }

      const baseCenter = baseBox.getCenter(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      meshRoot.position.x += baseCenter.x - center.x;
      meshRoot.position.z += baseCenter.z - center.z;
      meshRoot.position.y += baseBox.min.y - box.min.y;
    },
  };
}

function normalizeMeshStandalone(root) {
  fitMeshToTarget(root, 1.5);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const minY = box.min.y;
  root.position.sub(center);
  root.position.y += -minY + 0.1;
}

function alignMeshToSplatScene(viewer, meshRoot) {
  const splatMesh = viewer.getSplatMesh?.();
  const splatBox = splatMesh?.boundingBox?.clone?.();
  const sceneCenter = new THREE.Vector3();

  if (splatBox && !splatBox.isEmpty()) {
    splatBox.getCenter(sceneCenter);
    const splatSize = splatBox.getSize(new THREE.Vector3());
    const sceneHeight = Math.max(splatSize.y, 0.1);
    const sceneFootprint = Math.max(Math.min(splatSize.x, splatSize.z), 0.1);

    const byHeight = sceneHeight * 0.16;
    const byFootprint = sceneFootprint * 0.045;
    const targetMeshSize = clamp(Math.min(byHeight, byFootprint), 0.35, 1.2);
    fitMeshToTarget(meshRoot, targetMeshSize);

    const meshBox = new THREE.Box3().setFromObject(meshRoot);
    const meshCenter = meshBox.getCenter(new THREE.Vector3());
    const yOffset = splatBox.min.y - meshBox.min.y;

    meshRoot.position.add(sceneCenter.sub(meshCenter));
    meshRoot.position.y += yOffset + 0.03;
    return;
  }

  const splatScene = viewer.getSplatScene?.(0);
  const splatCenter = splatScene?.splatBuffer?.sceneCenter;
  if (splatCenter) {
    fitMeshToTarget(meshRoot, 1.2);
    const meshBox = new THREE.Box3().setFromObject(meshRoot);
    const meshCenter = meshBox.getCenter(new THREE.Vector3());
    meshRoot.position.add(new THREE.Vector3(splatCenter.x, splatCenter.y, splatCenter.z).sub(meshCenter));
    return;
  }

  normalizeMeshStandalone(meshRoot);
}

function fitMeshToTarget(root, targetMaxDim) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  root.scale.multiplyScalar(targetMaxDim / maxDim);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
