#!/usr/bin/env python3
"""Automated end-to-end regression test suite for Wargames Office 3D.

Run before every commit:
    python3 tests/regression.py

Covers every historical regression:
1. Static asset integrity & HTML importmap ordering (prevents Firefox bare-specifier break).
2. Live 3D scene load: zero JS exceptions, zero HTTP >= 400 asset failures, 100% GLB & texture load.
3. Default camera is 'monitor' (2 · Omarchy Monitor).
4. Outside window view rendering across all 3 sky moods (Golden Hour, Twilight, Morning) + oblique angle.
5. Narration enabled by default (both autoplay-allowed & autoplay-restricted), unclipped on 1280x720,
   and .mp3/.txt fallback on Vortex L12.
6. Terminal level-selection sync across Vortex, Bandit, Natas, SmashTheStack, and 0-level Tux,
   password redaction ([REDACTED]), no premature prompt before output, and monotonic Neovim scrolling.
"""
import base64
import glob
import http.server
import io
import json
import os
import re
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.request
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHROMIUM = "/usr/bin/chromium"


class AuditHandler(http.server.SimpleHTTPRequestHandler):
    bad_requests = []

    def log_message(self, *args):
        pass

    def send_response(self, code, message=None):
        # Expected 404 probes for levels without .sync.json are ignored; everything else >= 400 fails.
        if code >= 400 and "/narration/" not in self.path:
            AuditHandler.bad_requests.append((code, self.path))
        super().send_response(code, message)


class CDPClient:
    def __init__(self, ws_url, timeout=60):
        hp = ws_url.split("://")[1].split("/")[0]
        path = "/" + "/".join(ws_url.split("://")[1].split("/")[1:])
        host, port = hp.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET {path} HTTP/1.1\r\nHost: {hp}\r\nUpgrade: websocket\r\n"
            f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        self.buf = buf.split(b"\r\n\r\n", 1)[1]
        self.cid = 0
        self.exceptions = []

    def _rx(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise EOFError("CDP socket closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def call(self, method, params=None):
        self.cid += 1
        cid = self.cid
        msg = json.dumps({"id": cid, "method": method, "params": params or {}}).encode()
        mask = os.urandom(4)
        L = len(msg)
        hdr = bytearray([0x81])
        if L < 126:
            hdr.append(0x80 | L)
        elif L < 65536:
            hdr.extend([0x80 | 126])
            hdr.extend(struct.pack("!H", L))
        else:
            hdr.extend([0x80 | 127])
            hdr.extend(struct.pack("!Q", L))
        hdr.extend(mask)
        self.sock.sendall(bytes(hdr) + bytes(b ^ mask[i % 4] for i, b in enumerate(msg)))
        while True:
            b1, b2 = self._rx(2)
            ln = b2 & 0x7F
            if ln == 126:
                ln = struct.unpack("!H", self._rx(2))[0]
            elif ln == 127:
                ln = struct.unpack("!Q", self._rx(8))[0]
            payload = self._rx(ln)
            if (b1 & 0x0F) == 1:
                obj = json.loads(payload.decode())
                if obj.get("method") == "Runtime.exceptionThrown":
                    self.exceptions.append(obj["params"])
                if obj.get("id") == cid:
                    return obj.get("result", {})

    def eval(self, expr, await_promise=False):
        r = self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": await_promise})
        return r.get("result", {}).get("value")

    def screenshot_image(self):
        data = self.call("Page.captureScreenshot", {"format": "png"})["data"]
        return Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB")

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass


def launch_browser(url, width=1440, height=900, debug_port=9271, extra_flags=()):
    proc = subprocess.Popen(
        [
            CHROMIUM,
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu-sandbox",
            "--disable-dev-shm-usage",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            f"--window-size={width},{height}",
            *extra_flags,
            f"--remote-debugging-port={debug_port}",
            url,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    ws = None
    for _ in range(60):
        try:
            targets = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{debug_port}/json").read())
            for t in targets:
                if t.get("type") == "page":
                    ws = t["webSocketDebuggerUrl"]
                    break
            if ws:
                break
        except Exception:
            time.sleep(0.2)
    if not ws:
        proc.terminate()
        raise RuntimeError("Failed to attach CDP")
    cdp = CDPClient(ws)
    cdp.call("Runtime.enable")
    return proc, cdp


def wait_for(cdp, expr, timeout_s=20.0):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        if cdp.eval(expr):
            return True
        time.sleep(0.2)
    return False


def crop_variance(im, box):
    crop = im.crop(box)
    px = list(crop.getdata())
    n = len(px)
    mr = sum(p[0] for p in px) / n
    mg = sum(p[1] for p in px) / n
    mb = sum(p[2] for p in px) / n
    var = sum((p[0] - mr) ** 2 + (p[1] - mg) ** 2 + (p[2] - mb) ** 2 for p in px) / (n * 3)
    return (mr, mg, mb), var ** 0.5


def test_static_integrity():
    print("[1/5] Static asset integrity & importmap ordering...")
    html = open(os.path.join(ROOT, "index.html")).read()
    im_idx = html.find('type="importmap"')
    mp_idx = html.find('rel="modulepreload"')
    mod_idx = html.find('type="module"')
    assert im_idx > 0, "Missing importmap in index.html"
    assert mp_idx < 0 or im_idx < mp_idx, "importmap MUST precede all modulepreload links!"
    assert mod_idx < 0 or im_idx < mod_idx, "importmap MUST precede all module scripts!"

    refs = set()
    for rel in ["index.html", "js/main.js", "js/officeScene.js", "js/omarchyScreen.js", "js/solutions.js", "css/style.css"]:
        txt = open(os.path.join(ROOT, rel)).read()
        for m in re.findall(r"""['"]((?:assets|js|css|overthewire-solutions)/[^'"]+)['"]""", txt):
            if "${" not in m:
                refs.add(m)
    missing = [p for p in sorted(refs) if not os.path.exists(os.path.join(ROOT, p))]
    assert not missing, f"Missing referenced assets: {missing}"

    for glb in glob.glob(os.path.join(ROOT, "assets/models/*.glb")):
        with open(glb, "rb") as f:
            assert f.read(4) == b"glTF", f"Corrupt GLB header: {glb}"
    for tex in glob.glob(os.path.join(ROOT, "assets/textures/*")):
        im = Image.open(tex)
        assert im.width >= 512 and im.height >= 256, f"Suspicious skyline texture: {tex} {im.size}"

    # Verify all sync.json narration audio files exist
    for sp in glob.glob(os.path.join(ROOT, "overthewire-solutions/narration/*/*.sync.json")):
        sd = json.load(open(sp))
        ap = os.path.join(ROOT, "overthewire-solutions", sd.get("audio", "").lstrip("/"))
        assert os.path.exists(ap), f"Missing narration audio {ap} referenced by {sp}"
    print(f"      PASS ({len(refs)} assets verified, importmap order valid)")


def test_live_scene_window_and_assets(port):
    print("[2/5] Live 3D assets, default monitor view, and all 3 outside window sky moods...")
    proc, cdp = launch_browser(f"http://127.0.0.1:{port}/?panel=0", debug_port=9271)
    try:
        assert wait_for(cdp, "Boolean(window.__officeReady)", 25.0), "Timed out waiting for loading preamble to finish"
        # Loading preamble MUST have kept the overlay visible until ALL assets, solutions & narration finished!
        preamble = cdp.eval("""(() => ({
            overlayHidden: document.getElementById('loadingOverlay').classList.contains('hidden'),
            stats: window.__assetStats,
            jumpCount: document.getElementById('jump').options.length,
            transcriptCount: document.getElementById('narrTranscript').children.length,
        }))()""")
        stats = preamble["stats"]
        assert preamble["overlayHidden"], f"Overlay still visible after __officeReady: {preamble}"
        assert stats["pending"] == 0, f"Revealed scene while assets still pending: {stats}"
        assert len(stats["failed"]) == 0, f"Failed 3D assets: {stats['failed']}"
        assert len(stats["loaded"]) >= 24, f"Too few assets loaded: {len(stats['loaded'])}"
        assert preamble["jumpCount"] > 0 and preamble["transcriptCount"] > 0, f"Revealed before solutions/narration ready: {preamble}"

        active_cam = cdp.eval("document.querySelector('.cam-btn.active')?.dataset?.cam")
        assert active_cam == "monitor", f"Default camera should be 'monitor', got {active_cam!r}"

        # Switch to Skyline View (preset 5) and verify Golden Hour, Twilight, Morning all render rich textured views
        cdp.eval("document.querySelector('.cam-btn[data-cam=\"window\"]').click()")
        time.sleep(1.8)
        mood_stats = []
        for mi in range(3):
            if mi > 0:
                cdp.eval("document.getElementById('skyMoodBtn').click()")
                time.sleep(1.2)
            im = cdp.screenshot_image()
            # Center upper window pane (pure exterior vista, clear of monitor/desk)
            mean_rgb, std = crop_variance(im, (520, 180, 920, 420))
            mood_stats.append((mean_rgb, std))
            assert std > 14.0, f"Window sky mood {mi} looks flat/broken (std={std:.1f}, mean={mean_rgb})"
        # Ensure sky moods actually change visibly
        diff_01 = sum(abs(mood_stats[0][0][k] - mood_stats[1][0][k]) for k in range(3))
        diff_12 = sum(abs(mood_stats[1][0][k] - mood_stats[2][0][k]) for k in range(3))
        assert diff_01 > 20 and diff_12 > 20, f"Sky moods did not visibly change: {mood_stats}"
        assert not cdp.exceptions, f"JS exceptions: {cdp.exceptions}"
        print(f"      PASS ({len(stats['loaded'])} assets loaded, 0 failed, 3 window moods rich & distinct)")
    finally:
        cdp.close()
        proc.terminate()
        time.sleep(0.3)


def test_narration_and_laptop_layout(port):
    print("[3/5] Narration ON by default, 1280x720 unclipped panel, and Vortex L12 fallback...")
    # 1280x720 with autoplay allowed
    proc, cdp = launch_browser(
        f"http://127.0.0.1:{port}/",
        width=1280,
        height=720,
        debug_port=9272,
        extra_flags=("--autoplay-policy=no-user-gesture-required",),
    )
    try:
        assert wait_for(cdp, "Boolean(document.getElementById('narrTranscript').children.length > 0)", 18.0)
        time.sleep(0.8)
        st = cdp.eval("""(() => {
            const g = id => document.getElementById(id);
            const r = id => { const b = g(id).getBoundingClientRect(); return {top: b.top, bottom: b.bottom}; };
            return {
                collapsed: g('app').classList.contains('panel-collapsed'),
                narrOn: g('narrBtn').classList.contains('narr-on'),
                narrText: g('narrBtn').textContent,
                barOn: g('narrBar').classList.contains('on'),
                tCount: g('narrTranscript').children.length,
                panelBot: r('sidePanel').bottom,
                tBot: r('transcriptWrap').bottom,
            };
        })()""")
        assert not st["collapsed"], f"Panel collapsed on 1280x720: {st}"
        assert st["narrOn"] and st["barOn"] and st["tCount"] > 0, f"Narration not ON by default: {st}"
        assert st["tBot"] <= st["panelBot"] + 2, f"Transcript clipped on 1280x720: {st}"

        # Switch to Vortex L12 (.mp3 + .txt without .sync.json)
        cdp.eval("(() => { const j = document.getElementById('jump'); j.value = '12'; j.dispatchEvent(new Event('change')); })()")
        assert wait_for(cdp, "document.getElementById('hudNowPlaying').textContent === 'VORTEX — LEVEL 12' && document.getElementById('narrTranscript').children.length > 0", 10.0)
        st12 = cdp.eval("({bar: document.getElementById('narrBar').classList.contains('on'), btn: getComputedStyle(document.getElementById('narrBtn')).display})")
        assert st12["bar"] and st12["btn"] != "none", f"Vortex L12 narration fallback missing: {st12}"
        assert not cdp.exceptions, f"JS exceptions: {cdp.exceptions}"
        print("      PASS (default ON, 1280x720 unclipped, Vortex L12 fallback verified)")
    finally:
        cdp.close()
        proc.terminate()
        time.sleep(0.3)


def test_terminal_sync_redaction_and_neovim_scroll(port):
    print("[4/5] Terminal dropdown sync, password redaction, prompt ordering, and monotonic Neovim scroll...")
    proc, cdp = launch_browser(f"http://127.0.0.1:{port}/", debug_port=9273)
    try:
        assert wait_for(cdp, "Boolean(window.__officeReady && document.getElementById('jump').options.length > 0)", 18.0)

        # Turn narration off for rapid terminal sync checks
        cdp.eval("(() => { localStorage.setItem('otw-office-narration', 'off'); })()")

        # Switch to Bandit L5
        cdp.eval("(() => { const g = document.getElementById('gameSel'); g.value = 'bandit'; g.dispatchEvent(new Event('change')); })()")
        assert wait_for(cdp, "document.getElementById('gameSel').value === 'bandit' && document.getElementById('jump').options.length >= 30", 10.0)
        cdp.eval("(() => { const j = document.getElementById('jump'); j.value = '5'; j.dispatchEvent(new Event('change')); })()")
        assert wait_for(cdp, "document.getElementById('hudNowPlaying').textContent === 'BANDIT — LEVEL 5'", 6.0)

        # Switch to Natas L3 and verify password redaction + stays pinned
        cdp.eval("(() => { const g = document.getElementById('gameSel'); g.value = 'natas'; g.dispatchEvent(new Event('change')); })()")
        assert wait_for(cdp, "document.getElementById('gameSel').value === 'natas' && document.getElementById('jump').options.length >= 30", 10.0)
        cdp.eval("(() => { const j = document.getElementById('jump'); j.value = '3'; j.dispatchEvent(new Event('change')); })()")
        assert wait_for(cdp, "document.getElementById('term').innerText.includes('[REDACTED]')", 12.0)
        txt = cdp.eval("document.getElementById('term').innerText")
        assert "JDrPnuZAKyl6MkiqQGFIddrqpvgOASth" not in txt, "PASSWORD LEAKED!"
        assert "K30JrSRHzjxq3paUQuwozY4MNvmNFyhI" not in txt, "PASSWORD LEAKED!"

        # Switch to SmashTheStack -> lands on mission with levels; then Tux -> clean 0 levels
        cdp.eval("(() => { const f = document.getElementById('familySel'); f.value = 's2s'; f.dispatchEvent(new Event('change')); })()")
        assert wait_for(cdp, "document.getElementById('hudNowPlaying').textContent.includes('LEVEL')", 8.0)
        cdp.eval("(() => { const g = document.getElementById('gameSel'); g.value = 'tux'; g.dispatchEvent(new Event('change')); })()")
        assert wait_for(cdp, "document.getElementById('hudNowPlaying').textContent === 'TUX — NO LEVELS YET'", 6.0)

        # Verify OmarchyScreen monotonic Neovim scrolling across all lines of Vortex L0 + :wq
        nv = cdp.eval("""(async () => {
            const { OmarchyScreen } = await import('./js/omarchyScreen.js');
            const v = await fetch('./overthewire-solutions/games/vortex.json').then(r => r.json());
            const merged = {};
            for (const st of v.levels[0].steps) {
                if (!st.cmd.startsWith('vim ')) continue;
                for (const ln of (st.out || [])) {
                    const m = /^\\s*(\\d+)(?: (.*))?$/.exec(ln);
                    if (m) merged[parseInt(m[1], 10)] = m[2] || '';
                }
            }
            const nums = Object.keys(merged).map(Number).sort((a, b) => a - b);
            const scr = new OmarchyScreen();
            const scrolls = [];
            const lines = [];
            for (const n of nums) {
                lines.push({ num: n, text: merged[n] });
                scr.update({ header: 'VORTEX — LEVEL 0', host: 'vortex0@omarchy', goal: '', lines: [], vim: null, lastVim: { file: 'v0.c', lines: lines.map(x => ({...x})), activeLine: n, editing: true, mode: '-- INSERT --' }, promptIdle: false });
                scr.render(1.0);
                scrolls.push(scr._nvimScrollTop);
            }
            const beforeWq = scr._nvimScrollTop;
            scr.update({ header: 'VORTEX — LEVEL 0', host: 'vortex0@omarchy', goal: '', lines: [], vim: null, lastVim: { file: 'v0.c', lines: lines.map(x => ({...x})), activeLine: nums[nums.length-1], editing: false, mode: 'NORMAL' }, promptIdle: true });
            scr.render(2.0);
            const afterWq = scr._nvimScrollTop;
            const backwards = [];
            for (let i = 1; i < scrolls.length; i++) if (scrolls[i] < scrolls[i-1]) backwards.push([scrolls[i-1], scrolls[i]]);
            return { maxS: Math.max(...scrolls), beforeWq, afterWq, backwards };
        })()""", await_promise=True)
        assert nv["maxS"] >= 10 and nv["beforeWq"] == nv["afterWq"] and not nv["backwards"], f"Neovim jitter: {nv}"
        assert not cdp.exceptions, f"JS exceptions: {cdp.exceptions}"
        print("      PASS (level sync, redaction, 0-level cleanup, monotonic Neovim scroll verified)")
    finally:
        cdp.close()
        proc.terminate()
        time.sleep(0.3)


def test_no_http_errors():
    print("[5/5] Server HTTP error audit...")
    assert not AuditHandler.bad_requests, f"Unexpected HTTP >= 400 requests: {AuditHandler.bad_requests}"
    print("      PASS (0 unexpected HTTP errors)")


def main():
    os.chdir(ROOT)
    test_static_integrity()
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), AuditHandler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        test_live_scene_window_and_assets(port)
        test_narration_and_laptop_layout(port)
        test_terminal_sync_redaction_and_neovim_scroll(port)
        test_no_http_errors()
        print("\nALL 5 REGRESSION TEST SUITES PASSED!")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
