import * as THREE from 'three';

export function createFollowCameraController({
  camera,
  domElement,
  getTarget,
  initialDistance = 2.8,
  minDistance = 1.2,
  maxDistance = 4.5,
  smoothFactor = 7,
  minPolar = THREE.MathUtils.degToRad(10),
  maxPolar = THREE.MathUtils.degToRad(122),
}) {
  if (!camera || !domElement || !getTarget) return null;

  const spherical = new THREE.Spherical(
    clamp(initialDistance, minDistance, maxDistance),
    THREE.MathUtils.degToRad(58),
    THREE.MathUtils.degToRad(180)
  );
  const targetCurrent = new THREE.Vector3();
  const targetDesired = new THREE.Vector3();
  const targetSmoothed = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  let rotating = false;
  let pointerId = -1;
  let lastX = 0;
  let lastY = 0;

  const ROTATE_SPEED = 0.003;
  const ZOOM_SPEED = 0.0018;

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    rotating = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    domElement.setPointerCapture?.(pointerId);
  };

  const onPointerMove = (event) => {
    if (!rotating || event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    spherical.theta -= dx * ROTATE_SPEED;
    spherical.phi = clamp(spherical.phi + dy * ROTATE_SPEED, minPolar, maxPolar);
  };

  const endRotate = (event) => {
    if (!rotating || event.pointerId !== pointerId) return;
    rotating = false;
    domElement.releasePointerCapture?.(pointerId);
    pointerId = -1;
  };

  const onWheel = (event) => {
    event.preventDefault();
    spherical.radius = clamp(
      spherical.radius * (1 + event.deltaY * ZOOM_SPEED),
      minDistance,
      maxDistance
    );
  };

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', endRotate);
  domElement.addEventListener('pointercancel', endRotate);
  domElement.addEventListener('wheel', onWheel, { passive: false });

  getTarget(targetCurrent);
  targetSmoothed.copy(targetCurrent);
  updateCameraPosition();

  return {
    update(delta) {
      getTarget(targetDesired);
      const smooth = Math.max(0.1, Number(smoothFactor) || 7);
      const followFactor = Math.min(1, delta * smooth);
      targetSmoothed.lerp(targetDesired, followFactor);
      updateCameraPosition();
    },
    dispose() {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', endRotate);
      domElement.removeEventListener('pointercancel', endRotate);
      domElement.removeEventListener('wheel', onWheel);
    },
  };

  function updateCameraPosition() {
    offset.setFromSpherical(spherical);
    camera.position.copy(targetSmoothed).add(offset);
    lookAt.copy(targetSmoothed);
    camera.lookAt(lookAt);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
