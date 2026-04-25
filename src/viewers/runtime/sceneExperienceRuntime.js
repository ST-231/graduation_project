import * as THREE from 'three';
import { createPathGuidanceVisuals } from '../visuals/pathGuidanceVisuals.js';
import { createRobotBillboard } from '../visuals/robotBillboard.js';

export function createSceneExperienceRuntime({
  sceneFile,
  config,
  viewer,
  threeScene,
  meshRuntime,
  pathNodeOverrides,
}) {
  if (!config || !viewer || !threeScene || !meshRuntime) return null;

  const root = meshRuntime.getRoot();
  if (!root) return null;

  const unit = estimateSceneUnit(viewer);
  const domElement = viewer?.renderer?.domElement;
  const baseRobotScale = Math.max(1e-6, getAverageScale(root));
  const group = new THREE.Group();
  group.name = 'scene-experience-runtime';
  threeScene.add(group);

  const anchor = root.position.clone().add(offsetToVector(config.spawnOffset, unit));
  root.position.copy(anchor);
  meshRuntime.setFloatingBaseY(root.position.y);

  applyCameraPreset(viewer, anchor, config.camera, unit);

  const billboard = createRobotBillboard({
    root,
    threeScene,
    config: config.robotBillboard,
  });

  const baseNodeOffsets = buildNodeOffsets(config.pathNodes, pathNodeOverrides);
  const nodes = toWorldNodes(baseNodeOffsets, anchor, unit);
  const robotYOffsetBase = Math.max(0, Number(config.robotPathYOffset) || 0) * unit;
  if (nodes.length < 2) {
    billboard?.setText('Ready');
    return {
      update(_delta, _elapsedTime, camera) {
        const activeCamera = camera || viewer?.camera;
        const ratio = clamp(getAverageScale(root) / baseRobotScale, 0.2, 5);
        billboard?.update(activeCamera, ratio);
      },
      handleKeyDown() {
        return false;
      },
      dispose() {
        billboard?.dispose();
        threeScene.remove(group);
      },
      isInteractionEnabled() {
        return true;
      },
    };
  }

  // Spawn above waypoint to avoid anchor occluding the robot.
  root.position.copy(nodes[0].world).add(new THREE.Vector3(0, getRobotYOffset(), 0));
  meshRuntime.setFloatingBaseY(root.position.y);

  const visuals = createPathGuidanceVisuals({
    nodes,
    visual: config.pathVisual,
    unit,
  });
  group.add(visuals.group);

  let currentNodeIndex = 0;
  let targetNodeIndex = null;
  let interactionEnabled = true;
  let moving = false;
  let followY = nodes[0].world.y;
  billboard?.setText(`At point${currentNodeIndex + 1}`);

  const moveSpeed = Math.max(0.2, Number(config.moveSpeed) || 1) * unit;
  const nodeHotkeys = Array.isArray(config.nodeHotkeys) ? config.nodeHotkeys : ['F1', 'F2', 'F3', 'F4'];

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const onPointerDown = (event) => {
    if (!viewer?.renderer || !viewer?.camera) return;
    const rect = viewer.renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, viewer.camera);
    const hits = raycaster.intersectObjects(visuals.getSelectableObjects(), false);
    if (!hits.length) return;
    startMoveToNode(hits[0].object.userData.nodeIndex);
  };

  const handleKeyDown = (event) => {
    const idx = nodeHotkeys.indexOf(event.code);
    if (idx < 0) return false;
    event.preventDefault();
    startMoveToNode(idx);
    return true;
  };

  domElement?.addEventListener('pointerdown', onPointerDown);

  return {
    update(delta, elapsedTime = 0, camera) {
      const activeCamera = camera || viewer?.camera;
      const visualScale = clamp(getAverageScale(root) / baseRobotScale, 0.2, 5);
      visuals.setScaleRatio?.(visualScale);
      visuals.update(elapsedTime, activeCamera);
      billboard?.update(activeCamera, visualScale);

      if (targetNodeIndex == null) return;
      const target = nodes[targetNodeIndex].world.clone().add(new THREE.Vector3(0, getRobotYOffset(), 0));
      const current = root.position;
      const dir = target.clone().sub(current);
      const distance = dir.length();

      if (distance < 0.0001) {
        finalizeArrival(targetNodeIndex);
        return;
      }

      dir.normalize();
      const step = Math.min(distance, moveSpeed * delta);
      root.position.addScaledVector(dir, step);

      const planar = Math.hypot(dir.x, dir.z);
      if (planar > 1e-5) {
        const targetYaw = Math.atan2(dir.x, dir.z);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetYaw);
        root.quaternion.slerp(q, Math.min(1, delta * 8));
      }

      meshRuntime.setFloatingBaseY(root.position.y);
      followY = root.position.y;

      if (step >= distance - 1e-4) {
        finalizeArrival(targetNodeIndex);
      }
    },

    isInteractionEnabled() {
      return interactionEnabled;
    },

    handleKeyDown,

    getCameraTarget(out = new THREE.Vector3()) {
      out.set(root.position.x, followY, root.position.z);
      return out;
    },

    getPathNodeOffsets() {
      return baseNodeOffsets.map((o) => [...o]);
    },

    getPathNodeOffset(index) {
      const offset = baseNodeOffsets[index];
      return offset ? [...offset] : null;
    },

    setPathNodeOffset(index, offset) {
      if (!nodes[index] || !isVec3(offset)) return false;
      const normalized = [Number(offset[0]) || 0, Number(offset[1]) || 0, Number(offset[2]) || 0];
      baseNodeOffsets[index] = normalized;
      applyLayout();

      if (index === 0 && !moving) {
        root.position.copy(nodes[0].world).add(new THREE.Vector3(0, getRobotYOffset(), 0));
        meshRuntime.setFloatingBaseY(root.position.y);
        followY = root.position.y;
      }

      if (targetNodeIndex === index) {
        targetNodeIndex = null;
        moving = false;
      }
      return true;
    },

    dispose() {
      domElement?.removeEventListener('pointerdown', onPointerDown);
      visuals.dispose();
      billboard?.dispose();
      threeScene.remove(group);
    },
  };

  function startMoveToNode(index) {
    if (typeof index !== 'number') return;
    if (index < 0 || index >= nodes.length) return;
    if (index === currentNodeIndex && !moving) return;
    enterMovingState(index);
  }

  function finalizeArrival(index) {
    const target = nodes[index].world.clone().add(new THREE.Vector3(0, getRobotYOffset(), 0));
    root.position.copy(target);
    meshRuntime.setFloatingBaseY(root.position.y);
    followY = root.position.y;

    enterInteractiveState(index);
  }

  function enterMovingState(nextTargetIndex) {
    targetNodeIndex = nextTargetIndex;
    moving = true;
    interactionEnabled = false;
    meshRuntime.setFaceCameraEnabled(false);
    meshRuntime.triggerAction('idle');
    meshRuntime.triggerAction('neutral');
    billboard?.setText(`Moving to point${nextTargetIndex + 1}`);
  }

  function enterInteractiveState(arrivedNodeIndex) {
    currentNodeIndex = arrivedNodeIndex;
    targetNodeIndex = null;
    moving = false;
    interactionEnabled = true;
    meshRuntime.setFaceCameraEnabled(true);
    billboard?.setText(`At point${arrivedNodeIndex + 1}`);
  }

  function getRobotYOffset() {
    return robotYOffsetBase;
  }

  function applyLayout() {
    for (let i = 0; i < nodes.length; i += 1) {
      nodes[i].offset = [...baseNodeOffsets[i]];
      nodes[i].world.copy(anchor).add(offsetToVector(baseNodeOffsets[i], unit));
    }
    visuals.refresh(nodes);

    if (!moving) {
      const idx = clamp(currentNodeIndex, 0, nodes.length - 1);
      root.position.copy(nodes[idx].world).add(new THREE.Vector3(0, getRobotYOffset(), 0));
      meshRuntime.setFloatingBaseY(root.position.y);
      followY = root.position.y;
    }
  }
}

function estimateSceneUnit(viewer) {
  const splatMesh = viewer.getSplatMesh?.();
  const splatBox = splatMesh?.boundingBox?.clone?.();
  if (!splatBox || splatBox.isEmpty()) return 1;
  const size = splatBox.getSize(new THREE.Vector3());
  const footprint = Math.max(Math.min(size.x, size.z), 1);
  return footprint * 0.11;
}

function applyCameraPreset(viewer, anchor, cameraCfg, unit) {
  const camera = viewer?.camera;
  if (!camera || !cameraCfg) return;
  const pos = offsetToVector(cameraCfg.position, unit).add(anchor);
  const lookAt = offsetToVector(cameraCfg.lookAt, unit).add(anchor);
  camera.position.copy(pos);
  camera.lookAt(lookAt);
}

function buildNodeOffsets(baseNodes, overrides) {
  const base = Array.isArray(baseNodes) ? baseNodes : [];
  const offsets = base.map((offset) => [Number(offset?.[0]) || 0, Number(offset?.[1]) || 0, Number(offset?.[2]) || 0]);
  if (!Array.isArray(overrides)) return offsets;
  const len = Math.min(offsets.length, overrides.length);
  for (let i = 0; i < len; i += 1) {
    if (!isVec3(overrides[i])) continue;
    offsets[i] = [Number(overrides[i][0]) || 0, Number(overrides[i][1]) || 0, Number(overrides[i][2]) || 0];
  }
  return offsets;
}

function toWorldNodes(offsets, anchor, unit) {
  return offsets.map((offset, index) => ({
    index,
    offset: [...offset],
    world: anchor.clone().add(offsetToVector(offset, unit)),
  }));
}

function offsetToVector(offset, unit) {
  const arr = Array.isArray(offset) ? offset : [0, 0, 0];
  return new THREE.Vector3(
    (Number(arr[0]) || 0) * unit,
    (Number(arr[1]) || 0) * unit,
    (Number(arr[2]) || 0) * unit
  );
}

function isVec3(value) {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function getAverageScale(obj) {
  const sx = Math.abs(Number(obj?.scale?.x) || 1);
  const sy = Math.abs(Number(obj?.scale?.y) || 1);
  const sz = Math.abs(Number(obj?.scale?.z) || 1);
  return (sx + sy + sz) / 3;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
