export const colors = {
  background: '#0F1115',
  surface: '#171A21',
  card: '#1E222B',
  border: '#2A2F3A',
  textPrimary: '#E6E8EE',
  textSecondary: '#A0A6B2',
  textMuted: '#6B7280',
  gradientFrom: '#F15FA5',
  gradientVia: '#8B6CFF',
  gradientTo: '#4FA3FF',
  success: '#4ADE80',
  warning: '#FACC15',
  error: '#F87171',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 12,
  md: 14,
  lg: 16,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 14},
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 6,
  },
} as const;

export const glass = {
  card: {
    backgroundColor: 'rgba(30, 34, 43, 0.74)',
    borderColor: 'rgba(230, 232, 238, 0.08)',
  },
  surface: {
    backgroundColor: 'rgba(23, 26, 33, 0.72)',
    borderColor: 'rgba(230, 232, 238, 0.07)',
  },
  highlight: {
    backgroundColor: 'rgba(139, 108, 255, 0.16)',
    borderColor: 'rgba(143, 126, 255, 0.22)',
  },
} as const;
