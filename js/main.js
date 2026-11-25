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
  if (!dom.loadingOverlay) return;
  dom.loadingOverlay.classList.add('hidden');
}

function bootstrap() {
  const dom = getDom();
  const omarchyScreen = new OmarchyScreen();
  let office = null;

  try {
    dom.loadingStatus.textContent = 'Building 3D office…';
    office = new OfficeScene(dom.canvas, omarchyScreen, (preset) => {
      setActiveCamButton(dom.camButtons, preset);
    });
    office.start();
    // Reveal the 3D scene immediately on the first painted frame — never block on network fetches!
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
  const togglePanel = () => {
    const collapsed = dom.app.classList.toggle('panel-collapsed');
    dom.togglePanelBtn.textContent = collapsed ? 'Show Panel' : 'Hide Panel';
    if (office) {
      office.resize();
      setTimeout(() => office.resize(), 140);
      setTimeout(() => office.resize(), 280);
    }
  };
  dom.togglePanelBtn.addEventListener('click', togglePanel);

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
