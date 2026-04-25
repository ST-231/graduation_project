import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import { createMeshRuntime } from './runtime/meshRuntime.js';
import { alignMeshToContext, createMeshScaleController } from './runtime/meshPlacement.js';
import { ROBOT_RUNTIME_CONFIG } from './config/robotConfig.js';
import { getSceneTransform } from './config/sceneTransformConfig.js';
import { getSceneExperienceConfig } from './config/sceneExperienceConfig.js';
import { createSceneExperienceRuntime } from './runtime/sceneExperienceRuntime.js';
import { createFollowCameraController } from './controllers/followCameraController.js';

const ENABLE_SCENE_TRANSFORM_CORRECTION = true;

export function createHybridViewer() {
  let viewer = null;
  let threeScene = null;
  let meshRuntime = null;
  let meshScaleController = null;
  let sceneExperience = null;
  let followCameraController = null;

  let meshScaleMultiplier = 1;
  let animationRafId = null;
  let keydownAttached = false;
  let animationPaused = false;
  const followTargetOffset = new THREE.Vector3(0, 0, 0);
  const clock = new THREE.Clock();

  return {
    async load({ sceneFile, sceneUrl, sceneExt, meshUrl, meshScaleMultiplier: initialMeshScale = 1, pathNodeOverrides = null }) {
      meshScaleMultiplier = clamp(initialMeshScale, 0.1, 1.3);
      meshRuntime = createMeshRuntime(ROBOT_RUNTIME_CONFIG);

      threeScene = new THREE.Scene();
      addLights(threeScene);

      let meshRoot = null;
      if (meshUrl) {
        const meshData = await meshRuntime.load(meshUrl);
        meshRoot = meshData.root;
      }

      viewer = new GaussianSplats3D.Viewer({
        cameraUp: [0, 1, 0],
        initialCameraPosition: [0, 1, 3],
        initialCameraLookAt: [0, 0, 0],
        useBuiltInControls: false,
        threeScene,
      });

      if (sceneUrl) {
        const sceneTransform = ENABLE_SCENE_TRANSFORM_CORRECTION
          ? resolveSceneTransform(getSceneTransform(sceneFile))
          : {};
        await viewer.addSplatScene(sceneUrl, {
          format: toSceneFormat(sceneExt),
          ...sceneTransform,
        });
      }

      if (meshRoot) {
        const experienceConfig = getSceneExperienceConfig(sceneFile);
        alignMeshToContext({ viewer, meshRoot, hasSplatScene: Boolean(sceneUrl) });
        meshScaleController = createMeshScaleController(meshRoot);
        meshScaleController.applyMultiplier(meshScaleMultiplier);
        threeScene.add(meshRoot);

        meshRuntime.setFloatingBaseY(meshRoot.position.y);
        attachKeydownListener();

        if (experienceConfig) {
          sceneExperience = createSceneExperienceRuntime({
            sceneFile,
            config: experienceConfig,
            viewer,
            threeScene,
            meshRuntime,
            pathNodeOverrides,
          });
        }

        const followCfg = experienceConfig?.followCamera || {};
        followTargetOffset.copy(readVec3(followCfg.targetOffset));
        if (followCfg.enabled !== false) {
          followCameraController = createFollowCameraController({
            camera: viewer.camera,
            domElement: viewer.renderer?.domElement,
            getTarget: (out) => {
              if (sceneExperience?.getCameraTarget) {
                sceneExperience.getCameraTarget(out);
              } else {
                out.set(meshRoot.position.x, meshRoot.position.y, meshRoot.position.z);
              }
              out.add(followTargetOffset);
              return out;
            },
            initialDistance: Number(followCfg.distance) || undefined,
            minDistance: Number(followCfg.minDistance) || undefined,
            maxDistance: Number(followCfg.maxDistance) || undefined,
            smoothFactor: Number(followCfg.smooth) || undefined,
            minPolar: Number.isFinite(followCfg.maxPitchDeg)
              ? THREE.MathUtils.degToRad(90 - Number(followCfg.maxPitchDeg))
              : undefined,
            maxPolar: Number.isFinite(followCfg.minPitchDeg)
              ? THREE.MathUtils.degToRad(90 - Number(followCfg.minPitchDeg))
              : undefined,
          });
        }
      }

      startAnimationLoop();
      viewer.start();
    },

    resize(scale) {
      if (!viewer?.renderer) return;
      viewer.renderer.setPixelRatio(window.devicePixelRatio * scale);
      viewer.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    setMeshScaleMultiplier(scale) {
      meshScaleMultiplier = clamp(scale, 0.1, 1.3);
      if (!meshScaleController || !meshRuntime) return;

      meshScaleController.applyMultiplier(meshScaleMultiplier);
      const root = meshRuntime.getRoot();
      if (root) {
        meshRuntime.setFloatingBaseY(root.position.y);
      }
    },

    setAnimationClip(name) {
      return meshRuntime?.playClipByName(name) || false;
    },

    hasAnimations() {
      return meshRuntime?.hasAnimations() || false;
    },

    getPathNodeOffsets() {
      return sceneExperience?.getPathNodeOffsets?.() || null;
    },

    getPathNodeOffset(index) {
      return sceneExperience?.getPathNodeOffset?.(index) || null;
    },

    setPathNodeOffset(index, offset) {
      return sceneExperience?.setPathNodeOffset?.(index, offset) || false;
    },

    setAnimationPaused(paused) {
      const next = Boolean(paused);
      if (animationPaused && !next) {
        clock.getDelta();
      }
      animationPaused = next;
      meshRuntime?.setPaused(next);
    },

    dispose() {
      stopAnimationLoop();
      detachKeydownListener();

      meshRuntime?.dispose();
      meshRuntime = null;
      meshScaleController = null;
      sceneExperience?.dispose();
      sceneExperience = null;
      followCameraController?.dispose();
      followCameraController = null;

      if (viewer) {
        viewer.dispose();
        viewer = null;
      }

      threeScene = null;
    },
  };

  function startAnimationLoop() {
    stopAnimationLoop();
    clock.start();
    clock.getDelta();

    const tick = () => {
      animationRafId = requestAnimationFrame(tick);
      if (animationPaused || !meshRuntime) return;

      const delta = clock.getDelta();
      if (delta <= 0) return;
      meshRuntime.update(delta, clock.elapsedTime, viewer?.camera);
      sceneExperience?.update(delta, clock.elapsedTime, viewer?.camera);
      followCameraController?.update(delta);
    };

    tick();
  }

  function stopAnimationLoop() {
    if (!animationRafId) return;
    cancelAnimationFrame(animationRafId);
    animationRafId = null;
  }

  function handleInputCommand(cmd) {
    if (!meshRuntime || !cmd) return;
    if (sceneExperience && !sceneExperience.isInteractionEnabled()) {
      return;
    }
    if (cmd.type === 'clip') {
      meshRuntime.triggerAction(cmd.action);
      return;
    }
    if (cmd.type === 'expression') {
      meshRuntime.triggerAction(cmd.action);
    }
  }

  function onWindowKeyDown(event) {
    if (isTypingTarget(event)) return;
    if (sceneExperience?.handleKeyDown?.(event)) return;
    const cmd = ROBOT_RUNTIME_CONFIG.keymap?.[event.code];
    if (!cmd) return;
    handleInputCommand(cmd);
  }

  function attachKeydownListener() {
    if (keydownAttached) return;
    window.addEventListener('keydown', onWindowKeyDown);
    keydownAttached = true;
  }

  function detachKeydownListener() {
    if (!keydownAttached) return;
    window.removeEventListener('keydown', onWindowKeyDown);
    keydownAttached = false;
  }
}

function toSceneFormat(ext) {
  if (ext === 'splat') return GaussianSplats3D.SceneFormat.Splat;
  if (ext === 'ksplat') return GaussianSplats3D.SceneFormat.KSplat;
  return GaussianSplats3D.SceneFormat.Ply;
}

function addLights(scene) {
  const directional = new THREE.DirectionalLight(0xffffff, 1);
  directional.position.set(5, 8, 5);
  scene.add(directional);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readVec3(value) {
  if (!Array.isArray(value) || value.length !== 3) {
    return new THREE.Vector3(0, 0, 0);
  }
  return new THREE.Vector3(
    Number(value[0]) || 0,
    Number(value[1]) || 0,
    Number(value[2]) || 0
  );
}

function isTypingTarget(event) {
  const tag = event.target?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;
}

function resolveSceneTransform(raw) {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const resolved = {};
  if (Array.isArray(raw.position)) {
    resolved.position = [...raw.position];
  }
  if (Array.isArray(raw.scale)) {
    resolved.scale = [...raw.scale];
  }

  if (Array.isArray(raw.rotation) && raw.rotation.length === 4) {
    resolved.rotation = [...raw.rotation];
    return resolved;
  }

  if (Array.isArray(raw.eulerDeg) && raw.eulerDeg.length === 3) {
    const [xDeg, yDeg, zDeg] = raw.eulerDeg;
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(xDeg),
        THREE.MathUtils.degToRad(yDeg),
        THREE.MathUtils.degToRad(zDeg),
        'XYZ'
      )
    );
    resolved.rotation = [q.x, q.y, q.z, q.w];
  }

  return resolved;
}
