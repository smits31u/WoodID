export const colors = {
  background: '#18110D',
  backgroundElevated: '#241A14',
  surface: '#2C201A',
  surfaceAlt: '#382A21',
  border: '#41302480',

  accent: '#CB8A45',
  accentPressed: '#AD7333',
  accentMuted: '#8A6438',

  textPrimary: '#F4EBDF',
  textSecondary: '#C4AE97',
  textMuted: '#8C7864',

  overlay: '#0D0906CC',

  success: '#7FA65C',
  warning: '#D9A441',
  danger: '#C1543D',
} as const;

export const statusColors: Record<string, string> = {
  'least concern': colors.success,
  'lower risk': colors.success,
  'near threatened': colors.warning,
  vulnerable: colors.warning,
  threatened: colors.warning,
  endangered: colors.danger,
  'critically endangered': colors.danger,
  extinct: colors.danger,
};

export function getStatusColor(status: string | null | undefined): string {
  if (!status) {
    return colors.textSecondary;
  }
  return statusColors[status.trim().toLowerCase()] ?? colors.textSecondary;
}
