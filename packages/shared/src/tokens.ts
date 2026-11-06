/** Brand tokens — "Órbita conectada". Single source of truth for app colors, type and shape. */
export const colors = {
  selva: "#1B5E20",
  selvaDeep: "#0C3010",
  lima: "#AED581",
  limaSoft: "#DCEDC8",
  pasto: "#7CB342",
  hoja: "#2E7D32",
  tierra: "#6D4C41",
  tierraSoft: "#EFE8E5",
  crema: "#F7F5EF",
  card: "#FFFFFF",
  tint: "#F1F7EC",
  line: "#E6ECDF",
  text: "#1F2A1F",
  textMuted: "#5B635E",
  onDark: "#FFFFFF",
  onDarkMuted: "#C8E6C9",
  warn: "#8A5A00",
  warnSoft: "#FFF4D6",
  danger: "#B71C1C",
  dangerSoft: "#FDECEC",
  info: "#0D47A1",
  infoSoft: "#E3F0FC",
  rosa: "#9C1C3B",
  rosaSoft: "#FCE8EC",
  // From the mockups
  link: "#2E7D32",
  outline: "#DCE5D3",
  urgent: "#D32F2F",
  urgentText: "#7F1D1D",
  signal: "#FFE082",
  signalText: "#4A3500",
  ring: "#C5E1A5",
  grip: "#E0DBD0",
  sand: "#F1EEE6",
  scrim: "rgba(15,25,17,0.5)",
  glass: "rgba(255,255,255,0.12)",
  glassLine: "rgba(255,255,255,0.3)",
  tierraDeep: "#4E342E",
  greenSoft: "#E8F5E9",
  amberText: "#5C3F00",
} as const;

export const fonts = {
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
  extrabold: "Outfit_800ExtraBold",
} as const;

export const radius = { sm: 14, md: 20, lg: 24, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Card shadow from the mockups: 0 1px 2px + 0 8px 22px of selva at ~7 %. */
export const shadow = {
  shadowColor: colors.selva,
  shadowOpacity: 0.09,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
