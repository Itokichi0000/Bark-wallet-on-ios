export const theme = {
  colors: {
    background: "#0D0918",
    backgroundRaised: "#1B1430",
    panel: "rgba(39, 28, 62, 0.88)",
    panelSolid: "#271C3E",
    primary: "#B79AFF",
    primaryStrong: "#9464FF",
    outline: "#8D71B7",
    text: "#F6F1FF",
    textMuted: "#B5A9CA",
    bitcoin: "#F7931A",
    success: "#6FD7AA",
    danger: "#FF7D96",
    warning: "#F6C36E",
    disabled: "#615671",
  },
  radius: { sm: 10, md: 16, lg: 24, pill: 999 },
  motion: { tapMs: 140, menuOpenMs: 350, sceneMs: 500, idleCycleMs: 5500 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
} as const;

export type Theme = typeof theme;
