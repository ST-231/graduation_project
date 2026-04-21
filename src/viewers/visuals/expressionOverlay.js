import * as THREE from 'three';

export function createExpressionOverlay(root, options = {}) {
  const FACE_OFFSET_Y = 225;
  const FACE_SCALE_Y = 0.66;
  const EYE_RADIUS = 50;

  const faceMeshName = String(options.faceMeshName || 'jiqirenpSphere3').trim();
  const faceMesh = findFaceMeshByName(root, faceMeshName);
  if (!faceMesh || !faceMesh.material) {
    return null;
  }

  const material = Array.isArray(faceMesh.material) ? faceMesh.material[0] : faceMesh.material;
  if (!material) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  texture.center.set(0.5, 0.5);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.rotation = -Math.PI / 2;

  // Keep full UV coverage; avoid sampling clamp artifacts from repeat/offset hacks.
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);

  material.emissiveMap = texture;
  // Neutral emissive tint preserves the intended canvas color (e.g. pink hearts).
  material.emissive = new THREE.Color(0xffffff);
  material.emissiveIntensity = 0.95;
  material.needsUpdate = true;

  const state = {
    current: 'smile',
    blinkActive: false,
    blinkUntil: 0,
    nextBlinkAt: 2.2 + Math.random() * 2.5,
    lastRenderKey: '',
  };

  drawExpression('smile', 0);

  return {
    setExpression(name) {
      const key = normalizeExpressionName(name);
      if (!key) return false;
      state.current = key;
      state.lastRenderKey = '';
      return true;
    },

    update(_delta, elapsedTime) {
      if (state.current !== 'blink') {
        if (!state.blinkActive && elapsedTime >= state.nextBlinkAt) {
          state.blinkActive = true;
          state.blinkUntil = elapsedTime + 0.12;
        }
        if (state.blinkActive && elapsedTime >= state.blinkUntil) {
          state.blinkActive = false;
          state.nextBlinkAt = elapsedTime + 2.5 + Math.random() * 3.2;
        }
      } else {
        state.blinkActive = true;
      }

      const renderExpr = state.blinkActive ? 'blink' : state.current;
      const renderKey = renderExpr === 'glitch' ? `${renderExpr}:${Math.floor(elapsedTime * 22)}` : renderExpr;
      if (renderKey !== state.lastRenderKey) {
        drawExpression(renderExpr, elapsedTime);
        state.lastRenderKey = renderKey;
      }

      const pulse = 0.86 + 0.18 * Math.sin(elapsedTime * 3.4);
      material.emissiveIntensity = renderExpr === 'glitch' ? 1.15 + 0.25 * Math.sin(elapsedTime * 14) : pulse;
    },

    dispose() {
      texture.dispose();
    },
  };

  function drawExpression(type, elapsedTime = 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(ctx);

    ctx.save();
    ctx.translate(0, FACE_OFFSET_Y);
    ctx.scale(1, FACE_SCALE_Y);

    switch (type) {
      case 'neutral':
        drawNeutral(ctx, EYE_RADIUS);
        break;
      case 'blink':
        drawBlink(ctx);
        break;
      case 'heart':
        drawHeart(ctx);
        break;
      case 'glitch':
        drawGlitch(ctx, elapsedTime);
        break;
      case 'smile':
      default:
        drawSmile(ctx, EYE_RADIUS);
        break;
    }

    ctx.restore();
    texture.needsUpdate = true;
  }
}

function findFaceMeshByName(root, faceMeshName) {
  const target = faceMeshName.toLowerCase();
  let found = null;

  root.traverse((obj) => {
    if (found || !obj.isMesh) return;
    const raw = String(obj.name || '').toLowerCase();
    if (raw === target) {
      found = obj;
    }
  });

  return found;
}

function normalizeExpressionName(name) {
  const key = String(name || '').trim().toLowerCase();
  if (key === 'smile' || key === 'blink' || key === 'heart' || key === 'glitch' || key === 'neutral') {
    return key;
  }
  return '';
}

function drawBackground(ctx) {
  const g = ctx.createRadialGradient(256, 260, 40, 256, 260, 260);
  g.addColorStop(0, '#071521');
  g.addColorStop(1, '#02070f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
}

function neonStroke(ctx, color = '#78edff', width = 10) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
}

function drawNeutral(ctx, eyeRadius) {
  ctx.shadowColor = '#88e9ff';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#88e9ff';
  ctx.beginPath();
  ctx.arc(152, 224, eyeRadius, 0, Math.PI * 2);
  ctx.arc(360, 224, eyeRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawSmile(ctx, eyeRadius) {
  ctx.shadowColor = '#7cecff';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#7cecff';
  ctx.beginPath();
  ctx.arc(148, 216, eyeRadius - 6, 0, Math.PI * 2);
  ctx.arc(364, 216, eyeRadius - 6, 0, Math.PI * 2);
  ctx.fill();

  neonStroke(ctx, '#4bd8ff', 8);
  ctx.beginPath();
  ctx.arc(256, 302, 96, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawBlink(ctx) {
  neonStroke(ctx, '#8bedff', 10);
  ctx.beginPath();
  ctx.moveTo(108, 228);
  ctx.lineTo(196, 228);
  ctx.moveTo(316, 228);
  ctx.lineTo(404, 228);
  ctx.stroke();
}

function drawHeart(ctx) {
  // Match neutral-eye layout: same center line, larger and clearer heart shape.
  drawFilledHeart(ctx, 152, 242, 54, '#ff66b8');
  drawFilledHeart(ctx, 360, 242, 54, '#ff66b8');
}

function drawFilledHeart(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = color;
  ctx.beginPath();
  // Standard heart silhouette: pronounced top lobes + centered pointed bottom.
  ctx.moveTo(0, size * 0.98);
  ctx.bezierCurveTo(-size * 1.25, size * 0.30, -size * 1.15, -size * 0.78, -size * 0.36, -size * 0.78);
  ctx.bezierCurveTo(-size * 0.12, -size * 0.78, -size * 0.02, -size * 0.60, 0, -size * 0.46);
  ctx.bezierCurveTo(size * 0.02, -size * 0.60, size * 0.12, -size * 0.78, size * 0.36, -size * 0.78);
  ctx.bezierCurveTo(size * 1.15, -size * 0.78, size * 1.25, size * 0.30, 0, size * 0.98);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGlitch(ctx, elapsedTime) {
  const baselineY = 260;
  const left = 68;
  const right = 444;
  const width = right - left;
  const speed = 180;
  const phase = (elapsedTime * speed) % width;

  neonStroke(ctx, '#70f2ff', 6);
  ctx.beginPath();
  ctx.moveTo(left, baselineY);

  for (let x = left; x <= right; x += 5) {
    const local = (x - left + phase) % width;
    let y = baselineY;

    if (local > 60 && local <= 96) y = baselineY - (local - 60) * 1.2;
    else if (local > 96 && local <= 116) y = baselineY + (local - 96) * 2.2;
    else if (local > 116 && local <= 160) y = baselineY - 40 + (local - 116) * 1.0;

    ctx.lineTo(x, y);
  }

  ctx.stroke();
}
