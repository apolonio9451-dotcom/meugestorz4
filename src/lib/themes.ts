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
  cssVars: Record<string, string>;
}

export const themePresets: ThemePreset[] = [
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
      "--border": "174 40% 20%",
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
      "--glass-bg": "170 35% 10%",
      "--glass-border": "174 60% 35%",
      "--glass-glow": "174 72% 40%",
    },
  },
  {
    id: "navy",
    name: "Navy Blue",
    description: "Tema azul escuro",
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
    id: "custom",
    name: "Purple Noir",
    description: "Tema roxo, azul e preto",
    colors: {
      primary: "#8b5cf6",
      secondary: "#1e1b2e",
      background: "#0a0812",
    },
    cssVars: {
      "--background": "260 40% 4%",
      "--foreground": "250 15% 93%",
      "--card": "260 30% 10%",
      "--card-foreground": "250 15% 93%",
      "--popover": "260 30% 10%",
      "--popover-foreground": "250 15% 93%",
      "--primary": "262 83% 66%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "260 25% 14%",
      "--secondary-foreground": "250 15% 90%",
      "--muted": "260 20% 13%",
      "--muted-foreground": "260 10% 48%",
      "--accent": "230 70% 55%",
      "--accent-foreground": "0 0% 100%",
      "--border": "260 20% 16%",
      "--input": "260 22% 12%",
      "--ring": "262 83% 66%",
      "--sidebar-background": "260 45% 3%",
      "--sidebar-foreground": "260 12% 60%",
      "--sidebar-primary": "262 83% 66%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": "260 25% 12%",
      "--sidebar-accent-foreground": "250 15% 85%",
      "--sidebar-border": "260 20% 13%",
      "--sidebar-ring": "262 83% 66%",
      "--glass-bg": "260 35% 9%",
      "--glass-border": "262 60% 50%",
      "--glass-glow": "262 83% 66%",
    },
  },
  {
    id: "turquoise",
    name: "Turquoise",
    description: "Tema turquesa vibrante",
    colors: {
      primary: "#40E0D0",
      secondary: "#0f2a28",
      background: "#071a19",
    },
    cssVars: {
      "--background": "174 38% 6%",
      "--foreground": "170 15% 93%",
      "--card": "174 30% 11%",
      "--card-foreground": "170 15% 93%",
      "--popover": "174 30% 11%",
      "--popover-foreground": "170 15% 93%",
      "--primary": "174 72% 56%",
      "--primary-foreground": "0 0% 0%",
      "--secondary": "174 28% 11%",
      "--secondary-foreground": "170 15% 90%",
      "--muted": "174 20% 13%",
      "--muted-foreground": "174 10% 48%",
      "--accent": "174 65% 50%",
      "--accent-foreground": "0 0% 0%",
      "--border": "174 35% 22%",
      "--input": "174 22% 12%",
      "--ring": "174 72% 56%",
      "--sidebar-background": "174 42% 4%",
      "--sidebar-foreground": "174 12% 60%",
      "--sidebar-primary": "174 72% 56%",
      "--sidebar-primary-foreground": "0 0% 0%",
      "--sidebar-accent": "174 25% 12%",
      "--sidebar-accent-foreground": "170 15% 85%",
      "--sidebar-border": "174 20% 13%",
      "--sidebar-ring": "174 72% 56%",
      "--glass-bg": "174 32% 10%",
      "--glass-border": "174 55% 45%",
      "--glass-glow": "174 72% 56%",
    },
  },
];

const THEME_CACHE_KEY = "meugestor-theme-vars";

export function applyThemePreset(preset: ThemePreset) {
  const root = document.documentElement;
  Object.entries(preset.cssVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  // Cache to localStorage for instant load next time
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(preset.cssVars));
  } catch {}
}

export function applyCachedTheme(): boolean {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached) {
      const vars = JSON.parse(cached) as Record<string, string>;
      const root = document.documentElement;
      Object.entries(vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
      return true;
    }
  } catch {}
  return false;
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
  try {
    localStorage.removeItem(THEME_CACHE_KEY);
  } catch {}
}
