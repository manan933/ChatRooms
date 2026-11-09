// Robust Central File & Avatar URL Resolver
export const getFileUrl = (url) => {
  if (!url) return '';
  if (typeof url === 'object') {
    if (url.url) return getFileUrl(url.url);
    if (url.dataUrl) return getFileUrl(url.dataUrl);
    if (url.src) return getFileUrl(url.src);
    return '';
  }
  if (typeof url !== 'string') return String(url);
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

// Immediate global safeguard
if (typeof window !== 'undefined') {
  window.getFileUrl = getFileUrl;
}
if (typeof globalThis !== 'undefined') {
  globalThis.getFileUrl = getFileUrl;
}

export default getFileUrl;
