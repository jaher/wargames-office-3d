import { OmarchyScreen } from './omarchyScreen.js';
import { OfficeScene } from './officeScene.js';
import { SolutionsController } from './solutions.js';

function getDom() {
  const byId = (id) => document.getElementById(id);
  return {
    app: byId('app'),
    canvas: byId('sceneCanvas'),
    loadingOverlay: byId('loadingOverlay'),
    loadingTitle: byId('loadingTitle'),
    loadingStatus: byId('loadingStatus'),
    loadingBarFill: byId('loadingBarFill'),
    loadingCount: byId('loadingCount'),
    cancelLoadBtn: byId('cancelLoadBtn'),
    retryLoadBtn: byId('retryLoadBtn'),
    jetAudioBtn: byId('jetAudioBtn'),
    skyMoodBtn: byId('skyMoodBtn'),
    togglePanelBtn: byId('togglePanelBtn'),
    closePanelBtn: byId('closePanelBtn'),
    sidePanel: byId('sidePanel'),
    camButtons: [...document.querySelectorAll('.cam-btn')],
    statusBadge: byId('statusBadge'),
    familySel: byId('familySel'),
    gameSel: byId('gameSel'),
    jump: byId('jump'),
    playBtn: byId('playBtn'),
    restartBtn: byId('restartBtn'),
    narrBtn: byId('narrBtn'),
    speed: byId('speed'),
    fill: byId('fill'),
    narrBar: byId('narrBar'),
    narrTime: byId('narrTime'),
    narrPlayPause: byId('narrPlayPause'),
    narrSeek: byId('narrSeek'),
    narrSeg: byId('narrSeg'),
    focusMonitorBtn: byId('focusMonitorBtn'),
    transcriptWrap: byId('transcriptWrap'),
    narrTranscript: byId('narrTranscript'),
  };
}

function setActiveCamButton(camButtons, preset) {
  for (const btn of camButtons) {
    btn.classList.toggle('active', btn.dataset.cam === preset);
  }
}

function hideLoadingOverlay(dom) {
  window.__officeReady = true;
  if (dom.canvas) dom.canvas.classList.add('ready');
  if (!dom.loadingOverlay) return;
  dom.loadingOverlay.classList.add('hidden');
}

function bootstrap() {
  if (window.__loadCancelled) return;
  const dom = getDom();
  const omarchyScreen = new OmarchyScreen();
  window.__omarchyScreen = omarchyScreen;
  let office = null;

  try {
    dom.loadingStatus.textContent = 'Building 3D office scene…';
    office = new OfficeScene(dom.canvas, omarchyScreen, (preset) => {
      setActiveCamButton(dom.camButtons, preset);
    });
    // Optional URL params (?cam=cluster&mood=1&panel=0) for direct preset deep-linking
    const qs = new URLSearchParams(window.location.search);
    const qsMood = qs.get('mood');
    if (qsMood !== null && !Number.isNaN(Number(qsMood))) {
      const mood = office.applySkyMood(Number(qsMood));
      dom.skyMoodBtn.textContent = mood.label;
    }
    const qsCam = qs.get('cam');
    if (qsCam && office) {
      office.goToPreset(qsCam);
      // Snap immediately on initial deep-link load
      if (office.animatingCam) {
        office.camera.position.copy(office.animatingCam.endPos);
        office.controls.target.copy(office.animatingCam.endTarget);
        office.controls.update();
        office.animatingCam = null;
      }
      setActiveCamButton(dom.camButtons, qsCam);
    }
    const qsCamPos = qs.get('camPos');
    const qsCamTarget = qs.get('camTarget');
    if (qsCamPos && qsCamTarget && office) {
      const p = qsCamPos.split(',').map(Number);
      const t = qsCamTarget.split(',').map(Number);
      if (p.length === 3 && t.length === 3 && p.every(Number.isFinite) && t.every(Number.isFinite)) {
        office.animatingCam = null;
        office.camera.position.set(p[0], p[1], p[2]);
        office.controls.target.set(t[0], t[1], t[2]);
        office.controls.update();
      }
    }
    const smallViewportMq = window.matchMedia('(max-width: 960px), (max-height: 500px)');
    const qsPanel = qs.get('panel');
    const shouldStartCollapsed = qsPanel === '0' || (qsPanel !== '1' && smallViewportMq.matches);
    if (shouldStartCollapsed) {
      if (dom.sidePanel) dom.sidePanel.style.transition = 'none';
      dom.app.classList.add('panel-collapsed');
      dom.togglePanelBtn.textContent = 'Show Panel';
      // Force synchronous layout flush before resizing WebGL canvas so zero black right margin ever appears!
      void dom.app.offsetWidth;
      office.resize();
      requestAnimationFrame(() => {
        office.resize();
        if (dom.sidePanel) dom.sidePanel.style.transition = '';
      });
    }
    dom.loadingStatus.textContent = 'Loading 3D models, skyline vistas & narration…';
  } catch (err) {
    console.error('3D scene initialization failed:', err);
    if (dom.loadingTitle) dom.loadingTitle.textContent = 'WebGL Initialization Failed';
    if (dom.loadingStatus) dom.loadingStatus.textContent = `WebGL error: ${err?.message || err}`;
    if (dom.loadingOverlay) dom.loadingOverlay.classList.add('cancelled');
    if (dom.cancelLoadBtn) dom.cancelLoadBtn.style.display = 'none';
    if (dom.retryLoadBtn) dom.retryLoadBtn.style.display = '';
    return;
  }

  // Camera preset buttons
  for (const btn of dom.camButtons) {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.cam;
      if (!preset || !office) return;
      office.goToPreset(preset);
      setActiveCamButton(dom.camButtons, preset);
    });
  }

  // "Monitor" button zooms camera directly onto the Omarchy Linux monitor
  if (dom.focusMonitorBtn) {
    dom.focusMonitorBtn.addEventListener('click', () => {
      if (!office) return;
      office.goToPreset('monitor');
      setActiveCamButton(dom.camButtons, 'monitor');
    });
  }

  // Blue Angels live jet engine audio toggle
  if (dom.jetAudioBtn) {
    dom.jetAudioBtn.addEventListener('click', () => {
      if (!office) return;
      const on = office.toggleJetAudio();
      dom.jetAudioBtn.textContent = on ? '✈ Jet Audio' : '✈ Muted';
    });
  }

  // Sky mood switcher (Golden Hour / Clear Day / Sunset Dusk)
  dom.skyMoodBtn.addEventListener('click', () => {
    if (!office) return;
    const mood = office.nextSkyMood();
    dom.skyMoodBtn.textContent = mood.label;
    office.renderFrame();
  });

  // Collapsible side panel toggle
  let userToggledPanel = false;
  const setPanelCollapsed = (collapsed) => {
    dom.app.classList.toggle('panel-collapsed', collapsed);
    dom.togglePanelBtn.textContent = collapsed ? 'Show Panel' : 'Hide Panel';
    if (office) {
      office.resize();
      setTimeout(() => office.resize(), 140);
      setTimeout(() => office.resize(), 280);
    }
  };
  const togglePanel = () => {
    userToggledPanel = true;
    setPanelCollapsed(!dom.app.classList.contains('panel-collapsed'));
  };
  dom.togglePanelBtn.addEventListener('click', togglePanel);
  if (dom.closePanelBtn) {
    dom.closePanelBtn.addEventListener('click', () => {
      userToggledPanel = true;
      setPanelCollapsed(true);
    });
  }
  const smallMq = window.matchMedia('(max-width: 960px), (max-height: 500px)');
  smallMq.addEventListener('change', (ev) => {
    if (ev.matches && !userToggledPanel) {
      setPanelCollapsed(true);
    }
  });

  // Keyboard shortcuts: 1-5 camera presets, P toggles side panel
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const camMap = {
      1: 'overview',
      2: 'monitor',
      3: 'pc',
      4: 'cluster',
      5: 'window',
    };
    if (camMap[e.key] && office) {
      office.goToPreset(camMap[e.key]);
      setActiveCamButton(dom.camButtons, camMap[e.key]);
    } else if (e.key === 'p' || e.key === 'P') {
      togglePanel();
    }
  });

  // Responsive resize observer on canvas viewport
  const ro = new ResizeObserver(() => {
    if (office) office.resize();
  });
  if (dom.canvas.parentElement) {
    ro.observe(dom.canvas.parentElement);
  }
  window.addEventListener('resize', () => {
    if (office) office.resize();
  });

  // Load OverTheWire solutions & voice narration while holding the loading preamble
  // until every 3D model, skyline texture, and initial solution/narration asset is ready.
  const solutions = new SolutionsController(
    dom,
    (screenState) => {
      omarchyScreen.update(screenState);
    },
    (key) => {
      if (office) office.pressKeyboardKey(key);
    }
  );

  let sceneDone = 0;
  let sceneTotal = 1;
  let solutionsReady = false;
  let loadCancelled = Boolean(window.__loadCancelled);

  const showLoadStoppedState = (titleText, statusText) => {
    if (dom.loadingOverlay) dom.loadingOverlay.classList.add('cancelled');
    if (dom.loadingTitle) dom.loadingTitle.textContent = titleText;
    if (dom.loadingStatus) dom.loadingStatus.textContent = statusText;
    if (dom.cancelLoadBtn) dom.cancelLoadBtn.style.display = 'none';
    if (dom.retryLoadBtn) dom.retryLoadBtn.style.display = '';
  };

  const cancelLoad = () => {
    if (window.__officeReady || loadCancelled) return;
    loadCancelled = true;
    window.__loadCancelled = true;
    if (office) office.cancelLoading();
    solutions.cancelLoading();
    const doneSteps = sceneDone + (solutionsReady ? 1 : 0);
    const totalSteps = Math.max(1, sceneTotal + 1);
    showLoadStoppedState(
      'Loading Cancelled',
      `Cancelled at ${doneSteps} / ${totalSteps} assets. Click Retry Load to try again.`
    );
  };
  window.__cancelLoad = cancelLoad;

  const updatePreamble = (lastUrl = '') => {
    if (loadCancelled) return;
    const doneSteps = sceneDone + (solutionsReady ? 1 : 0);
    const totalSteps = Math.max(1, sceneTotal + 1);
    const pct = Math.min(100, Math.round((doneSteps / totalSteps) * 100));
    if (dom.loadingBarFill) dom.loadingBarFill.style.width = `${pct}%`;
    if (dom.loadingCount) dom.loadingCount.textContent = `${pct}%  (${doneSteps} / ${totalSteps})`;
    if (dom.loadingStatus && lastUrl) {
      const label = lastUrl.split('/').pop().replace(/\.(glb|jpg|png)$/i, '').replace(/_/g, ' ');
      dom.loadingStatus.textContent = `Loaded ${label}…`;
    }
  };

  const sceneReadyP = office
    ? office.whenAllAssetsLoaded((done, total, lastUrl) => {
        sceneDone = done;
        sceneTotal = Math.max(1, total);
        updatePreamble(lastUrl);
      })
    : Promise.resolve({ failed: [], pending: 0, cancelled: false });

  const solutionsReadyP = solutions
    .init({ deferPlayback: true })
    .then(() => {
      if (loadCancelled) return;
      solutionsReady = true;
      updatePreamble();
    })
    .catch((err) => {
      if (loadCancelled || err?.name === 'AbortError') return;
      console.error('Failed to load OverTheWire solutions:', err);
      dom.statusBadge.textContent = 'Offline';
      solutionsReady = true;
      updatePreamble();
    });

  // Strict all-assets-ready gate: NEVER reveal a partial scene or pop in assets after the fact.
  // The user can cancel at any time via the Cancel Load button or Escape key.
  Promise.all([sceneReadyP, solutionsReadyP]).then(([assetStats]) => {
    if (loadCancelled || window.__loadCancelled || assetStats?.cancelled) return;
    const failed = assetStats?.failed || [];
    if (failed.length > 0 || (assetStats?.pending || 0) > 0) {
      showLoadStoppedState(
        'Some Assets Failed to Load',
        `Could not load ${failed.length} required asset(s). Click Retry Load to try again.`
      );
      return;
    }
    if (dom.loadingBarFill) dom.loadingBarFill.style.width = '100%';
    if (dom.loadingCount) dom.loadingCount.textContent = '100%';
    if (dom.loadingStatus) dom.loadingStatus.textContent = 'Rendering complete scene…';
    if (dom.cancelLoadBtn) dom.cancelLoadBtn.disabled = true;
    try {
      solutions.startInitialPlayback();
    } catch (e) {
      console.error('Playback start error:', e);
    }
    try {
      if (office) {
        office.renderFrame();
        office.start();
      }
      hideLoadingOverlay(dom);
    } catch (e) {
      console.error('3D start error:', e);
      showLoadStoppedState('Render Error', `3D render error: ${e?.message || e}`);
    }
  });
}

bootstrap();
