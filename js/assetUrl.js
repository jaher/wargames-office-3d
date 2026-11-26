// Centralized cache-busting URL helper driven by window.__ASSET_VERSION__
// (stamped automatically into index.html on every commit and GitHub Pages deploy).

export function getAssetVersion() {
  return (typeof window !== 'undefined' && typeof window.__ASSET_VERSION__ === 'string')
    ? window.__ASSET_VERSION__.trim()
    : '';
}

export function versionedUrl(url, extraParams = null) {
  if (!url || /^(?:https?:|data:|blob:|mailto:)/i.test(url)) {
    return url;
  }
  const [base, existingQuery = ''] = url.split('?');
  const params = new URLSearchParams(existingQuery);
  const v = getAssetVersion();
  if (v && !params.has('v')) {
    params.set('v', v);
  }
  if (extraParams) {
    for (const [k, val] of Object.entries(extraParams)) {
      if (val !== undefined && val !== null && val !== '') {
        params.set(k, String(val));
      }
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
