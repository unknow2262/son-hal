export const colors = {
  primary: '#7DCEE9',
  primaryHover: '#65B8D3',
  secondary: '#A8D08D',
  secondaryHover: '#8EBB72',
  accent: '#B9A4EE',
  base: '#DFE9EE',
  surface: '#FFFFFF',
  surfaceElevated: '#F2F6F9',
  chatAi: '#F2F6F9',
  textMain: '#1A202C',
  textMuted: '#8F9BB3',
  textInverse: '#FFFFFF',
  borderLight: '#EDF1F5',
  borderMedium: '#E2E8F0',
  success: '#A8D08D',
  warning: '#F6D365',
  error: '#F15C5C',
  info: '#7DCEE9',
};

export const radius = { sm: 12, md: 16, lg: 24, xl: 32, pill: 9999 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const shadows = {
  card: {
    shadowColor: '#A0AEC0',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
  floating: {
    shadowColor: '#A0AEC0',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 6,
  },
};

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
