const PRESETS = [0.25, 0.5, 0.75, 1.0];

export function createControlPanel({
  sceneOptions,
  meshOptions,
  onApplySelection,
  onResolutionChange,
  onSceneChange,
  onMeshScaleChange,
  onPathNodeIndexChange,
  onPathNodeOffsetChange,
}) {
  const root = document.createElement('div');
  root.style.cssText = [
    'position: fixed',
    'top: 10px',
    'left: 10px',
    'z-index: 999',
    'display: flex',
    'flex-direction: column',
    'gap: 8px',
    'max-width: 360px',
  ].join(';');
  document.body.appendChild(root);

  const fpsDisplay = createInfoBlock('FPS: --', 16);
  const loadDisplay = createInfoBlock('Load Time: --', 14);
  const infoDisplay = createInfoBlock('Select models to load.', 13);
  root.append(fpsDisplay, loadDisplay, infoDisplay);

  const selectionPanel = createInfoBlock('', 13);
  selectionPanel.style.display = 'flex';
  selectionPanel.style.flexDirection = 'column';
  selectionPanel.style.gap = '8px';

  const sceneSelect = createModelSelect('3DGS Scene', sceneOptions);
  const meshSelect = createModelSelect('Mesh Model', meshOptions);
  const meshScaleLabel = document.createElement('label');
  meshScaleLabel.textContent = 'Mesh Scale';
  meshScaleLabel.style.fontWeight = 'bold';

  const meshScaleValue = document.createElement('div');
  meshScaleValue.textContent = 'Current: 1.00x';
  meshScaleValue.style.cssText = 'font-size: 12px; color: #ddd;';

  const meshScaleSlider = document.createElement('input');
  meshScaleSlider.type = 'range';
  meshScaleSlider.min = '0.10';
  meshScaleSlider.max = '1.30';
  meshScaleSlider.step = '0.02';
  meshScaleSlider.value = '1.00';
  meshScaleSlider.style.width = '100%';
  meshScaleSlider.addEventListener('input', () => {
    const scale = clampMeshScale(parseFloat(meshScaleSlider.value));
    meshScaleValue.textContent = `Current: ${scale.toFixed(2)}x`;
    onMeshScaleChange?.({
      scale,
      sceneFile: sceneSelect.element.value || null,
      meshFile: meshSelect.element.value || null,
    });
  });

  sceneSelect.element.addEventListener('change', () => {
    onSceneChange?.(sceneSelect.element.value || null);
  });

  const pathLabel = document.createElement('label');
  pathLabel.textContent = 'Path Node Calibrator';
  pathLabel.style.fontWeight = 'bold';

  const pathHint = document.createElement('div');
  pathHint.textContent = 'Tune node offsets per scene, then share localStorage data.';
  pathHint.style.cssText = 'font-size: 12px; color: #ddd;';

  const nodeSelect = document.createElement('select');
  nodeSelect.style.cssText = [
    'width: 100%',
    'background: rgba(255,255,255,0.12)',
    'color: white',
    'border: 1px solid rgba(255,255,255,0.25)',
    'padding: 6px 8px',
    'border-radius: 4px',
    'font-size: 13px',
  ].join(';');

  const nodeOffsetX = createPathOffsetControl('X');
  const nodeOffsetY = createPathOffsetControl('Y');
  const nodeOffsetZ = createPathOffsetControl('Z');

  let pathEditorEnabled = false;
  let suppressPathEmit = false;

  const emitNodeOffset = () => {
    if (!pathEditorEnabled || suppressPathEmit) return;
    const nodeIndex = Number(nodeSelect.value);
    if (!Number.isFinite(nodeIndex)) return;

    const offset = [
      clampPathOffset(parseFloat(nodeOffsetX.value.value)),
      clampPathOffset(parseFloat(nodeOffsetY.value.value)),
      clampPathOffset(parseFloat(nodeOffsetZ.value.value)),
    ];
    nodeOffsetX.slider.value = String(offset[0]);
    nodeOffsetY.slider.value = String(offset[1]);
    nodeOffsetZ.slider.value = String(offset[2]);
    nodeOffsetX.value.value = formatPathOffset(offset[0]);
    nodeOffsetY.value.value = formatPathOffset(offset[1]);
    nodeOffsetZ.value.value = formatPathOffset(offset[2]);

    onPathNodeOffsetChange?.({
      sceneFile: sceneSelect.element.value || null,
      nodeIndex,
      offset,
    });
  };

  nodeSelect.addEventListener('change', () => {
    if (!pathEditorEnabled) return;
    const nodeIndex = Number(nodeSelect.value);
    if (!Number.isFinite(nodeIndex)) return;
    onPathNodeIndexChange?.({
      sceneFile: sceneSelect.element.value || null,
      nodeIndex,
    });
  });

  bindPathOffsetControl(nodeOffsetX, emitNodeOffset);
  bindPathOffsetControl(nodeOffsetY, emitNodeOffset);
  bindPathOffsetControl(nodeOffsetZ, emitNodeOffset);

  const applyButton = document.createElement('button');
  applyButton.textContent = 'Load Selected Models';
  applyButton.style.cssText = [
    'background: rgba(0,100,255,0.85)',
    'color: white',
    'border: none',
    'padding: 8px 12px',
    'border-radius: 6px',
    'cursor: pointer',
    'font-size: 14px',
  ].join(';');

  applyButton.addEventListener('click', () => {
    onApplySelection({
      sceneFile: sceneSelect.element.value || null,
      meshFile: meshSelect.element.value || null,
    });
  });

  const selectionItems = [
    sceneSelect.label,
    sceneSelect.element,
    meshSelect.label,
    meshSelect.element,
    meshScaleLabel,
    meshScaleValue,
    meshScaleSlider,
    pathLabel,
    pathHint,
    nodeSelect,
    nodeOffsetX.row,
    nodeOffsetY.row,
    nodeOffsetZ.row,
    applyButton
  ];

  selectionPanel.append(...selectionItems);
  root.appendChild(selectionPanel);

  const resolutionPanel = document.createElement('div');
  resolutionPanel.style.cssText = [
    'position: fixed',
    'top: 10px',
    'right: 10px',
    'z-index: 999',
    'background: rgba(0,0,0,0.6)',
    'padding: 10px 14px',
    'border-radius: 8px',
    'color: white',
    'font-family: monospace',
    'font-size: 14px',
    'display: flex',
    'flex-direction: column',
    'gap: 6px',
    'min-width: 220px',
  ].join(';');
  document.body.appendChild(resolutionPanel);

  const title = document.createElement('div');
  title.textContent = 'Resolution Scale';
  title.style.fontWeight = 'bold';

  const value = document.createElement('div');
  value.textContent = 'Current: 1.00x';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0.10';
  slider.max = '1.00';
  slider.step = '0.05';
  slider.value = '1.00';
  slider.style.width = '100%';
  slider.addEventListener('input', () => {
    onResolutionChange(parseFloat(slider.value));
  });

  const presetRow = document.createElement('div');
  presetRow.style.cssText = 'display: flex; gap: 6px; justify-content: space-between;';
  for (const preset of PRESETS) {
    const button = document.createElement('button');
    button.textContent = `${preset}x`;
    button.style.cssText = [
      'flex: 1',
      'background: rgba(255,255,255,0.15)',
      'color: white',
      'border: none',
      'padding: 4px 0',
      'border-radius: 4px',
      'cursor: pointer',
      'font-size: 13px',
    ].join(';');
    button.addEventListener('click', () => onResolutionChange(preset));
    presetRow.appendChild(button);
  }

  const actualPixels = document.createElement('div');
  actualPixels.style.cssText = 'color: #aaa; font-size: 12px;';

  resolutionPanel.append(title, value, slider, presetRow, actualPixels);

  return {
    setFPS(fps) {
      if (fps == null) {
        fpsDisplay.textContent = 'FPS: --';
        fpsDisplay.style.color = 'white';
        return;
      }
      fpsDisplay.textContent = `FPS: ${fps}`;
      fpsDisplay.style.color = fps >= 50 ? '#00ff88' : fps >= 30 ? '#ffcc00' : '#ff4444';
    },
    setLoadTime(seconds) {
      loadDisplay.textContent = seconds == null ? 'Load Time: --' : `Load Time: ${seconds}s`;
    },
    setInfo(text) {
      infoDisplay.textContent = text;
    },
    updateResolution(scale) {
      const clamped = clampScale(scale);
      slider.value = String(clamped);
      value.textContent = `Current: ${clamped.toFixed(2)}x`;
    },
    updateActualPixels(scale) {
      const clamped = clampScale(scale);
      const w = Math.round(window.innerWidth * window.devicePixelRatio * clamped);
      const h = Math.round(window.innerHeight * window.devicePixelRatio * clamped);
      actualPixels.textContent = `Actual Pixels: ${w} x ${h}`;
    },
    updateMeshScale(scale) {
      const clamped = clampMeshScale(scale);
      meshScaleSlider.value = String(clamped);
      meshScaleValue.textContent = `Current: ${clamped.toFixed(2)}x`;
    },
    setPathNodeEditor(nodeCount) {
      const count = Math.max(0, Number(nodeCount) || 0);
      pathEditorEnabled = count > 0;
      nodeSelect.disabled = !pathEditorEnabled;
      nodeOffsetX.slider.disabled = !pathEditorEnabled;
      nodeOffsetY.slider.disabled = !pathEditorEnabled;
      nodeOffsetZ.slider.disabled = !pathEditorEnabled;
      nodeOffsetX.value.disabled = !pathEditorEnabled;
      nodeOffsetY.value.disabled = !pathEditorEnabled;
      nodeOffsetZ.value.disabled = !pathEditorEnabled;

      while (nodeSelect.firstChild) {
        nodeSelect.removeChild(nodeSelect.firstChild);
      }

      if (!pathEditorEnabled) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No path nodes in current scene';
        option.style.color = 'black';
        nodeSelect.appendChild(option);
        this.setPathNodeOffset([0, 0, 0]);
        return;
      }

      for (let i = 0; i < count; i += 1) {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = `Node ${i + 1}`;
        option.style.color = 'black';
        nodeSelect.appendChild(option);
      }
      nodeSelect.value = '0';
    },
    setPathNodeOffset(offset) {
      const x = clampPathOffset(offset?.[0]);
      const y = clampPathOffset(offset?.[1]);
      const z = clampPathOffset(offset?.[2]);

      suppressPathEmit = true;
      nodeOffsetX.slider.value = String(x);
      nodeOffsetY.slider.value = String(y);
      nodeOffsetZ.slider.value = String(z);
      nodeOffsetX.value.value = formatPathOffset(x);
      nodeOffsetY.value.value = formatPathOffset(y);
      nodeOffsetZ.value.value = formatPathOffset(z);
      suppressPathEmit = false;
    },
    getSelectedPathNodeIndex() {
      const idx = Number(nodeSelect.value);
      return Number.isFinite(idx) ? idx : 0;
    },
  };
}

function createModelSelect(title, options) {
  const id = `select-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const label = document.createElement('label');
  label.textContent = title;
  label.style.fontWeight = 'bold';
  label.htmlFor = id;

  const element = document.createElement('select');
  element.id = id;
  element.name = id;
  element.style.cssText = [
    'width: 100%',
    'background: rgba(255,255,255,0.12)',
    'color: white',
    'border: 1px solid rgba(255,255,255,0.25)',
    'padding: 6px 8px',
    'border-radius: 4px',
    'font-size: 13px',
  ].join(';');

  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'None';
  none.style.color = 'black';
  element.appendChild(none);

  for (const option of options) {
    const node = document.createElement('option');
    node.value = option;
    node.textContent = option;
    node.style.color = 'black';
    element.appendChild(node);
  }

  return { label, element };
}

function createInfoBlock(text, fontSize) {
  const el = document.createElement('div');
  el.style.cssText = [
    'color: white',
    'background: rgba(0,0,0,0.6)',
    'padding: 8px 12px',
    `font-size: ${fontSize}px`,
    'font-family: monospace',
    'border-radius: 6px',
  ].join(';');
  el.textContent = text;
  return el;
}

function clampScale(scale) {
  return Math.min(1, Math.max(0.1, Number(scale) || 1));
}

function clampMeshScale(scale) {
  return Math.min(1.3, Math.max(0.1, Number(scale) || 1));
}

function createPathOffsetControl(axisLabel) {
  const row = document.createElement('div');
  row.style.cssText = 'display: grid; grid-template-columns: 14px 1fr 74px; gap: 8px; align-items: center;';

  const axis = document.createElement('div');
  axis.textContent = axisLabel;
  axis.style.cssText = 'font-size: 12px; color: #ddd;';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '-10';
  slider.max = '10';
  slider.step = '0.05';
  slider.value = '0';
  slider.style.width = '100%';

  const value = document.createElement('input');
  value.type = 'number';
  value.min = '-10';
  value.max = '10';
  value.step = '0.05';
  value.value = '0.00';
  value.style.cssText = [
    'width: 74px',
    'box-sizing: border-box',
    'background: rgba(255,255,255,0.12)',
    'color: white',
    'border: 1px solid rgba(255,255,255,0.25)',
    'padding: 4px 6px',
    'border-radius: 4px',
    'font-size: 12px',
    'text-align: right',
  ].join(';');

  row.append(axis, slider, value);
  return { row, slider, value };
}

function bindPathOffsetControl(control, emit) {
  control.slider.addEventListener('input', () => {
    const n = clampPathOffset(parseFloat(control.slider.value));
    control.value.value = formatPathOffset(n);
    emit();
  });

  const applyNumber = () => {
    const n = clampPathOffset(parseFloat(control.value.value));
    control.slider.value = String(n);
    control.value.value = formatPathOffset(n);
    emit();
  };

  control.value.addEventListener('input', applyNumber);
  control.value.addEventListener('change', applyNumber);
}

function clampPathOffset(value) {
  return Math.min(10, Math.max(-10, Number(value) || 0));
}

function formatPathOffset(value) {
  return clampPathOffset(value).toFixed(2);
}
