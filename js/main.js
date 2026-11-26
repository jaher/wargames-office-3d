import { OmarchyScreen } from './omarchyScreen.js';
import { OfficeScene } from './officeScene.js';
import { SolutionsController } from './solutions.js';

function getDom() {
  const byId = (id) => document.getElementById(id);
  return {
    app: byId('app'),
    canvas: byId('sceneCanvas'),
    loadingOverlay: byId('loadingOverlay'),
    loadingStatus: byId('loadingStatus'),
    hudNowPlaying: byId('hudNowPlaying'),
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
    termTitle: byId('termTitle'),
    focusMonitorBtn: byId('focusMonitorBtn'),
    term: byId('term'),
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
  if (!dom.loadingOverlay) return;
  dom.loadingOverlay.classList.add('hidden');
}

function bootstrap() {
  const dom = getDom();
  const omarchyScreen = new OmarchyScreen();
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
    dom.loadingStatus.textContent = 'Rendering first frame…';
    office.renderFrame();
    office.start();
    // Reveal the 3D scene immediately once first frame is painted — never block on fetches or audio!
    requestAnimationFrame(() => hideLoadingOverlay(dom));
  } catch (err) {
    console.error('3D scene initialization failed:', err);
    dom.loadingStatus.textContent = `WebGL error: ${err?.message || err}`;
    setTimeout(() => hideLoadingOverlay(dom), 2600);
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

  // "3D Focus" button zooms camera directly onto the Omarchy Linux monitor
  dom.focusMonitorBtn.addEventListener('click', () => {
    if (!office) return;
    office.goToPreset('monitor');
    setActiveCamButton(dom.camButtons, 'monitor');
  });

  // Sky mood switcher (Golden Hour / Clear Day / Sunset Dusk)
  dom.skyMoodBtn.addEventListener('click', () => {
    if (!office) return;
    const mood = office.nextSkyMood();
    dom.skyMoodBtn.textContent = mood.label;
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

  // Load OverTheWire solutions & voice narration asynchronously in the background
  const solutions = new SolutionsController(dom, (screenState) => {
    omarchyScreen.update(screenState);
  });

  solutions.init().catch((err) => {
    console.error('Failed to load OverTheWire solutions:', err);
    dom.hudNowPlaying.textContent = 'Solutions unavailable';
    dom.statusBadge.textContent = 'Offline';
  });
}

bootstrap();
