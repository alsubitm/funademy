/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#F7FAFF",
      "foreground": "#101A38",
      "border": "#DFE5F2",
      "card": "#FFFFFF",
      "cardForeground": "#101A38",
      "popover": "#FFFFFF",
      "popoverForeground": "#101A38",
      "primary": "#1C54CB",
      "primaryForeground": "#FFFFFF",
      "secondary": "#EAF1FF",
      "secondaryForeground": "#11388E",
      "muted": "#EFF3FB",
      "mutedForeground": "#5F6B92",
      "accent": "#FFCA17",
      "accentForeground": "#101A38",
      "destructive": "#D64545",
      "destructiveForeground": "#FFFFFF",
      "input": "#DFE5F2",
      "ring": "#1C54CB",
      "chart1": "#1C54CB",
      "chart2": "#FFCA17",
      "chart3": "#22DAFF",
      "chart4": "#8B5CF6",
      "chart5": "#FF7A59",
      "sidebar": "#091D52",
      "sidebarForeground": "#E8EEFF",
      "sidebarBorder": "#11388E",
      "sidebarPrimary": "#FFCA17",
      "sidebarPrimaryForeground": "#101A38",
      "sidebarAccent": "#11388E",
      "sidebarAccentForeground": "#FFFFFF",
      "sidebarRing": "#22DAFF"
    },
    "dark": {
      "background": "#051036",
      "foreground": "#F2F6FF",
      "border": "#1B2B5E",
      "card": "#091D52",
      "cardForeground": "#F2F6FF",
      "popover": "#091D52",
      "popoverForeground": "#F2F6FF",
      "primary": "#5B8AF5",
      "primaryForeground": "#051036",
      "secondary": "#11388E",
      "secondaryForeground": "#E8EEFF",
      "muted": "#0D2453",
      "mutedForeground": "#8FA2CE",
      "accent": "#FFCA17",
      "accentForeground": "#101A38",
      "destructive": "#E15656",
      "destructiveForeground": "#FFF5F5",
      "input": "#1B2B5E",
      "ring": "#5B8AF5",
      "chart1": "#5B8AF5",
      "chart2": "#FFD84D",
      "chart3": "#22DAFF",
      "chart4": "#A78BFA",
      "chart5": "#FF9A76",
      "sidebar": "#030B26",
      "sidebarForeground": "#DCE6FF",
      "sidebarBorder": "#12245C",
      "sidebarPrimary": "#FFCA17",
      "sidebarPrimaryForeground": "#101A38",
      "sidebarAccent": "#11388E",
      "sidebarAccentForeground": "#FFFFFF",
      "sidebarRing": "#22DAFF"
    }
  },
  "fontFamily": {
    "sans": [
      "IBM Plex Sans Arabic",
      "sans-serif"
    ],
    "serif": [
      "Baloo Bhaijaan 2",
      "IBM Plex Sans Arabic",
      "serif"
    ],
    "mono": [
      "IBM Plex Mono",
      "Menlo",
      "monospace"
    ]
  },
  "radius": "0.75rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
