export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  locked?: boolean;
  colors: {
    primary: string;
    secondary: string;
    background: string;
  };
  // Full HSL variable overrides for complete theme coverage
  cssVars: Record<string, string>;
}

export const themePresets: ThemePreset[] = [
  {
    id: "navy",
    name: "Navy Blue",
    description: "Tema padrão azul escuro",
    colors: {
      primary: "#2ba6d4",
      secondary: "#242a33",
      background: "#0f1319",
    },
    cssVars: {
      "--background": "220 25% 8%",
      "--foreground": "210 15% 93%",
      "--card": "220 22% 13%",
      "--card-foreground": "210 15% 93%",
      "--popover": "220 22% 13%",
      "--popover-foreground": "210 15% 93%",
      "--primary": "200 80% 55%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "220 18% 17%",
      "--secondary-foreground": "210 15% 93%",
      "--muted": "220 16% 17%",
      "--muted-foreground": "215 10% 50%",
      "--accent": "200 75% 50%",
      "--accent-foreground": "0 0% 100%",
      "--border": "220 14% 19%",
      "--input": "220 16% 15%",
      "--ring": "200 80% 55%",
      "--sidebar-background": "220 28% 6%",
      "--sidebar-foreground": "215 12% 65%",
      "--sidebar-primary": "200 80% 55%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "220 20% 15%",
      "--sidebar-accent-foreground": "210 15% 88%",
      "--sidebar-border": "220 16% 15%",
      "--sidebar-ring": "200 80% 55%",
      "--glass-bg": "220 25% 14%",
      "--glass-border": "210 20% 23%",
      "--glass-glow": "200 80% 55%",
    },
  },
  {
    id: "teal",
    name: "Teal Emerald",
    description: "Tema verde esmeralda",
    colors: {
      primary: "#14b8a6",
      secondary: "#0f2926",
      background: "#071716",
    },
    cssVars: {
      "--background": "170 40% 6%",
      "--foreground": "160 15% 93%",
      "--card": "170 32% 11%",
      "--card-foreground": "160 15% 93%",
      "--popover": "170 32% 11%",
      "--popover-foreground": "160 15% 93%",
      "--primary": "174 72% 40%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "170 30% 11%",
      "--secondary-foreground": "160 15% 90%",
      "--muted": "170 22% 13%",
      "--muted-foreground": "170 10% 48%",
      "--accent": "174 65% 38%",
      "--accent-foreground": "0 0% 100%",
      "--border": "170 18% 16%",
      "--input": "170 22% 12%",
      "--ring": "174 72% 40%",
      "--sidebar-background": "170 45% 4%",
      "--sidebar-foreground": "170 12% 60%",
      "--sidebar-primary": "174 72% 40%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "170 25% 12%",
      "--sidebar-accent-foreground": "160 15% 85%",
      "--sidebar-border": "170 20% 13%",
      "--sidebar-ring": "174 72% 40%",
      "--glass-bg": "170 30% 12%",
      "--glass-border": "170 20% 20%",
      "--glass-glow": "174 72% 40%",
    },
  },
  {
    id: "custom",
    name: "Tema 3",
    description: "Em breve...",
    locked: true,
    colors: {
      primary: "#8b5cf6",
      secondary: "#1e1b2e",
      background: "#0e0c1a",
    },
    cssVars: {},
  },
];

export function applyThemePreset(preset: ThemePreset) {
  const root = document.documentElement;
  Object.entries(preset.cssVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function clearThemeOverrides() {
  const root = document.documentElement;
  const vars = [
    "--background", "--foreground", "--card", "--card-foreground",
    "--popover", "--popover-foreground", "--primary", "--primary-foreground",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--accent", "--accent-foreground", "--border", "--input", "--ring",
    "--sidebar-background", "--sidebar-foreground", "--sidebar-primary",
    "--sidebar-primary-foreground", "--sidebar-accent", "--sidebar-accent-foreground",
    "--sidebar-border", "--sidebar-ring", "--glass-bg", "--glass-border", "--glass-glow",
  ];
  vars.forEach((v) => root.style.removeProperty(v));
}
