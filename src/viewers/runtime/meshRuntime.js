import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createExpressionOverlay } from '../visuals/expressionOverlay.js';
import { ROBOT_RUNTIME_CONFIG } from '../config/robotConfig.js';

export function createMeshRuntime(config = {}) {
  const runtimeConfig = {
    ...ROBOT_RUNTIME_CONFIG,
    ...config,
  };
  const expressionSet = new Set((runtimeConfig.expressions || []).map((name) => normalizeClipName(name)));
  const clipActionSet = new Set(Object.keys(runtimeConfig.clipAliases || {}).map((name) => normalizeClipName(name)));

  let root = null;
  let animations = [];
  let mixer = null;
  let actionsByName = new Map();
  let activeClipName = 'idle';
  let baseY = 0;
  let paused = false;
  let faceCameraEnabled = true;
  let expressionSystem = null;

  const rootWorld = new THREE.Vector3();
  const cameraWorld = new THREE.Vector3();
  const forwardQuat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  return {
    async load(url) {
      const loader = new GLTFLoader();
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
      });

      root = gltf.scene;
      animations = gltf.animations || [];
      prepareMeshForWeb(root);
      expressionSystem = createExpressionOverlay(root, { faceMeshName: runtimeConfig.faceMeshName });
      setupMixer();

      return {
        root,
        animations,
      };
    },

    getRoot() {
      return root;
    },

    setFloatingBaseY(y) {
      baseY = y;
    },

    hasAnimations() {
      return animations.length > 0;
    },

    setPaused(value) {
      paused = Boolean(value);
    },

    setFaceCameraEnabled(value) {
      faceCameraEnabled = Boolean(value);
    },

    setExpression(name) {
      return expressionSystem?.setExpression(name) || false;
    },

    playClipByName(name) {
      return playClip(name);
    },

    triggerAction(actionName) {
      const type = resolveActionType(actionName, expressionSet, clipActionSet);
      if (type === 'clip') {
        return playClipByAction(actionName);
      }
      if (type === 'expression') {
        return this.setExpression(actionName);
      }
      return false;
    },

    update(delta, elapsedTime, camera) {
      if (!root || paused) return;

      if (mixer) {
        mixer.update(delta);
      }

      applyGlobalFloat(elapsedTime);
      if (faceCameraEnabled) {
        faceCamera(camera, delta);
      }
      expressionSystem?.update(delta, elapsedTime);
    },

    dispose() {
      if (mixer) {
        mixer.stopAllAction();
        mixer = null;
      }

      expressionSystem?.dispose();
      expressionSystem = null;

      if (root) {
        disposeObject(root);
        root = null;
      }

      animations = [];
      actionsByName.clear();
      activeClipName = 'idle';
      baseY = 0;
      paused = false;
      faceCameraEnabled = true;
    },
  };

  function playClip(name) {
    if (!mixer || actionsByName.size === 0) {
      activeClipName = name || 'idle';
      return false;
    }

    const key = normalizeClipName(name);
    let nextAction = actionsByName.get(key);

    if (!nextAction && key) {
      for (const [k, action] of actionsByName.entries()) {
        if (k.includes(key)) {
          nextAction = action;
          break;
        }
      }
    }

    if (!nextAction) {
      return false;
    }

    for (const action of actionsByName.values()) {
      action.stop();
      action.enabled = false;
    }

    nextAction.reset();
    nextAction.enabled = true;
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.clampWhenFinished = false;
    nextAction.play();
    activeClipName = nextAction.getClip().name;
    return true;
  }

  function playClipByAction(actionName) {
    const aliases = runtimeConfig.clipAliases?.[actionName];
    if (!aliases || aliases.length === 0) {
      return playClip(actionName);
    }

    for (const alias of aliases) {
      if (playClip(alias)) {
        return true;
      }
    }
    return false;
  }

  function setupMixer() {
    actionsByName.clear();

    if (!root || animations.length === 0) {
      mixer = null;
      activeClipName = 'idle';
      return;
    }

    mixer = new THREE.AnimationMixer(root);
    for (const clip of animations) {
      actionsByName.set(normalizeClipName(clip.name), mixer.clipAction(clip));
    }

    playClip(findDefaultClipName(animations));
  }

  function applyGlobalFloat(elapsedTime) {
    const targetY = baseY + 0.045 * Math.sin(elapsedTime * 1.8);
    root.position.y = THREE.MathUtils.lerp(root.position.y, targetY, 0.2);
  }

  function faceCamera(camera, delta) {
    if (!camera) return;

    root.getWorldPosition(rootWorld);
    camera.getWorldPosition(cameraWorld);

    const dx = cameraWorld.x - rootWorld.x;
    const dz = cameraWorld.z - rootWorld.z;
    const planar = Math.hypot(dx, dz);
    if (planar < 0.0001) return;

    const yaw = Math.atan2(dx, dz);
    forwardQuat.setFromAxisAngle(up, yaw);

    const factor = Math.min(1, delta * 6);
    root.quaternion.slerp(forwardQuat, factor);
  }
}

function resolveActionType(actionName, expressionSet, clipActionSet) {
  const key = String(actionName || '').trim().toLowerCase();
  if (!key) return '';
  if (clipActionSet.has(key)) {
    return 'clip';
  }
  if (expressionSet.has(key)) {
    return 'expression';
  }
  return '';
}

function findDefaultClipName(clips) {
  const names = clips.map((clip) => clip.name || '');
  const idle = names.find((name) => normalizeClipName(name).includes('idle'));
  return idle || names[0] || 'idle';
}

function normalizeClipName(name) {
  return String(name || '').trim().toLowerCase();
}

function prepareMeshForWeb(root) {
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      mat.side = THREE.DoubleSide;
      mat.shadowSide = THREE.DoubleSide;

      if (mat.transparent) {
        mat.depthWrite = false;
        mat.alphaTest = Math.max(mat.alphaTest || 0, 0.02);
      }
    }
  });
}

function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) {
      obj.geometry.dispose();
    }

    if (!obj.material) return;
    if (Array.isArray(obj.material)) {
      for (const material of obj.material) {
        material.dispose();
      }
      return;
    }
    obj.material.dispose();
  });
}
