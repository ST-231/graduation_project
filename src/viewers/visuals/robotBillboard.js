import * as THREE from 'three';

export function createRobotBillboard({ root, threeScene, config = {} }) {
  if (!root || !threeScene || config.enabled === false) {
    return null;
  }

  const group = new THREE.Group();
  group.name = 'robot-status-billboard';
  threeScene.add(group);

  const width = clamp(Number(config.width) || 2.1, 0.1, 20);
  const height = clamp(Number(config.height) || 0.9, 0.08, 20);
  const yOffset = clamp(Number(config.yOffset) || 0.62, 0.05, 8);
  const worldScale = clamp(Number(config.worldScale) || 0.1, 0.01, 5);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      emissive: new THREE.Color(0x244e59),
      emissiveIntensity: 0.25,
      roughness: 0.5,
      metalness: 0.0,
      transparent: false,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    })
  );
  group.add(panel);

  const border = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 1.03, height * 1.07),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.borderColor || '#6be9ff'),
      emissive: new THREE.Color(config.borderColor || '#6be9ff'),
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.0,
      transparent: false,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    })
  );
  border.position.z = -0.002;
  group.add(border);

  let text = '';
  const worldBox = new THREE.Box3();
  const toCamera = new THREE.Vector3();
  drawText('');

  return {
    setText(next) {
      const value = String(next || '');
      if (value === text) return;
      text = value;
      drawText(value);
    },
    update(camera, scaleRatio = 1) {
      const ratio = clamp(Number(scaleRatio) || 1, 0.2, 5);
      group.scale.setScalar(worldScale * ratio);

      worldBox.setFromObject(root);
      if (!worldBox.isEmpty()) {
        const centerX = (worldBox.min.x + worldBox.max.x) * 0.5;
        const centerZ = (worldBox.min.z + worldBox.max.z) * 0.5;
        const lift = Math.max(0.02, yOffset * ratio);
        group.position.set(centerX, worldBox.max.y + lift, centerZ);
      } else {
        const worldYOffset = Math.max(0.02, yOffset * ratio);
        group.position.set(root.position.x, root.position.y + worldYOffset, root.position.z);
      }

      if (camera) {
        toCamera.subVectors(camera.position, group.position);
        const lenSq = toCamera.lengthSq();
        if (lenSq > 1e-6) {
          toCamera.normalize();
          group.position.addScaledVector(toCamera, 0.08 * ratio);
        }
        group.quaternion.copy(camera.quaternion);
      }
    },
    dispose() {
      threeScene.remove(group);
      panel.geometry.dispose();
      panel.material.dispose();
      border.geometry.dispose();
      border.material.dispose();
      texture.dispose();
    },
  };

  function drawText(content) {
    if (!ctx) return;
    const bg = config.bgColor || '#1f7e8c';
    const fg = config.textColor || '#dff9ff';
    const fontSize = clamp(Number(config.textSizePx) || 44, 20, 96);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 36);
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.font = `700 ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.fillText(content || ' ', canvas.width * 0.5, canvas.height * 0.52);
    texture.needsUpdate = true;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
