
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
    title: { x: 540, y: 220, fontSize: 160, color: "#FFFFFF", text: "HOJE NA TV" },
    dayOfWeek: { x: 540, y: 300, fontSize: 60, color: "#3b82f6" },
    logo: { x: 840, y: 60, width: 180 },
    matches: {
      startY: 420,
      rowHeight: 210,
      shieldSize: 110,
      nameFontSize: 46,
      infoFontSize: 34,
      maxPerPage: 6
    },
    footer: { y: 1780, text: "ASSINE AGORA E ASSISTA EM 4K", bgColor: "#2563eb" }
  };

  // 3. Header - ONLY DRAW IF NOT CUSTOM BACKGROUND
  if (!backgroundUrl || backgroundUrl === defaultStadiumUrl) {
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
  }

  // 5. Matches - Structured Layout with Grid Logic
  const maxMatches = config.matches.maxPerPage;
  const matchesToDraw = matches.slice(0, maxMatches);
  
  // Grid layout definitions
  const shieldWidth = config.matches.shieldSize;
  const nameWidth = 220; // Reserved width for team names
  const vsWidth = 60;    // Reserved width for "VS"
  const infoWidth = 250;  // Reserved width for Time and Channels
  const spacing = 15;     // Space between columns
  
  // Calculate total row width to center it
  const totalRowWidth = (shieldWidth * 2) + (nameWidth * 2) + vsWidth + infoWidth + (spacing * 5);
  const rowStartX = (width - totalRowWidth) / 2;

  const truncateText = (text: string, maxWidth: number, font: string) => {
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return text;
    
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + "...").width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + "...";
  };

  for (let i = 0; i < matchesToDraw.length; i++) {
    const match = matchesToDraw[i];
    const y = config.matches.startY + i * config.matches.rowHeight;

    const [homeShield, awayShield] = await Promise.all([
      loadImage(match.home_logo),
      loadImage(match.away_logo),
    ]);

    // Column offsets
    const col1X = rowStartX;                                          // Shield 1
    const col2X = col1X + shieldWidth + spacing;                      // Name 1
    const col3X = col2X + nameWidth + spacing;                        // "VS"
    const col4X = col3X + vsWidth + spacing;                          // Name 2
    const col5X = col4X + nameWidth + spacing;                        // Shield 2
    const col6X = col5X + shieldWidth + spacing;                      // Info (Time/Channel)

    const nameFont = `bold ${config.matches.nameFontSize}px Montserrat, sans-serif`;
    const infoFont = `bold ${config.matches.infoFontSize}px Montserrat, sans-serif`;
    const vsFont = `italic ${config.matches.nameFontSize - 4}px Montserrat, sans-serif`;

    // 1. Shield 1
    if (homeShield && homeShield.width > 1) {
      ctx.drawImage(homeShield, col1X, y - (shieldWidth / 2), shieldWidth, shieldWidth);
    }

    // 2. Name 1 (Aligned Right)
    ctx.textAlign = "right";
    ctx.font = nameFont;
    ctx.fillStyle = "#FFFFFF";
    const homeName = truncateText(match.home_team.toUpperCase(), nameWidth, nameFont);
    ctx.fillText(homeName, col2X + nameWidth, y + 15);

    // 3. "VS" (Centered)
    ctx.textAlign = "center";
    ctx.font = vsFont;
    ctx.fillStyle = config.dayOfWeek.color;
    ctx.fillText("VS", col3X + (vsWidth / 2), y + 15);

    // 4. Name 2 (Aligned Left)
    ctx.textAlign = "left";
    ctx.font = nameFont;
    ctx.fillStyle = "#FFFFFF";
    const awayName = truncateText(match.away_team.toUpperCase(), nameWidth, nameFont);
    ctx.fillText(awayName, col4X, y + 15);

    // 5. Shield 2
    if (awayShield && awayShield.width > 1) {
      ctx.drawImage(awayShield, col5X, y - (shieldWidth / 2), shieldWidth, shieldWidth);
    }

    // 6. Info (Time and Channels)
    ctx.textAlign = "left";
    const timeStr = formatBrasiliaTime(match.match_time);
    const channelsStr = match.channels && match.channels.length > 0 
      ? match.channels[0] // Just take the first one or first two to keep it clean
      : "";
    
    ctx.font = infoFont;
    ctx.fillStyle = config.dayOfWeek.color;
    ctx.fillText(timeStr, col6X, y - 5);
    
    if (channelsStr) {
      ctx.font = `italic ${config.matches.infoFontSize - 6}px Montserrat, sans-serif`;
      ctx.fillStyle = "#AAAAAA";
      const displayChannel = truncateText(channelsStr.toUpperCase(), infoWidth, ctx.font);
      ctx.fillText(displayChannel, col6X, y + 35);
    }

    // Optional separator
    if (!backgroundUrl || backgroundUrl === defaultStadiumUrl) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rowStartX, y + (config.matches.rowHeight / 2));
      ctx.lineTo(rowStartX + totalRowWidth, y + (config.matches.rowHeight / 2));
      ctx.stroke();
    }
  }

  // 6. Footer - ONLY DRAW IF NOT CUSTOM BACKGROUND
  if (!backgroundUrl || backgroundUrl === defaultStadiumUrl) {
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
  }

  return canvas.toDataURL("image/png");
};
