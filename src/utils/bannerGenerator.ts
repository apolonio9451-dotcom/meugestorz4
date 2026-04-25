
export interface MatchData {
  home_team: string;
  away_team: string;
  home_logo: string;
  away_logo: string;
  match_time: string;
  league_name: string;
  league_logo?: string;
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
  pageInfo?: { current: number; total: number },
  customSettings?: { hideFrames?: boolean; hideHeaderBox?: boolean }
): Promise<string> => {
  const width = 1080;
  const height = 1920; // 9:16 Aspect Ratio (Exact Template Dimension)
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
    try {
      const date = new Date(isoString);
      const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
      const brasiliaDate = new Date(utc + (3600000 * -3));
      return brasiliaDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "00:00";
    }
  };

  const defaultStadiumUrl = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1080";
  const bgToUse = backgroundUrl || defaultStadiumUrl;
  
  const [bgImg, logoImg] = await Promise.all([
    loadImage(bgToUse),
    brandLogo ? loadImage(brandLogo) : Promise.resolve(null),
  ]);

  // 1. Draw Background & Base Layer
  ctx.drawImage(bgImg, 0, 0, width, height);
  
  if (!backgroundUrl || backgroundUrl === defaultStadiumUrl) {
    // Dark textured background simulation
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0a0a1a");
    gradient.addColorStop(0.5, "#050510");
    gradient.addColorStop(1, "#000000");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle texture (dots)
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    for (let i = 0; i < width; i += 40) {
      for (let j = 0; j < height; j += 40) {
        ctx.fillRect(i, j, 2, 2);
      }
    }
  }

  // 2. HEADER - Professional Clean Title
  const headerY = 200;
  ctx.textAlign = "center";
  
  const today = new Date();
  const dayName = today.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
  const dayNum = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const year = today.getFullYear();
  const fullDateStr = `JOGOS DE HOJE - ${dayName}, ${dayNum} DE ${year}`;

  // Header cleaning box
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(50, headerY - 80, width - 100, 160);

  ctx.font = "bold 70px Montserrat, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(fullDateStr, width / 2, headerY + 15);

  if (pageInfo && pageInfo.total > 1) {
    ctx.font = "bold 30px Montserrat, sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText(`PÁGINA ${pageInfo.current} / ${pageInfo.total}`, width / 2, headerY + 70);
  }

  // 3. LOGO TV MAX
  if (logoImg && logoImg.width > 1) {
    const logoW = 160;
    const aspectRatio = logoImg.height / logoImg.width;
    const logoH = logoW * aspectRatio;
    ctx.drawImage(logoImg, width - logoW - 60, 40, logoW, logoH);
  }

  // 4. MATCH GRID - 5 COLUMN STRUCTURE
  const startY = 450;
  const rowHeight = 220;
  const shieldSize = 80;
  const leagueLogoSize = 60;
  const nameMaxWidth = 250;

  const getAutoShrinkFontSize = (text: string, maxWidth: number, baseSize: number) => {
    ctx.font = `bold ${baseSize}px Montserrat, sans-serif`;
    let size = baseSize;
    while (ctx.measureText(text.toUpperCase()).width > maxWidth && size > 16) {
      size--;
      ctx.font = `bold ${size}px Montserrat, sans-serif`;
    }
    return size;
  };

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const yCenter = startY + i * rowHeight;
    const canvasCenterX = width / 2;

    const [homeShield, awayShield, leagueLogo] = await Promise.all([
      loadImage(match.home_logo),
      loadImage(match.away_logo),
      match.league_logo ? loadImage(match.league_logo) : Promise.resolve(null),
    ]);

    // Draw row "Frame/Molde" (Neon Glow Effect)
    const frameWidth = width - 100;
    const frameHeight = rowHeight - 20;
    const frameX = 50;
    const frameY = yCenter - (frameHeight / 2);

    // Frame cleaning
    ctx.fillStyle = "rgba(10, 10, 30, 0.8)";
    ctx.beginPath();
    ctx.roundRect(frameX, frameY, frameWidth, frameHeight, 15);
    ctx.fill();

    // Neon border
    ctx.strokeStyle = "rgba(59, 130, 246, 0.5)"; // Blue neon
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- COLUMN 1: LEAGUE & TIME ---
    const col1X = 80;
    if (leagueLogo && leagueLogo.width > 1) {
      ctx.drawImage(leagueLogo, col1X, yCenter - (leagueLogoSize / 2), leagueLogoSize, leagueLogoSize);
    }
    ctx.textAlign = "left";
    ctx.font = "bold 34px Montserrat, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(formatBrasiliaTime(match.match_time), col1X + 75, yCenter + 12);

    // --- COLUMN 2: HOME TEAM ---
    const col2X = 260;
    if (homeShield && homeShield.width > 1) {
      ctx.drawImage(homeShield, col2X, yCenter - (shieldSize / 2), shieldSize, shieldSize);
    }
    const homeNameFontSize = getAutoShrinkFontSize(match.home_team, nameMaxWidth, 36);
    ctx.font = `bold ${homeNameFontSize}px Montserrat, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.home_team.toUpperCase(), col2X + shieldSize + 20, yCenter + 12);

    // --- COLUMN 3: VS ---
    ctx.textAlign = "center";
    ctx.font = "italic bold 42px Montserrat, sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("VS", canvasCenterX, yCenter + 12);

    // --- COLUMN 4: AWAY TEAM ---
    const col4X = canvasCenterX + 60;
    const awayNameFontSize = getAutoShrinkFontSize(match.away_team, nameMaxWidth, 36);
    ctx.font = `bold ${awayNameFontSize}px Montserrat, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.away_team.toUpperCase(), col4X, yCenter + 12);

    const awayNameWidth = ctx.measureText(match.away_team.toUpperCase()).width;
    if (awayShield && awayShield.width > 1) {
      ctx.drawImage(awayShield, col4X + awayNameWidth + 20, yCenter - (shieldSize / 2), shieldSize, shieldSize);
    }

    // --- COLUMN 5: CHANNELS ---
    const col5X = width - 220;
    if (match.channels && match.channels.length > 0) {
      ctx.textAlign = "center";
      ctx.font = "bold 22px Montserrat, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      // Stack up to 3 channels
      match.channels.slice(0, 3).forEach((channel, idx) => {
        const offset = (idx - (Math.min(match.channels.length, 3) - 1) / 2) * 35;
        ctx.fillText(channel.toUpperCase(), col5X + 100, yCenter + offset + 8);
      });
    }
  }

  // 5. FOOTER - Exactly as image_10.png
  const footerY = 1850;
  
  // Left: "ASSINE JÁ!" Button
  const btnX = 60;
  const btnW = 220;
  const btnH = 65;
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.roundRect(btnX, footerY - 45, btnW, btnH, 10);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ASSINE JÁ!", btnX + (btnW / 2), footerY);

  // Center: Text
  ctx.textAlign = "center";
  ctx.font = "500 22px Montserrat, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fillText("ASSISTA EM QUALQUER DISPOSITIVO", width / 2, footerY);

  // Right: Device List
  const deviceText = "SAMSUNG | LG | ROKU | GOOGLE | FIRE TV | ANDROID | XIAOMI";
  ctx.font = "bold 18px Montserrat, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fillText(deviceText, width - 60, footerY);

  return canvas.toDataURL("image/png");
};
