export function formatDistance(meters?: number) {
  if (meters === undefined) {
    return 'Nearby';
  }

  if (meters < 1000) {
    return `${meters} m away`;
  }

  return `${(meters / 1000).toFixed(1)} km away`;
}

export function formatFileSize(bytes?: number | null) {
  if (!bytes) {
    return 'Size unavailable';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size = size / 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
