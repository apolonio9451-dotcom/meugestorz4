
export interface MatchData {
  home_team: string;
  away_team: string;
  home_logo: string;
  away_logo: string;
  match_time: string;
  league_name: string;
  channels: string[];
}

export interface TemplateConfig {
  title: { x: number; y: number; fontSize: number; color: string; text: string };
  dayOfWeek: { x: number; y: number; fontSize: number; color: string };
  logo: { x: number; y: number; width: number };
  matches: {
    startY: number;
    rowHeight: number;
    shieldSize: number;
    nameFontSize: number;
    infoFontSize: number;
    maxPerPage: number;
  };
  footer: { y: number; text: string; bgColor: string };
}

export const generateBannerCanvas = async (
  matches: MatchData[],
  brandLogo: string | null,
  dayOfWeek: string,
  templateId: number | string = 1,
  backgroundUrl?: string,
  dynamicConfig?: TemplateConfig,
  pageInfo?: { current: number; total: number }
): Promise<string> => {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Could not get canvas context");

  // Helper to load images
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => {
        const fallback = new Image();
        fallback.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        resolve(fallback);
      };
      img.src = src;
    });
  };

  const formatBrasiliaTime = (isoString: string) => {
    const date = new Date(isoString);
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const brasiliaDate = new Date(utc + (3600000 * -3));
    return brasiliaDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const defaultStadiumUrl = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1080";
  const bgToUse = backgroundUrl || defaultStadiumUrl;
  
  const [bgImg, logoImg] = await Promise.all([
    loadImage(bgToUse),
    brandLogo ? loadImage(brandLogo) : Promise.resolve(null),
  ]);

  // 1. Draw Background
  ctx.drawImage(bgImg, 0, 0, width, height);
  
  // Apply dark overlay if using dynamic template or default list
  if (!backgroundUrl || backgroundUrl === defaultStadiumUrl) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0, 0, 20, 0.85)");
    gradient.addColorStop(0.5, "rgba(5, 5, 10, 0.9)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.95)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Configuration
  const config: TemplateConfig = dynamicConfig || {
    title: { x: 540, y: 280, fontSize: 140, color: "#FFFFFF", text: "JOGOS" },
    dayOfWeek: { x: 540, y: 350, fontSize: 50, color: "#3b82f6" },
    logo: { x: 840, y: 60, width: 180 },
    matches: {
      startY: 450,
      rowHeight: 220,
      shieldSize: 100,
      nameFontSize: 44,
      infoFontSize: 34,
      maxPerPage: 6
    },
    footer: { y: 1740, text: "ASSINE AGORA E ASSISTA EM 4K", bgColor: "#2563eb" }
  };

  // 3. Header
  ctx.textAlign = "center";
  ctx.fillStyle = config.title.color;
  ctx.font = `bold ${config.title.fontSize}px Montserrat, sans-serif`;
  
  let titleText = config.title.text;
  if (pageInfo && pageInfo.total > 1) {
    titleText += ` (${pageInfo.current}/${pageInfo.total})`;
  }
  ctx.fillText(titleText, config.title.x, config.title.y);
  
  ctx.font = `italic ${config.dayOfWeek.fontSize}px Montserrat, sans-serif`;
  ctx.fillStyle = config.dayOfWeek.color;
  ctx.fillText(dayOfWeek.toUpperCase(), config.dayOfWeek.x, config.dayOfWeek.y);

  // 4. Logo
  if (logoImg && logoImg.width > 1) {
    const aspectRatio = logoImg.height / logoImg.width;
    const logoHeight = config.logo.width * aspectRatio;
    ctx.drawImage(logoImg, config.logo.x, config.logo.y, config.logo.width, logoHeight);
  }

  // 5. Matches
  const maxMatches = config.matches.maxPerPage;
  const matchesToDraw = matches.slice(0, maxMatches);
  
  for (let i = 0; i < matchesToDraw.length; i++) {
    const match = matchesToDraw[i];
    const y = config.matches.startY + i * config.matches.rowHeight;

    const [homeShield, awayShield] = await Promise.all([
      loadImage(match.home_logo),
      loadImage(match.away_logo),
    ]);

    const centerX = width / 2;
    
    // Names
    ctx.textAlign = "center";
    ctx.font = `bold ${config.matches.nameFontSize}px Montserrat, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    
    const homeName = match.home_team.length > 15 ? match.home_team.substring(0, 15) + "..." : match.home_team;
    const awayName = match.away_team.length > 15 ? match.away_team.substring(0, 15) + "..." : match.away_team;

    ctx.fillText(homeName.toUpperCase(), centerX - 260, y + 15);
    ctx.font = `italic ${config.matches.nameFontSize - 4}px Montserrat, sans-serif`;
    ctx.fillStyle = config.dayOfWeek.color;
    ctx.fillText("VS", centerX, y + 15);
    ctx.font = `bold ${config.matches.nameFontSize}px Montserrat, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(awayName.toUpperCase(), centerX + 260, y + 15);

    // Shields
    const sSize = config.matches.shieldSize;
    if (homeShield && homeShield.width > 1) {
      ctx.drawImage(homeShield, centerX - 480, y - 50, sSize, sSize);
    }
    if (awayShield && awayShield.width > 1) {
      ctx.drawImage(awayShield, centerX + 380, y - 50, sSize, sSize);
    }

    // Time/Info
    ctx.font = `bold ${config.matches.infoFontSize}px Montserrat, sans-serif`;
    ctx.fillStyle = config.dayOfWeek.color;
    const timeStr = formatBrasiliaTime(match.match_time);
    const channelsStr = match.channels && match.channels.length > 0 
      ? ` | ${match.channels.join(" & ")}` 
      : "";
    ctx.fillText(`${timeStr}${channelsStr}`, centerX, y + 90);
  }

  // 6. Footer
  const footerY = config.footer.y;
  ctx.textAlign = "center";
  ctx.font = "bold 38px Montserrat, sans-serif";
  const textWidth = ctx.measureText(config.footer.text).width;
  const padding = 50;
  
  ctx.fillStyle = config.footer.bgColor;
  const btnWidth = textWidth + padding * 2;
  const btnHeight = 85;
  const btnX = (width - btnWidth) / 2;
  const btnY = footerY - 55;
  
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 42.5);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(config.footer.text, width / 2, footerY);

  return canvas.toDataURL("image/png");
};
