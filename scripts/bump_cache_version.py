#!/usr/bin/env python3
"""Stamp a deterministic cache-busting asset version into index.html.

Usage:
  python3 scripts/bump_cache_version.py                # Computes 10-char SHA-256 content hash of site assets
  python3 scripts/bump_cache_version.py <version_tag>  # Stamps an explicit version (e.g. ${GITHUB_SHA::10} in CI)

Updates:
  - <meta name="asset-version" content="VER">
  - window.__ASSET_VERSION__ = 'VER';
  - All local ./js/*.js entries inside <script type="importmap">
  - All local ?v=... query parameters in index.html (CSS, preloads, modulepreloads, entry script)
"""
import glob
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INDEX_PATH = os.path.join(ROOT, "index.html")


def normalize_index_for_hash(html):
    html = re.sub(r'(<meta\s+name="asset-version"\s+content=")[^"]+(")', r"\1__VER__\2", html)
    html = re.sub(r"(window\.__ASSET_VERSION__\s*=\s*')[^']+(';)", r"\1__VER__\2", html)
    html = re.sub(r"(\?v=)[A-Za-z0-9._-]+", r"\1__VER__", html)
    return html


def compute_content_version():
    h = hashlib.sha256()
    patterns = [
        "css/**/*.css",
        "js/**/*.js",
        "assets/models/*.glb",
        "assets/textures/*",
    ]
    files = set()
    for pat in patterns:
        for p in glob.glob(os.path.join(ROOT, pat), recursive=True):
            if os.path.isfile(p):
                files.add(os.path.relpath(p, ROOT))

    # Hash normalized index.html first
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        norm_html = normalize_index_for_hash(f.read())
    h.update(b"index.html\0")
    h.update(norm_html.encode("utf-8"))
    h.update(b"\0")

    for rel in sorted(files):
        h.update(rel.encode("utf-8"))
        h.update(b"\0")
        with open(os.path.join(ROOT, rel), "rb") as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                h.update(chunk)
        h.update(b"\0")

    # Include overthewire-solutions submodule commit SHA so submodule updates bust solution/narration caches too
    try:
        sub_sha = subprocess.check_output(
            ["git", "-C", os.path.join(ROOT, "overthewire-solutions"), "rev-parse", "HEAD"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        h.update(b"submodule:overthewire-solutions\0")
        h.update(sub_sha.encode("utf-8"))
    except Exception:
        pass

    return h.hexdigest()[:10]


def stamp_index(version):
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        html = f.read()

    # 1. Update <meta name="asset-version"> and window.__ASSET_VERSION__
    html, n_meta = re.subn(
        r'(<meta\s+name="asset-version"\s+content=")[^"]+(")',
        rf"\g<1>{version}\2",
        html,
    )
    html, n_win = re.subn(
        r"(window\.__ASSET_VERSION__\s*=\s*')[^']+(';)",
        rf"\g<1>{version}\2",
        html,
    )
    assert n_meta == 1 and n_win == 1, f"Missing asset-version markers in index.html (meta={n_meta}, win={n_win})"

    # 2. Rebuild local ./js/*.js importmap entries so every local ES module (including newly added ones!) is versioned
    local_js = sorted(
        os.path.relpath(p, ROOT).replace(os.sep, "/")
        for p in glob.glob(os.path.join(ROOT, "js", "*.js"))
        if os.path.isfile(p)
    )

    def rewrite_importmap(m):
        head, body, tail = m.group(1), m.group(2), m.group(3)
        data = json.loads(body)
        imports = data.get("imports", {})
        # Keep non-local imports (three, three/addons/, etc.) in their existing order
        new_imports = {k: v for k, v in imports.items() if not k.startswith("./js/")}
        for rel in local_js:
            new_imports[f"./{rel}"] = f"./{rel}?v={version}"
        data["imports"] = new_imports
        formatted = json.dumps(data, indent=2)
        indented = "\n".join("    " + line for line in formatted.splitlines())
        return f"{head}\n{indented}\n  {tail}"

    html, n_im = re.subn(
        r'(<script\s+type="importmap">)([\s\S]*?)(</script>)',
        rewrite_importmap,
        html,
        count=1,
    )
    assert n_im == 1, "Missing <script type=\"importmap\"> in index.html"

    # 3. Update all remaining local ?v=... query parameters in HTML tags (CSS, preloads, modulepreloads, script src)
    html = re.sub(r"(\?v=)[A-Za-z0-9._-]+", rf"\g<1>{version}", html)

    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        f.write(html)


def main():
    if len(sys.argv) > 1 and sys.argv[1].strip():
        ver = re.sub(r"[^A-Za-z0-9._-]", "", sys.argv[1].strip())[:16]
        if not ver:
            raise SystemExit("Invalid version argument")
    else:
        ver = compute_content_version()

    stamp_index(ver)
    print(f"Stamped cache-busting asset version: {ver}")


if __name__ == "__main__":
    main()
