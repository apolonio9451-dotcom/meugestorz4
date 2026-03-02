import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

function hexToHSL(hex: string): string {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function generateColorVariants(baseHSL: string) {
  const parts = baseHSL.split(" ");
  const h = parseInt(parts[0]);
  const s = parseInt(parts[1]);
  const l = parseInt(parts[2]);
  return {
    base: `${h} ${s}% ${l}%`,
    light: `${h} ${Math.min(s + 10, 100)}% ${Math.min(l + 15, 95)}%`,
    dark: `${h} ${s}% ${Math.max(l - 15, 5)}%`,
    muted: `${h} ${Math.max(s - 40, 10)}% ${l}%`,
  };
}

export function applyBrandColors(colors: {
  primary_color: string;
  secondary_color: string;
  background_color: string;
}) {
  const root = document.documentElement;

  const primary = hexToHSL(colors.primary_color);
  const secondary = hexToHSL(colors.secondary_color);
  const bg = hexToHSL(colors.background_color);
  const bgVariants = generateColorVariants(bg);

  // Primary
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-ring", primary);
  root.style.setProperty("--glass-glow", primary);

  // Accent from secondary
  root.style.setProperty("--accent", secondary);

  // Background-derived
  root.style.setProperty("--background", bgVariants.base);
  root.style.setProperty("--card", bgVariants.light);
  root.style.setProperty("--popover", bgVariants.light);
  root.style.setProperty("--secondary", bgVariants.light);
  root.style.setProperty("--muted", bgVariants.light);
  root.style.setProperty("--input", bgVariants.light);
  root.style.setProperty("--border", `${parseInt(bg.split(" ")[0])} 15% 18%`);
  root.style.setProperty("--sidebar-background", bgVariants.dark);
  root.style.setProperty("--sidebar-border", bgVariants.light);
  root.style.setProperty("--sidebar-accent", bgVariants.light);
  root.style.setProperty("--glass-bg", bgVariants.light);
  root.style.setProperty("--glass-border", `${parseInt(bg.split(" ")[0])} 25% 22%`);
}

export function useBrandColors() {
  const { companyId } = useAuth();

  const fetchAndApply = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("company_settings")
      .select("primary_color, secondary_color, background_color")
      .eq("company_id", companyId)
      .maybeSingle();

    if (data) {
      applyBrandColors(data);
    }
  }, [companyId]);

  useEffect(() => {
    fetchAndApply();
  }, [fetchAndApply]);

  return { refreshColors: fetchAndApply };
}
