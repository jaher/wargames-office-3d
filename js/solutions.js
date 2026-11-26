// OverTheWire + SmashTheStack solution loader, password redactor,
// terminal/vim replay engine, and synced audio narration + transcript controller.
// Reads exclusively from the ./overthewire-solutions/ git submodule.

const SUBMODULE_BASE = 'overthewire-solutions';
const NARR_PREF_KEY = 'otw-office-narration';

const FAMILY_OF = {};
[
  'narnia', 'natas', 'bandit', 'leviathan', 'krypton', 'manpage',
  'behemoth', 'utumno', 'maze', 'vortex', 'drifter', 'formulaone', 'semtex'
].forEach((k) => { FAMILY_OF[k] = 'otw'; });
['tux', 'logic', 'blackbox', 'blowfish', 'amateria', 'apfel']
  .forEach((k) => { FAMILY_OF[k] = 's2s'; });

const GAME_ORDER = [
  'bandit', 'natas', 'leviathan', 'krypton', 'narnia', 'behemoth',
  'utumno', 'maze', 'vortex', 'manpage', 'drifter', 'formulaone', 'semtex',
  'apfel', 'tux', 'logic', 'blackbox', 'blowfish', 'amateria'
];

function expandTabs(s) {
  let out = '';
  let col = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\n') { out += ch; col = 0; }
    else if (ch === '\t') {
      const n = col % 8 ? 8 - (col % 8) : 8;
      out += ' '.repeat(n);
      col += n;
    } else {
      out += ch;
      col++;
    }
  }
  return out;
}

function escapeHtml(s) {
  return expandTabs(String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTime(sec) {
  if (!isFinite(sec)) sec = 0;
  sec = Math.max(0, Math.floor(sec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function parseBanditFromIndexHtml(html) {
  const levelsStart = html.indexOf('const LEVELS = [');
  const goalsStart = html.indexOf('const GOALS = {');
  if (levelsStart < 0 || goalsStart < 0) return null;

  // Extract LEVELS array JSON directly from the script block
  const arrStart = html.indexOf('[', levelsStart);
  const arrEnd = html.indexOf('];', arrStart);
  if (arrStart < 0 || arrEnd < 0) return null;
  const levelsJsonStr = html.slice(arrStart, arrEnd + 1);
  let levels = [];
  try {
    levels = JSON.parse(levelsJsonStr);
  } catch {
    return null;
  }

  // Parse GOALS object entries safely without eval
  const gStart = html.indexOf('{', goalsStart);
  const gEnd = html.indexOf('};', gStart);
  const goals = {};
  if (gStart >= 0 && gEnd > gStart) {
    const body = html.slice(gStart + 1, gEnd);
    const lineRe = /^\s*(\d+)\s*:\s*(['"])([\s\S]*?)\2\s*,?\s*$/gm;
    let m;
    while ((m = lineRe.exec(body)) !== null) {
      goals[m[1]] = m[3].replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
  }

  return {
    title: 'Bandit',
    host: 'bandit.labs.overthewire.org',
    levels,
    goals,
  };
}

export class SolutionsController {
  constructor(dom, onScreenUpdate) {
    this.dom = dom;
    this.onScreenUpdate = onScreenUpdate;

    this.games = {};
    this.gameKey = 'vortex';
    this.cur = 0;
    this.playing = true;
    this.runId = 0;
    this.userPickedGame = false;

    // Screen buffer mirrored to the 3D Omarchy monitor
    this.screenLines = [];
    this.screenVim = null;
    this.screenHeader = 'Loading OverTheWire…';
    this.screenGoal = '';
    this.screenHost = 'omarchy@workstation';

    // Narration state
    this.narrAudio = document.createElement('audio');
    this.narrAudio.preload = 'metadata';
    this.narrMap = null;
    this.narrOn = false;
    this.narrFF = false;
    this.narrAutoplayBlocked = false;
    this.narrGame = '';
    this.narrLevel = -1;
    this.narrLevelKey = '';
    this.narrLoadTok = 0;
    this.narrLineTime = new Map();
    this.narrKeySegs = new Map();
    this.activeNarrSeg = -1;
    this.activeSecrets = [];
    this._gameFetchPromises = new Map();

    this._bindEvents();
  }

  _bindEvents() {
    const {
      familySel, gameSel, jump, playBtn, restartBtn,
      narrBtn, narrSeek, narrPlayPause
    } = this.dom;

    familySel.onchange = async () => {
      this.userPickedGame = true;
      this.fillGames();
      await this._ensureGameLoaded(this.gameKey);
      this.fillLevels();
      this.playing = true;
      playBtn.textContent = '‖ Pause';
      void this.playLevel(0);
    };

    gameSel.onchange = async () => {
      this.userPickedGame = true;
      this.gameKey = gameSel.value;
      await this._ensureGameLoaded(this.gameKey);
      this.fillLevels();
      this.playing = true;
      playBtn.textContent = '‖ Pause';
      void this.playLevel(0);
    };

    jump.onchange = () => {
      this.playing = true;
      playBtn.textContent = '‖ Pause';
      const levels = this.curGame()?.levels || [];
      const ix = levels.findIndex((x) => x.lvl === parseInt(jump.value, 10));
      void this.playLevel(ix < 0 ? 0 : ix);
    };

    playBtn.onclick = () => this.togglePlay();

    restartBtn.onclick = () => {
      this.playing = true;
      playBtn.textContent = '‖ Pause';
      if (this.narrOn && this.narrMap) {
        this.narrAudio.currentTime = 0;
      }
      void this.playLevel(this.cur);
    };

    narrBtn.onclick = () => {
      if (!this.narrMap) return;
      if (this.narrOn && !this.narrAutoplayBlocked) {
        this.narrOn = false;
        this.narrFF = false;
        this.narrAutoplayBlocked = false;
        this._setNarrPref(true);
        this.narrAudio.pause();
        this._setNarrBtnText();
        this._syncAudioButtons();
        this._emitScreen();
        return;
      }
      this.narrOn = true;
      this.narrFF = false;
      this.narrAutoplayBlocked = false;
      this._setNarrPref(false);
      this.playing = true;
      playBtn.textContent = '‖ Pause';
      this._setNarrBtnText();
      this.narrAudio.currentTime = 0;
      void this.playLevel(this.cur);
      this._tryStartNarrAudio();
    };

    narrPlayPause.onclick = () => {
      if (!this.narrMap) return;
      if (!this.narrOn || this.narrAutoplayBlocked) {
        narrBtn.click();
        return;
      }
      if (this.narrAudio.paused) {
        this.playing = true;
        playBtn.textContent = '‖ Pause';
        this._tryStartNarrAudio();
      } else {
        this.narrAudio.pause();
      }
      this._syncAudioButtons();
    };

    narrSeek.addEventListener('input', () => {
      if (!this.narrMap) return;
      this.narrAudio.currentTime = parseFloat(narrSeek.value);
      this._narrHighlight();
    });

    narrSeek.addEventListener('change', () => {
      if (!this.narrOn || !this.narrMap) return;
      this.narrFF = true;
      this.playLevel(this.cur);
    });

    this.narrAudio.addEventListener('timeupdate', () => {
      this._setNarrTime();
      this._narrHighlight();
    });
    this.narrAudio.addEventListener('seeked', () => this._narrHighlight());
    this.narrAudio.addEventListener('loadedmetadata', () => this._setNarrTime());
    this.narrAudio.addEventListener('play', () => { this._syncAudioButtons(); this._emitScreen(); });
    this.narrAudio.addEventListener('pause', () => { this._syncAudioButtons(); this._emitScreen(); });
    this.narrAudio.addEventListener('ended', () => {
      this.narrOn = false;
      this.narrFF = false;
      this._setNarrBtnText();
      this._syncAudioButtons();
      this._narrClearHL();
      this._emitScreen();
    });

    const narrKick = () => {
      if (this.narrOn && !this.narrAutoplayBlocked && this.narrMap && this.playing && this.narrAudio.paused) {
        this._tryStartNarrAudio();
      }
    };
    document.addEventListener('pointerdown', narrKick);
    document.addEventListener('keydown', narrKick);
  }

  togglePlay() {
    this.playing = !this.playing;
    this.dom.playBtn.textContent = this.playing ? '‖ Pause' : '▶ Play';
    if (this.narrOn && this.narrMap) {
      if (this.playing) this._tryStartNarrAudio();
      else this.narrAudio.pause();
    }
    this._syncAudioButtons();
  }

  _syncAudioButtons() {
    const isPlayingAudio = this.narrOn && !this.narrAudio.paused && !this.narrAudio.ended;
    this.dom.narrPlayPause.textContent = isPlayingAudio ? '‖' : '▶';
  }

  _narrPrefOff() {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(NARR_PREF_KEY) === 'off';
    } catch {
      return false;
    }
  }

  _setNarrPref(off) {
    try {
      if (typeof localStorage === 'undefined') return;
      if (off) localStorage.setItem(NARR_PREF_KEY, 'off');
      else localStorage.removeItem(NARR_PREF_KEY);
    } catch { /* ignore */ }
  }

  _setNarrBtnText() {
    if (this.narrOn && !this.narrAutoplayBlocked) {
      this.dom.narrBtn.textContent = '✕ Narration: On';
      this.dom.narrBtn.classList.add('narr-on');
    } else {
      this.dom.narrBtn.textContent = '♪ Narrate';
      this.dom.narrBtn.classList.remove('narr-on');
    }
  }

  _tryStartNarrAudio() {
    if (!this.narrOn || !this.narrMap) return;
    try {
      const p = this.narrAudio.play();
      if (p && p.then) {
        p.then(() => {
          this.narrAutoplayBlocked = false;
          this._setNarrBtnText();
          this._syncAudioButtons();
        }).catch(() => {
          // Browser blocked autoplay before user gesture: don't freeze terminal replay
          this.narrAutoplayBlocked = true;
          this._setNarrBtnText();
          this._syncAudioButtons();
        });
      }
    } catch {
      this.narrAutoplayBlocked = true;
    }
  }

  async _ensureGameLoaded(key) {
    const g = this.games[key];
    if (!g || g._loaded) return;
    if (this._gameFetchPromises.has(key)) {
      return this._gameFetchPromises.get(key);
    }
    const p = fetch(`${SUBMODULE_BASE}/games/${key}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !this.games[key]) return;
        this.games[key].host = this.games[key].host || data.host;
        this.games[key].levels = data.levels || [];
        this.games[key].goals = data.goals || {};
        this.games[key]._loaded = true;
      })
      .catch(() => {})
      .finally(() => {
        this._gameFetchPromises.delete(key);
      });
    this._gameFetchPromises.set(key, p);
    return p;
  }

  async init() {
    const [banditHtml, manifestRes] = await Promise.all([
      fetch(`${SUBMODULE_BASE}/index.html`).then((r) => (r.ok ? r.text() : null)).catch(() => null),
      fetch(`${SUBMODULE_BASE}/games/manifest.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    if (banditHtml) {
      const bandit = parseBanditFromIndexHtml(banditHtml);
      if (bandit) {
        bandit._loaded = true;
        this.games.bandit = bandit;
      }
    }

    if (manifestRes && Array.isArray(manifestRes.games)) {
      for (const g of manifestRes.games) {
        if (!this.games[g.key]) {
          this.games[g.key] = {
            title: g.title,
            host: g.host || `${g.key}.labs.overthewire.org`,
            levels: [],
            goals: {},
            _loaded: false,
          };
        }
      }
    }

    if (this.games.vortex && !this.userPickedGame) {
      this.gameKey = 'vortex';
    } else if (!this.games[this.gameKey]) {
      const keys = Object.keys(this.games);
      if (keys.length) this.gameKey = keys[0];
    }

    await this._ensureGameLoaded(this.gameKey);
    this.fillGames();
    this.fillLevels();

    // Fire level playback asynchronously — NEVER await the full level loop during init!
    void this.playLevel(0);

    // Hydrate remaining games in the background so dropdown level counts fill in smoothly
    if (manifestRes && Array.isArray(manifestRes.games)) {
      Promise.all(manifestRes.games.map((g) => this._ensureGameLoaded(g.key))).then(() => {
        const curSelected = this.dom.gameSel.value;
        this.fillGames();
        if (curSelected) this.dom.gameSel.value = curSelected;
      });
    }
  }

  curGame() {
    return this.games[this.gameKey];
  }

  fillGames() {
    const { gameSel, familySel } = this.dom;
    gameSel.innerHTML = '';
    const fam = familySel.value;
    const keys = Object.keys(this.games)
      .filter((k) => (FAMILY_OF[k] || 'otw') === fam)
      .sort((a, b) => {
        const ia = GAME_ORDER.indexOf(a);
        const ib = GAME_ORDER.indexOf(b);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      });

    for (const k of keys) {
      const o = document.createElement('option');
      o.value = k;
      const lvlCount = (this.games[k].levels || []).length;
      const cleanTitle = this.games[k].title.replace(/ \(SmashTheStack\)$/, '');
      o.textContent = lvlCount ? `${cleanTitle} (${lvlCount})` : `${cleanTitle} (0)`;
      gameSel.appendChild(o);
    }

    if (keys.length && !keys.includes(this.gameKey)) {
      this.gameKey = keys[0];
    }
    gameSel.value = this.gameKey;
  }

  fillLevels() {
    const { jump } = this.dom;
    jump.innerHTML = '';
    const ls = this.curGame()?.levels || [];
    if (!ls.length) {
      const o = document.createElement('option');
      o.textContent = '— no levels yet —';
      o.disabled = true;
      jump.appendChild(o);
      jump.disabled = true;
      return;
    }
    jump.disabled = false;
    for (const L of ls) {
      const o = document.createElement('option');
      o.value = L.lvl;
      o.textContent = `Level ${L.lvl}`;
      jump.appendChild(o);
    }
  }

  // Strictly redact every known OverTheWire / SmashTheStack level password so
  // no password is ever rendered in the DOM or on the 3D monitor texture.
  _buildSecretList(G, L) {
    const set = new Set();
    const skipPublic = new Set(['bandit0', 'natas0', 'leviathan0', 'krypton0', 'narnia0', 'behemoth0', 'utumno0', 'maze0', 'vortex0']);
    if (L && typeof L.pw === 'string' && L.pw.trim().length >= 4) {
      const pw = L.pw.trim();
      if (!skipPublic.has(pw)) set.add(pw);
    }
    for (const lv of (G?.levels || [])) {
      if (lv && typeof lv.pw === 'string' && lv.pw.trim().length >= 5) {
        const pw = lv.pw.trim();
        if (!skipPublic.has(pw)) set.add(pw);
      }
    }
    return [...set].sort((a, b) => b.length - a.length);
  }

  redactText(text) {
    if (!text) return '';
    let s = String(text);
    for (const secret of this.activeSecrets) {
      if (s.includes(secret)) {
        s = s.split(secret).join('[REDACTED]');
      }
    }
    // Redact inline credentials in curl -u user:pass or sshpass -p pass
    s = s.replace(/(-u\s+[A-Za-z0-9_.-]+:)([^\s'"`]+)/g, (m, pre, tok) => {
      if (tok === '[REDACTED]' || tok.startsWith('$') || /^<.*>$/.test(tok)) return m;
      return `${pre}[REDACTED]`;
    });
    s = s.replace(/(sshpass\s+-p\s+['"]?)([^\s'"`]+)(['"]?)/gi, (m, pre, tok, post) => {
      if (tok === '[REDACTED]' || tok.startsWith('$')) return m;
      return `${pre}[REDACTED]${post}`;
    });
    // Also redact password tokens when following "password ...:"
    s = s.replace(
      /(password(?:\s+(?:for|to|you\s+are\s+looking\s+for)\s+[\w\s]+?)?\s*(?:is|:)\s*)([A-Za-z0-9_!@#$%^&*+=~-]{8,64})/gi,
      (m, prefix, token) => {
        if (token === '[REDACTED]' || /^<.*>$/.test(token)) return m;
        return `${prefix}[REDACTED]`;
      }
    );
    return s;
  }

  _renderSafeHtml(text) {
    const clean = this.redactText(text);
    return escapeHtml(clean).replace(
      /\[REDACTED\]/g,
      '<span class="redacted">[REDACTED]</span>'
    );
  }

  _speed() {
    return parseFloat(this.dom.speed.value) || 1;
  }

  _sleep() {
    return new Promise((resolve) => {
      const iv = setInterval(() => {
        if (this.playing) {
          clearInterval(iv);
          resolve();
        }
      }, 60);
    });
  }

  _delay(ms) {
    if (this.narrFF) return Promise.resolve();
    return new Promise((resolve) => {
      let t = 0;
      const iv = setInterval(() => {
        if (this.playing) {
          t += 50;
          if (t >= ms) {
            clearInterval(iv);
            resolve();
          }
        }
      }, 50);
    });
  }

  _narrKey(step, role, idx) {
    return `${step}:${role}:${idx === undefined ? '' : idx}`;
  }

  _buildNarrSchedule(map) {
    this.narrLineTime = new Map();
    this.narrKeySegs = new Map();
    (map.segments || []).forEach((sg, si) => {
      const refs = [];
      for (const L of (sg.lines || [])) {
        if (L.role === 'out' && L.from !== undefined) {
          const to = L.to === undefined ? L.from : L.to;
          for (let i = L.from; i <= to; i++) {
            refs.push(this._narrKey(L.step, 'out', i));
          }
        } else {
          refs.push(this._narrKey(L.step, L.role));
        }
      }
      refs.forEach((k, j) => {
        if (!this.narrKeySegs.has(k)) this.narrKeySegs.set(k, []);
        this.narrKeySegs.get(k).push(si);
        if (!this.narrLineTime.has(k)) {
          const t = sg.start + (refs.length > 1 ? (j / refs.length) * (sg.end - sg.start) : 0);
          this.narrLineTime.set(k, { t, seg: si });
        }
      });
    });
  }

  _narrActive() {
    const curL = this.curGame()?.levels?.[this.cur];
    return (
      this.narrOn &&
      !this.narrAutoplayBlocked &&
      this.narrMap &&
      this.narrGame === this.gameKey &&
      this.narrLevel === curL?.lvl
    );
  }

  async _narrGate(step, role, idx, my) {
    if (!this._narrActive()) return;
    const e = this.narrLineTime.get(this._narrKey(step, role, idx));
    if (!e || e.t <= (this.narrAudio.currentTime || 0)) return;
    this.narrFF = false;
    while (this.narrAudio.paused || (this.narrAudio.currentTime || 0) < e.t) {
      if (my !== this.runId || !this.narrOn || this.narrAutoplayBlocked) return;
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  _tagNarr(el, step, role, idx, screenEntry) {
    if (!this.narrMap) return;
    const segs = this.narrKeySegs.get(this._narrKey(step, role, idx));
    if (segs && segs.length) {
      if (el) el.dataset.narrSeg = segs.join(' ');
      if (screenEntry) screenEntry.segs = segs;
    }
  }

  _buildNarrTranscript(map) {
    const { narrTranscript } = this.dom;
    narrTranscript.innerHTML = '';
    (map.segments || []).forEach((sg, i) => {
      const d = document.createElement('div');
      d.className = 'narr-seg';
      d.dataset.seg = String(i);
      d.textContent = this.redactText(sg.text);
      d.onclick = () => {
        if (!this.narrMap) return;
        if (!this.narrOn) {
          this.narrOn = true;
          this._setNarrPref(false);
          this._setNarrBtnText();
        }
        this.playing = true;
        this.dom.playBtn.textContent = '‖ Pause';
        this.narrAudio.currentTime = sg.start;
        this.narrFF = true;
        this._tryStartNarrAudio();
        this.playLevel(this.cur);
      };
      narrTranscript.appendChild(d);
    });
  }

  async _loadNarration(game, lvl) {
    const key = `${game}:${lvl}`;
    const tok = ++this.narrLoadTok;
    this.narrLevelKey = key;
    this.narrMap = null;
    this.narrOn = false;
    this.activeNarrSeg = -1;
    this.narrAudio.pause();
    this.dom.narrBtn.style.display = 'none';
    this.dom.narrBar.classList.remove('on');
    this.dom.transcriptWrap.style.display = 'none';
    this.dom.narrTranscript.innerHTML = '';
    this._setNarrBtnText();

    try {
      const r = await fetch(`${SUBMODULE_BASE}/narration/${game}/L${lvl}.sync.json`, { cache: 'no-store' });
      if (!r.ok || tok !== this.narrLoadTok) return false;
      const map = await r.json();
      if (tok !== this.narrLoadTok) return false;

      this.narrMap = map;
      this.narrGame = game;
      this.narrLevel = lvl;
      this._buildNarrSchedule(map);

      const audioPath = String(map.audio || `narration/${game}/L${lvl}.mp3`).replace(/^\/+/, '');
      this.narrAudio.src = `${SUBMODULE_BASE}/${audioPath}`;
      this.dom.narrBtn.style.display = '';
      this.dom.narrBar.classList.add('on');
      this._buildNarrTranscript(map);
      this.dom.transcriptWrap.style.display = '';
      this._setNarrTime();

      this.narrOn = !this._narrPrefOff();
      this._setNarrBtnText();
      this._syncAudioButtons();
      return true;
    } catch {
      return false;
    }
  }

  _setNarrTime() {
    const d = this.narrAudio.duration;
    const c = this.narrAudio.currentTime || 0;
    this.dom.narrTime.textContent = `${formatTime(c)} / ${formatTime(d)}`;
    if (isFinite(d) && d > 0) {
      this.dom.narrSeek.max = String(d);
      if (document.activeElement !== this.dom.narrSeek) {
        this.dom.narrSeek.value = String(c);
      }
    }
  }

  _scrollPanelTo(container, el) {
    if (!container || !el) return;
    const cr = container.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.top < cr.top) container.scrollTop += er.top - cr.top;
    else if (er.bottom > cr.bottom) container.scrollTop += er.bottom - cr.bottom;
  }

  _narrHighlight() {
    if (!this.narrMap) return;
    const t = this.narrAudio.currentTime || 0;
    let active = -1;
    (this.narrMap.segments || []).forEach((sg, i) => {
      if (t >= sg.start) active = i;
    });
    this.activeNarrSeg = active;
    const activeText = active >= 0 ? this.redactText(this.narrMap.segments[active].text) : '';
    this.dom.narrSeg.textContent = activeText;

    let first = null;
    this.dom.term.querySelectorAll('[data-narr-seg]').forEach((d) => {
      const on = active >= 0 && d.dataset.narrSeg.split(' ').includes(String(active));
      d.classList.toggle('narr-hl', on);
      if (on && !first) first = d;
    });
    if (first) this._scrollPanelTo(this.dom.term, first);

    let activeSegEl = null;
    for (const d of this.dom.narrTranscript.children) {
      const on = active >= 0 && parseInt(d.dataset.seg, 10) === active;
      d.classList.toggle('active', on);
      if (on) activeSegEl = d;
    }
    if (activeSegEl) this._scrollPanelTo(this.dom.narrTranscript, activeSegEl);
    this._emitScreen();
  }

  _narrClearHL() {
    this.activeNarrSeg = -1;
    this.dom.term.querySelectorAll('[data-narr-seg]').forEach((d) => d.classList.remove('narr-hl'));
    this.dom.narrSeg.textContent = '';
    for (const d of this.dom.narrTranscript.children) d.classList.remove('active');
  }

  _emitScreen() {
    if (!this.onScreenUpdate) return;
    const activeText =
      this.narrMap && this.activeNarrSeg >= 0 && this.narrMap.segments?.[this.activeNarrSeg]
        ? this.redactText(this.narrMap.segments[this.activeNarrSeg].text)
        : '';
    this.onScreenUpdate({
      header: this.screenHeader,
      host: this.screenHost,
      goal: this.screenGoal,
      lines: this.screenLines,
      vim: this.screenVim,
      activeNarrSeg: this.activeNarrSeg,
      narrating: this.narrOn && !this.narrAudio.paused && !this.narrAudio.ended,
      narrCaption: activeText,
    });
  }

  _appendLine(html, cls, colwrap, screenObj) {
    const d = document.createElement('div');
    if (cls) d.className = cls + (colwrap ? ' w100' : '');
    d.innerHTML = html;
    this.dom.term.appendChild(d);
    this.dom.term.scrollTop = this.dom.term.scrollHeight;

    if (screenObj) {
      this.screenLines.push(screenObj);
      if (this.screenLines.length > 260) {
        this.screenLines.splice(0, this.screenLines.length - 260);
      }
      this._emitScreen();
    }
    return d;
  }

  _flatCmds(L) {
    if (!L) return [];
    if (L.steps) return L.steps.map((s) => s.cmd);
    const out = [];
    for (const group of (L.cmds || [])) {
      for (const c of group) out.push(c);
    }
    return out;
  }

  _promptHost(cmd) {
    if (cmd.trim().startsWith('ssh ')) return 'omarchy';
    const G = this.curGame();
    const cmds = this._flatCmds(G?.levels?.[this.cur]);
    if (!cmds.some((c) => c.trim().startsWith('ssh '))) return 'omarchy';
    return G.host || `${this.gameKey}.labs.overthewire.org`;
  }

  async _typeCmd(user, cmd, my, nk) {
    const prompt = `${user}@${this._promptHost(cmd)}:~$ `;
    return this._typeInto(prompt, cmd, my, nk);
  }

  async _typeText(label, text, my, nk) {
    if (nk) await this._narrGate(nk.step, nk.role, nk.idx, my);
    if (my !== this.runId) return;
    const cleanLabel = this.redactText(label);
    const entry = { kind: 'note', text: `── ${cleanLabel} ──`, segs: null };
    const ld = this._appendLine(`<span class="note">── ${escapeHtml(cleanLabel)} ──</span>`, 'note', false, entry);
    if (nk) this._tagNarr(ld, nk.step, nk.role, nk.idx, entry);
    return this._typeInto('', text, my, nk);
  }

  async _typeInto(prompt, cmd, my, nk) {
    if (nk) await this._narrGate(nk.step, nk.role, nk.idx, my);
    if (my !== this.runId) return;

    const cleanCmd = this.redactText(cmd);
    const screenEntry = { kind: 'cmd', prompt, text: '', typing: true, segs: null };
    const d = this._appendLine(
      '<span class="prompt"></span><span class="cmd"></span><span class="cursor"></span>',
      '',
      false,
      screenEntry
    );
    if (nk) this._tagNarr(d, nk.step, nk.role, nk.idx, screenEntry);
    d.querySelector('.prompt').textContent = prompt;
    const span = d.querySelector('.cmd');

    for (let i = 0; i < cleanCmd.length; i++) {
      if (my !== this.runId) return;
      while (!this.playing) {
        await this._sleep();
        if (my !== this.runId) return;
      }
      span.textContent += cleanCmd[i];
      screenEntry.text += cleanCmd[i];
      this.dom.term.scrollTop = this.dom.term.scrollHeight;
      if (i % 2 === 0 || i === cleanCmd.length - 1 || this.narrFF) {
        this._emitScreen();
      }
      await this._delay((24 + Math.random() * 65) * this._speed());
      if (Math.random() < 0.05) await this._delay(200 * this._speed());
    }
    const cur = d.querySelector('.cursor');
    if (cur) cur.remove();
    screenEntry.typing = false;
    this._emitScreen();
    await this._delay(240 * this._speed());
  }

  _vimFileOf(st) {
    const m = /^vim\s+(.+)$/.exec((st.cmd || '').trim());
    if (!m) return null;
    const parts = m[1].trim().split(/\s+/);
    return parts[parts.length - 1] || null;
  }

  _parseVimScreen(out) {
    const lines = {};
    for (const ln of (out || [])) {
      const m = /^\s*(\d+)(?: (.*))?$/.exec(ln);
      if (m) lines[parseInt(m[1], 10)] = m[2] === undefined ? '' : this.redactText(m[2]);
    }
    return lines;
  }

  _buildVimScript(run, firstStep) {
    const actions = [];
    let buf = {};
    const snaps = run.map((s) => this._parseVimScreen(s.out));
    let i = 0;
    while (i < snaps.length) {
      const snap = snaps[i];
      const keys = Object.keys(snap);
      if (keys.length === 0) {
        const rebuilt = {};
        let j = i + 1;
        while (j < snaps.length && Object.keys(snaps[j]).length > 0) {
          Object.assign(rebuilt, snaps[j]);
          j++;
        }
        const bufKeys = Object.keys(buf);
        const same = bufKeys.length > 0 &&
          Object.keys(rebuilt).length === bufKeys.length &&
          Object.keys(rebuilt).every((k) => rebuilt[k] === buf[k]);
        if (same) { i = j; continue; }
        const superset = bufKeys.length > 0 &&
          bufKeys.every((k) => rebuilt[k] === buf[k]) &&
          Object.keys(rebuilt).length > bufKeys.length;
        if (superset) { i++; continue; }
        if (bufKeys.length > 0) { actions.push({ t: 'clear', s: firstStep + i }); buf = {}; }
        i++;
        continue;
      }
      const nums = keys.map(Number).sort((a, b) => a - b);
      for (const n of nums) {
        const kind = snap[n].length > 200 ? 'paste' : 'type';
        if (!(n in buf)) actions.push({ t: kind, n, text: snap[n], s: firstStep + i });
        else if (buf[n] !== snap[n]) actions.push({ t: kind === 'paste' ? 'paste' : 'edit', n, text: snap[n], s: firstStep + i });
        buf[n] = snap[n];
      }
      i++;
    }
    actions.push({ t: 'wq' });
    return actions;
  }

  async _playVimSession(user, file, run, my, firstStep) {
    const VIM_ROWS = 16;
    if (firstStep !== undefined) await this._narrGate(firstStep, 'vimcmd', undefined, my);
    if (my !== this.runId) return;

    this._appendLine(`<span class="note">── editing ${escapeHtml(file)} in vim ──</span>`, 'note', false, {
      kind: 'note',
      text: `── editing ${file} in vim ──`,
    });
    await this._typeCmd(user, `vim ${file}`, my, firstStep === undefined ? undefined : { step: firstStep, role: 'vimcmd' });
    if (my !== this.runId) return;

    const actions = this._buildVimScript(run, firstStep);
    const box = this._appendLine('', '', false, null);
    box.className = 'vimscreen';
    if (firstStep !== undefined && this.narrMap) {
      const segs = [];
      for (let s = firstStep; s < firstStep + run.length; s++) {
        const ss = this.narrKeySegs.get(this._narrKey(s, 'vim'));
        if (ss) for (const x of ss) if (!segs.includes(x)) segs.push(x);
      }
      if (segs.length) box.dataset.narrSeg = segs.join(' ');
    }

    const rowsEl = document.createElement('div');
    const statusEl = document.createElement('div');
    statusEl.className = 'vimstatus';
    const modeEl = document.createElement('div');
    modeEl.className = 'vimmode';
    box.appendChild(rowsEl);
    box.appendChild(statusEl);
    box.appendChild(modeEl);

    const buf = {};
    let topLine = 1;
    let curLine = 1;
    let curCol = 1;
    let dirty = false;

    const gutter = (n) => `${String(n).padStart(3, ' ')} `;
    const ensureVisible = () => {
      if (curLine < topLine) topLine = curLine;
      if (curLine >= topLine + VIM_ROWS) topLine = curLine - VIM_ROWS + 1;
    };

    const render = () => {
      let html = '';
      const vimRowsFor3D = [];
      for (let r = 0; r < VIM_ROWS; r++) {
        const n = topLine + r;
        if (n in buf || n === curLine) {
          const content = n in buf ? buf[n] : '';
          vimRowsFor3D.push({ num: n, text: content, active: n === curLine, col: curCol });
          let inner;
          if (n === curLine) {
            const before = escapeHtml(content.slice(0, curCol - 1));
            const at = escapeHtml(content.slice(curCol - 1, curCol)) || ' ';
            const after = escapeHtml(content.slice(curCol));
            inner = `${before}<span class="vimcursor">${at}</span>${after}`;
          } else {
            inner = escapeHtml(content);
          }
          html += `<div class="vimrow"><span class="vln">${gutter(n)}</span><span class="vlc">${inner}</span></div>`;
        } else {
          vimRowsFor3D.push({ tilde: true });
          html += '<div class="vimrow vimtilde"><span class="vln">    </span><span class="vlc">~</span></div>';
        }
      }
      rowsEl.innerHTML = html;
      const statusTxt = `${file}${dirty ? ' [+]' : ''}   ${curLine},${curCol}   All`;
      statusEl.textContent = statusTxt;
      this.dom.term.scrollTop = this.dom.term.scrollHeight;
      this.screenVim = {
        file,
        rows: vimRowsFor3D,
        status: statusTxt,
        mode: modeEl.textContent,
      };
      this._emitScreen();
    };

    const waitChar = async () => {
      while (!this.playing) {
        await this._sleep();
        if (my !== this.runId) return false;
      }
      if (my !== this.runId) return false;
      await this._delay((10 + Math.random() * 18) * this._speed());
      return my === this.runId;
    };

    const typeChars = async (n, text) => {
      for (let k = 0; k < text.length; k++) {
        buf[n] += text[k];
        curCol++;
        dirty = true;
        if (k % 2 === 0 || k === text.length - 1 || this.narrFF) render();
        if (!(await waitChar())) return false;
      }
      return true;
    };

    render();
    await this._delay(280 * this._speed());
    let lastGated = -1;
    for (const a of actions) {
      if (my !== this.runId) return;
      if (a.s !== undefined && a.s !== lastGated) {
        await this._narrGate(a.s, 'vim', undefined, my);
        if (my !== this.runId) return;
        lastGated = a.s;
      }
      if (a.t === 'clear') {
        for (const k of Object.keys(buf)) delete buf[k];
        topLine = 1; curLine = 1; curCol = 1; dirty = false;
        modeEl.textContent = '';
        render();
        await this._delay(260 * this._speed());
      } else if (a.t === 'paste') {
        buf[a.n] = a.text;
        curLine = a.n; curCol = a.text.length + 1;
        dirty = true;
        ensureVisible();
        modeEl.textContent = '-- INSERT --';
        render();
        await this._delay(260 * this._speed());
      } else if (a.t === 'type') {
        buf[a.n] = '';
        curLine = a.n; curCol = 1;
        ensureVisible();
        modeEl.textContent = '-- INSERT --';
        render();
        if (!(await typeChars(a.n, a.text))) return;
        curLine = a.n + 1; curCol = 1;
        ensureVisible();
        render();
        await this._delay(50 * this._speed());
      } else if (a.t === 'edit') {
        modeEl.textContent = '';
        curLine = a.n; curCol = 1;
        ensureVisible();
        render();
        await this._delay(200 * this._speed());
        if (my !== this.runId) return;
        buf[a.n] = '';
        modeEl.textContent = '-- INSERT --';
        render();
        if (!(await typeChars(a.n, a.text))) return;
        curCol = a.text.length + 1;
        ensureVisible();
        render();
        await this._delay(100 * this._speed());
      } else if (a.t === 'wq') {
        modeEl.textContent = '';
        statusEl.textContent = ':wq';
        this.screenVim = { ...this.screenVim, status: ':wq', mode: '' };
        this._emitScreen();
        await this._delay(360 * this._speed());
        if (my !== this.runId) return;
        dirty = false;
        render();
        await this._delay(180 * this._speed());
      }
    }

    this.screenVim = null;
    this._emitScreen();

    for (const st of run) {
      if (st.note) {
        const cleanNote = this.redactText(st.note);
        this._appendLine(`<span class="note">${escapeHtml(cleanNote)}</span>`, 'note', false, {
          kind: 'note',
          text: cleanNote,
        });
        await this._delay(220 * this._speed());
      }
    }
  }

  async playLevel(idx) {
    const G = this.curGame();
    if (!G || !G.levels || !G.levels.length) {
      this.dom.term.innerHTML = '<div class="note">No solved levels recorded for this mission yet.</div>';
      this.screenHeader = `${G ? G.title.toUpperCase() : 'WARGAMES'} — NO LEVELS YET`;
      this.screenGoal = '';
      this.screenLines = [{ kind: 'note', text: 'No solved levels recorded for this mission yet.' }];
      this.screenVim = null;
      this.dom.hudNowPlaying.textContent = this.screenHeader;
      this.dom.statusBadge.textContent = '0 levels';
      this._emitScreen();
      return;
    }

    const L = G.levels[idx];
    if (!L) return;
    const my = ++this.runId;
    this.cur = idx;
    this.activeSecrets = this._buildSecretList(G, L);

    if (`${this.gameKey}:${L.lvl}` !== this.narrLevelKey) {
      await this._loadNarration(this.gameKey, L.lvl);
    }
    if (my !== this.runId) return;

    const myNarr = this.narrOn && this.narrMap && this.narrGame === this.gameKey && this.narrLevel === L.lvl;
    if (myNarr) {
      this.narrFF = true;
      this._tryStartNarrAudio();
    } else {
      this.narrFF = false;
    }

    const cleanTitle = G.title.replace(/ \(SmashTheStack\)$/, '');
    const titleStr = `${cleanTitle.toUpperCase()} — LEVEL ${L.lvl}`;
    this.screenHeader = titleStr;
    this.screenHost = `${L.user || this.gameKey}@${G.host || 'overthewire.org'}`;
    this.screenLines = [];
    this.screenVim = null;

    this.dom.hudNowPlaying.textContent = titleStr;
    this.dom.termTitle.textContent = `omarchy :: ghostty — ${cleanTitle} L${L.lvl}`;
    this.dom.statusBadge.textContent = `Level ${L.lvl} / ${G.levels[G.levels.length - 1].lvl}`;
    this.dom.jump.value = String(L.lvl);
    const pct = G.levels.length > 1 ? (idx / (G.levels.length - 1)) * 100 : 100;
    this.dom.fill.style.width = `${pct}%`;
    this.dom.term.innerHTML = '';

    await this._narrGate(-1, 'goal', undefined, my);
    if (my !== this.runId) return;

    const desc = this.redactText((G.goals && G.goals[L.lvl]) || L.goal || '');
    this.screenGoal = desc;
    const goalEntry = { kind: 'goal', text: `${titleStr}${desc ? `\n${desc}` : ''}`, segs: null };
    const gd = this._appendLine(
      `${escapeHtml(titleStr)} — PROBLEM STATEMENT${desc ? `\n${this._renderSafeHtml(desc)}` : ''}`,
      'goal',
      false,
      goalEntry
    );
    this._tagNarr(gd, -1, 'goal', undefined, goalEntry);

    const hostTag = `${L.user}@${this._flatCmds(L).some((c) => c.trim().startsWith('ssh ')) ? (G.host || 'bandit.labs.overthewire.org') : 'omarchy'}`;
    this._appendLine(`<span class="note">── ${escapeHtml(hostTag)} ──</span>`, 'note', false, {
      kind: 'note',
      text: `── ${hostTag} ──`,
    });

    await this._delay(420 * this._speed());

    if (L.steps) {
      let si = 0;
      while (si < L.steps.length) {
        if (my !== this.runId) return;
        const st = L.steps[si];
        const vf = this._vimFileOf(st);
        if (vf) {
          const firstSi = si;
          const run = [];
          while (si < L.steps.length && this._vimFileOf(L.steps[si]) === vf) {
            run.push(L.steps[si]);
            si++;
          }
          await this._playVimSession(L.user, vf, run, my, firstSi);
          continue;
        }
        if (st.text) {
          await this._typeText(st.text, st.cmd, my, { step: si, role: 'text' });
        } else if (st.cmd.startsWith('#')) {
          await this._narrGate(si, 'note', undefined, my);
          if (my !== this.runId) return;
          const clean = this.redactText(st.cmd);
          const entry = { kind: 'note', text: clean, segs: null };
          const nd = this._appendLine(`<span class="note">${escapeHtml(clean)}</span>`, 'note', false, entry);
          this._tagNarr(nd, si, 'note', undefined, entry);
          await this._delay(360 * this._speed());
        } else {
          await this._typeCmd(L.user, st.cmd, my, { step: si, role: 'cmd' });
        }

        for (let oi = 0; oi < (st.out || []).length; oi++) {
          const rawOut = st.out[oi];
          if (my !== this.runId) return;
          await this._narrGate(si, 'out', oi, my);
          if (my !== this.runId) return;
          const cleanOut = this.redactText(rawOut);
          const entry = { kind: 'out', text: cleanOut, segs: null };
          const od = this._appendLine(this._renderSafeHtml(cleanOut), 'out', expandTabs(cleanOut).length > 100, entry);
          this._tagNarr(od, si, 'out', oi, entry);
          await this._delay(130 * this._speed());
        }

        if (st.note) {
          await this._narrGate(si, 'note', undefined, my);
          if (my !== this.runId) return;
          const cleanNote = this.redactText(st.note);
          const entry = { kind: 'note', text: cleanNote, segs: null };
          const nd = this._appendLine(`<span class="note">${escapeHtml(cleanNote)}</span>`, 'note', false, entry);
          this._tagNarr(nd, si, 'note', undefined, entry);
          await this._delay(220 * this._speed());
        }
        si++;
      }
    } else if (L.cmds) {
      for (const group of L.cmds) {
        for (const c of group) {
          if (my !== this.runId) return;
          if (c.startsWith('#')) {
            const clean = this.redactText(c);
            this._appendLine(`<span class="note">${escapeHtml(clean)}</span>`, 'note', false, {
              kind: 'note',
              text: clean,
            });
            await this._delay(360 * this._speed());
          } else {
            await this._typeCmd(L.user, c, my);
          }
        }
      }
      for (const o of (L.out || [])) {
        if (my !== this.runId) return;
        const cleanOut = this.redactText(o);
        this._appendLine(this._renderSafeHtml(cleanOut), 'out', expandTabs(cleanOut).length > 100, {
          kind: 'out',
          text: cleanOut,
        });
        await this._delay(130 * this._speed());
      }
    }

    // Never render any OverTheWire password — show redacted marker in its slot
    if (L.pw) {
      await this._narrGate(-1, 'pw', undefined, my);
      if (my !== this.runId) return;
      const entry = { kind: 'pw', text: 'Next level credential verified: [REDACTED]', segs: null };
      const pd = this._appendLine(
        'Next level credential verified: <span class="redacted">[REDACTED]</span>',
        'out',
        false,
        entry
      );
      this._tagNarr(pd, -1, 'pw', undefined, entry);
    }

    if (L.note) {
      const cleanNote = this.redactText(L.note);
      this._appendLine(`<span class="note">${escapeHtml(cleanNote)}</span>`, 'note', false, {
        kind: 'note',
        text: cleanNote,
      });
    }

    await this._delay(1200 * this._speed());
    if (my !== this.runId) return;
    if (!myNarr && idx + 1 < G.levels.length && this.playing) {
      this.playLevel(idx + 1);
    } else if (!myNarr && idx + 1 >= G.levels.length) {
      this.dom.statusBadge.textContent = `${cleanTitle} Complete`;
    }
  }
}
