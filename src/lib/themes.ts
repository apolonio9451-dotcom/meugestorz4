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

function buildVars(hue: number, sat: number, light: number): Record<string, string> {
  const bgH = hue;
  const primary = `${hue} ${sat}% ${light}%`;
  return {
    "--background": `${bgH} 40% 6%`,
    "--foreground": `${bgH} 15% 93%`,
    "--card": `${bgH} 32% 11%`,
    "--card-foreground": `${bgH} 15% 93%`,
    "--popover": `${bgH} 32% 11%`,
    "--popover-foreground": `${bgH} 15% 93%`,
    "--primary": primary,
    "--primary-foreground": "0 0% 100%",
    "--secondary": `${bgH} 30% 11%`,
    "--secondary-foreground": `${bgH} 15% 90%`,
    "--muted": `${bgH} 22% 13%`,
    "--muted-foreground": `${bgH} 10% 48%`,
    "--accent": `${hue} ${Math.max(sat - 7, 30)}% ${Math.max(light - 2, 30)}%`,
    "--accent-foreground": "0 0% 100%",
    "--border": `${hue} 40% 20%`,
    "--input": `${bgH} 22% 12%`,
    "--ring": primary,
    "--sidebar-background": `${bgH} 45% 4%`,
    "--sidebar-foreground": `${bgH} 12% 60%`,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": "0 0% 100%",
    "--sidebar-accent": `${bgH} 25% 12%`,
    "--sidebar-accent-foreground": `${bgH} 15% 85%`,
    "--sidebar-border": `${bgH} 20% 13%`,
    "--sidebar-ring": primary,
    "--glass-bg": `${bgH} 35% 10%`,
    "--glass-border": `${hue} 60% 35%`,
    "--glass-glow": primary,
  };
}

export const themePresets: ThemePreset[] = [
  // Row 1 — Blues & Teals
  {
    id: "royal-blue",
    name: "Azul Royal",
    description: "Azul intenso",
    colors: { primary: "#1565C0", secondary: "#90A4AE", background: "#0d1b2a" },
    cssVars: buildVars(211, 78, 42),
  },
  {
    id: "steel-gray",
    name: "Cinza Aço",
    description: "Cinza neutro",
    colors: { primary: "#78909C", secondary: "#B0BEC5", background: "#1a1d21" },
    cssVars: buildVars(200, 13, 54),
  },
  {
    id: "navy",
    name: "Navy Blue",
    description: "Azul escuro",
    colors: { primary: "#1E3A5F", secondary: "#90CAF9", background: "#0f1319" },
    cssVars: buildVars(213, 52, 25),
  },
  {
    id: "slate-blue",
    name: "Azul Ardósia",
    description: "Azul acinzentado",
    colors: { primary: "#546E7A", secondary: "#90A4AE", background: "#141a1f" },
    cssVars: buildVars(200, 18, 40),
  },
  {
    id: "blue-gray",
    name: "Azul Cinza",
    description: "Cinza azulado",
    colors: { primary: "#607D8B", secondary: "#B0BEC5", background: "#161c20" },
    cssVars: buildVars(200, 18, 46),
  },
  {
    id: "teal",
    name: "Teal Emerald",
    description: "Verde esmeralda",
    colors: { primary: "#14b8a6", secondary: "#0f2926", background: "#071716" },
    cssVars: buildVars(174, 72, 40),
  },

  // Row 2 — Greens, Yellows, Warm tones
  {
    id: "forest-green",
    name: "Verde Floresta",
    description: "Verde profundo",
    colors: { primary: "#2E7D32", secondary: "#A5D6A7", background: "#0a1a0c" },
    cssVars: buildVars(123, 46, 34),
  },
  {
    id: "sage-green",
    name: "Verde Sálvia",
    description: "Verde suave",
    colors: { primary: "#66796A", secondary: "#A5B5A8", background: "#131a14" },
    cssVars: buildVars(133, 10, 44),
  },
  {
    id: "olive-gold",
    name: "Ouro Oliva",
    description: "Dourado oliva",
    colors: { primary: "#9E8C24", secondary: "#C8B95A", background: "#1a1708" },
    cssVars: buildVars(52, 65, 38),
  },
  {
    id: "burnt-orange",
    name: "Laranja Queimado",
    description: "Laranja terroso",
    colors: { primary: "#BF6D2A", secondary: "#F5B77A", background: "#1c1108" },
    cssVars: buildVars(27, 65, 46),
  },
  {
    id: "warm-taupe",
    name: "Taupe Quente",
    description: "Bege quente",
    colors: { primary: "#8D6E63", secondary: "#BCAAA4", background: "#1a1614" },
    cssVars: buildVars(16, 18, 47),
  },
  {
    id: "rose-pink",
    name: "Rosa Suave",
    description: "Rosa clássico",
    colors: { primary: "#AD1457", secondary: "#F48FB1", background: "#1c0a12" },
    cssVars: buildVars(336, 78, 38),
  },

  // Row 3 — Purples & extras
  {
    id: "mauve",
    name: "Malva",
    description: "Roxo acinzentado",
    colors: { primary: "#795665", secondary: "#B39DAA", background: "#1a1318" },
    cssVars: buildVars(330, 18, 40),
  },
  {
    id: "magenta",
    name: "Magenta",
    description: "Rosa vibrante",
    colors: { primary: "#9C27B0", secondary: "#CE93D8", background: "#180a1c" },
    cssVars: buildVars(291, 64, 42),
  },
  {
    id: "custom",
    name: "Purple Noir",
    description: "Roxo profundo",
    colors: { primary: "#8b5cf6", secondary: "#1e1b2e", background: "#0a0812" },
    cssVars: buildVars(262, 83, 66),
  },
  {
    id: "turquoise",
    name: "Turquoise",
    description: "Turquesa vibrante",
    colors: { primary: "#40E0D0", secondary: "#0a2230", background: "#06181e" },
    cssVars: buildVars(174, 72, 56),
  },
];

const THEME_CACHE_KEY = "meugestor-theme-vars";

export function applyThemePreset(preset: ThemePreset) {
  const root = document.documentElement;
  Object.entries(preset.cssVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
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
