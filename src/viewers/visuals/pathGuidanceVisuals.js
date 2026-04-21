import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import helvetikerJson from 'three/examples/fonts/helvetiker_regular.typeface.json';

export function createPathGuidanceVisuals({ nodes, visual = {}, unit = 1 }) {
  const font = new FontLoader().parse(helvetikerJson);
  const group = new THREE.Group();
  group.name = 'path-guidance-visuals';

  const anchorColor = visual.anchorColor ?? 0x66eaff;
  const anchorAccentColor = visual.anchorGlowColor ?? 0xb6f7ff;
  const labelColor = visual.labelColor ?? '#d8fbff';
  const useAbsoluteSizes = visual.useAbsoluteSizes === true;
  const anchorRadius = useAbsoluteSizes
    ? Math.max(0.001, Number(visual.anchorRadius) || 0.065)
    : Math.max(0.022, (Number(visual.anchorRadius) || 0.065) * unit);
  const bobAmp = useAbsoluteSizes
    ? Math.max(0.0005, Number(visual.anchorBobAmp) || 0.035)
    : Math.max(0.01, (Number(visual.anchorBobAmp) || 0.035) * unit);
  const bobSpeed = Math.max(0.2, Number(visual.anchorBobSpeed) || 1.9);
  const labelYOffset = useAbsoluteSizes
    ? (Number(visual.labelYOffset) || -0.44)
    : (Number(visual.labelYOffset) || -0.44) * unit;
  const labelXOffset = useAbsoluteSizes
    ? (Number(visual.labelXOffset) || 0.0)
    : (Number(visual.labelXOffset) || 0.0) * unit;
  const trailColor = visual.trailColor ?? visual.dotColor ?? anchorColor;
  const trailRadius = useAbsoluteSizes
    ? Math.max(0.0002, Number(visual.trailRadius) || 0.0035)
    : Math.max(0.0012, (Number(visual.trailRadius) || 0.0035) * unit);
  const labelSizeAbs = Number(visual.labelSizeAbs) > 0 ? Number(visual.labelSizeAbs) : null;

  const anchors = [];
  const labels = [];
  let trailMesh = null;
  let scaleRatio = 1;
  let currentNodes = nodes;
  for (const node of nodes) {
    const anchor = createAnchorMesh({
      index: node.index,
      position: node.world,
      radius: anchorRadius,
      color: anchorColor,
      accentColor: anchorAccentColor,
      bobAmp,
      bobSpeed,
    });
    anchors.push(anchor);
    group.add(anchor.root);

    const label = createLabelMesh({
      font,
      text: `point${node.index + 1}`,
      color: new THREE.Color(labelColor),
      size: labelSizeAbs || (useAbsoluteSizes ? 0.05 : Math.max(0.05, unit * 0.07)),
      depth: useAbsoluteSizes ? 0.006 : Math.max(0.006, unit * 0.01),
    });
    label.position.copy(node.world).add(new THREE.Vector3(labelXOffset, labelYOffset, 0));
    label.userData.nodeIndex = node.index;
    label.userData.yOffset = labelYOffset;
    label.userData.xOffset = labelXOffset;
    labels.push(label);
    group.add(label);
  }

  rebuildGuideElements(nodes);
  applyVisualScale(1);
  return {
    group,
    getSelectableObjects() {
      return anchors.map((a) => a.pick);
    },
    update(elapsedTime, camera) {
      for (const anchor of anchors) {
        const y = anchor.base.y + Math.sin(elapsedTime * anchor.speed + anchor.phase) * anchor.amp;
        anchor.root.position.set(anchor.base.x, y, anchor.base.z);
        anchor.core.material.emissiveIntensity = 0.78 + 0.22 * Math.sin(elapsedTime * 3.0 + anchor.phase);
        anchor.accent.material.emissiveIntensity = 0.95 + 0.28 * Math.sin(elapsedTime * 3.7 + anchor.phase);
      }

      if (trailMesh) {
        trailMesh.material.emissiveIntensity = 0.45 + 0.18 * Math.sin(elapsedTime * 2.1);
      }

      if (camera) {
        for (const label of labels) {
          label.quaternion.copy(camera.quaternion);
        }
      }
    },
    setScaleRatio(nextRatio) {
      const normalized = clamp(nextRatio, 0.2, 5);
      if (Math.abs(normalized - scaleRatio) < 1e-4) return;
      scaleRatio = normalized;
      applyVisualScale(scaleRatio);
    },
    refresh(nodesNext) {
      currentNodes = nodesNext;
      for (const anchor of anchors) {
        const node = nodesNext[anchor.index];
        if (!node) continue;
        anchor.base.copy(node.world);
        anchor.root.position.copy(node.world);
      }

      for (const label of labels) {
        const idx = label.userData.nodeIndex;
        const node = nodesNext[idx];
        if (!node) continue;
        label.position.copy(node.world).add(new THREE.Vector3(label.userData.xOffset * scaleRatio, label.userData.yOffset * scaleRatio, 0));
      }

      rebuildGuideElements(nodesNext);
    },
    dispose() {
      disposeGroup(group);
    },
  };

  function rebuildGuideElements(sourceNodes) {
    const curvePoints = sourceNodes.map((n) => n.world.clone());
    if (trailMesh) {
      group.remove(trailMesh);
      trailMesh.geometry.dispose();
      trailMesh.material.dispose();
      trailMesh = null;
    }
    const trailCurve = new THREE.CatmullRomCurve3(curvePoints);
    const trailGeo = new THREE.TubeGeometry(trailCurve, Math.max(24, sourceNodes.length * 20), trailRadius, 6, false);
    const trailMat = new THREE.MeshStandardMaterial({
      color: trailColor,
      emissive: trailColor,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.0,
      depthTest: true,
      depthWrite: true,
    });
    trailMesh = new THREE.Mesh(trailGeo, trailMat);
    group.add(trailMesh);
  }

  function applyVisualScale(ratio) {
    for (const anchor of anchors) {
      anchor.core.scale.copy(anchor.coreBaseScale).multiplyScalar(ratio);
      anchor.accent.scale.copy(anchor.accentBaseScale).multiplyScalar(ratio);
    }
    for (const label of labels) {
      const idx = label.userData.nodeIndex;
      const node = currentNodes[idx];
      if (!node) continue;
      label.scale.setScalar(ratio);
      label.position.copy(node.world).add(new THREE.Vector3(label.userData.xOffset * ratio, label.userData.yOffset * ratio, 0));
    }
  }

}

function createAnchorMesh({ index, position, radius, color, accentColor, bobAmp, bobSpeed }) {
  const root = new THREE.Group();
  root.position.copy(position);

  const coreGeo = new THREE.OctahedronGeometry(radius, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.85,
    roughness: 0.24,
    metalness: 0.1,
    depthTest: true,
    depthWrite: true,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.scale.set(0.92, 1.35, 0.92);
  core.userData.nodeIndex = index;
  root.add(core);

  const accentGeo = new THREE.OctahedronGeometry(radius * 1.28, 0);
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.05,
    roughness: 0.3,
    metalness: 0.0,
    depthTest: true,
    depthWrite: true,
  });
  const accent = new THREE.Mesh(accentGeo, accentMat);
  accent.scale.set(0.88, 1.02, 0.88);
  root.add(accent);

  return {
    index,
    root,
    pick: core,
    core,
    accent,
    coreBaseScale: core.scale.clone(),
    accentBaseScale: accent.scale.clone(),
    base: position.clone(),
    phase: Math.random() * Math.PI * 2,
    amp: bobAmp,
    speed: bobSpeed,
  };
}

function createLabelMesh({ font, text, color, size, depth }) {
  const textGeo = new TextGeometry(text, {
    font,
    size,
    depth: Math.max(depth, size * 0.32),
    curveSegments: 10,
    bevelEnabled: true,
    bevelThickness: size * 0.06,
    bevelSize: size * 0.028,
    bevelOffset: 0,
    bevelSegments: 3,
  });
  textGeo.computeBoundingBox();
  if (textGeo.boundingBox) {
    const box = textGeo.boundingBox;
    const centerX = (box.max.x + box.min.x) * 0.5;
    const centerY = (box.max.y + box.min.y) * 0.5;
    textGeo.translate(-centerX, -centerY, 0);
  }

  const textMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.32),
    emissiveIntensity: 0.48,
    roughness: 0.42,
    metalness: 0.06,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(textGeo, textMat);
  return mesh;
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (!obj.material) return;
    if (Array.isArray(obj.material)) {
      for (const mat of obj.material) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
      return;
    }
    if (obj.material.map) obj.material.map.dispose();
    obj.material.dispose();
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
