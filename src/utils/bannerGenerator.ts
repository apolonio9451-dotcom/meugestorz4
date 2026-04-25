
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
  pageInfo?: { current: number; total: number }
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

  // 1. Draw Background (FIRST LAYER)
  ctx.drawImage(bgImg, 0, 0, width, height);
  
  // Apply dark overlay if not custom template or if custom template is default
  if (!backgroundUrl || backgroundUrl === defaultStadiumUrl) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0, 0, 20, 0.9)");
    gradient.addColorStop(0.5, "rgba(5, 5, 10, 0.95)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. HEADER - "JOGOS DE HOJE" + DATA (image_10.png style)
  const headerY = 220;
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 90px Montserrat, sans-serif";
  
  const today = new Date();
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = today.toLocaleDateString('pt-BR', options).toUpperCase();
  
  let mainTitle = `JOGOS DE HOJE - ${formattedDate}`;
  if (pageInfo && pageInfo.total > 1) {
    mainTitle += ` (${pageInfo.current}/${pageInfo.total})`;
  }
  
  // Clean header area to avoid overlaps
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(50, headerY - 80, width - 100, 160);
  
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(mainTitle, width / 2, headerY + 20);

  // 3. LOGO TV MAX
  if (logoImg && logoImg.width > 1) {
    const logoW = 180;
    const aspectRatio = logoImg.height / logoImg.width;
    const logoH = logoW * aspectRatio;
    ctx.drawImage(logoImg, width - logoW - 60, 60, logoW, logoH);
  }

  // 4. GRID DE JOGOS (Cordenadas Ajustadas por Zona)
  const startY = 520; // Ajustado para não colidir com o cabeçalho
  const rowHeight = 220;
  const shieldSize = 80; 
  const nameMaxWidth = 300; 
  const zonePadding = 120; // Column-based separation like image_10.png

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

    const [homeShield, awayShield] = await Promise.all([
      loadImage(match.home_logo),
      loadImage(match.away_logo),
    ]);

    // --- 5-COLUMN STRUCTURE (image_10.png) ---
    
    // Column 1: League Logo & Time (Left)
    const col1X = 60;
    const timeStr = formatBrasiliaTime(match.match_time);
    ctx.textAlign = "left";
    ctx.font = "bold 36px Montserrat, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(timeStr, col1X + 70, yCenter + 15);
    // Note: League logo would be drawn at col1X if match.league_logo was available

    // Column 2: Home Team (Mandante)
    const col2ShieldX = 260;
    if (homeShield && homeShield.width > 1) {
      ctx.drawImage(homeShield, col2ShieldX, yCenter - (shieldSize / 2), shieldSize, shieldSize);
    }
    const homeNameSize = getAutoShrinkFontSize(match.home_team, nameMaxWidth, 38);
    ctx.font = `bold ${homeNameSize}px Montserrat, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.home_team.toUpperCase(), col2ShieldX + shieldSize + 20, yCenter + 15);

    // Column 3: VS (Center)
    ctx.textAlign = "center";
    ctx.font = "italic bold 48px Montserrat, sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("VS", canvasCenterX, yCenter + 15);

    // Column 4: Away Team (Visitante)
    const col4NameX = canvasCenterX + 60;
    const awayNameSize = getAutoShrinkFontSize(match.away_team, nameMaxWidth, 38);
    ctx.font = `bold ${awayNameSize}px Montserrat, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.away_team.toUpperCase(), col4NameX, yCenter + 15);
    
    const awayNameWidth = ctx.measureText(match.away_team.toUpperCase()).width;
    if (awayShield && awayShield.width > 1) {
      ctx.drawImage(awayShield, col4NameX + awayNameWidth + 20, yCenter - (shieldSize / 2), shieldSize, shieldSize);
    }

    // Column 5: Channels (Right)
    const col5X = width - 180;
    if (match.channels && match.channels.length > 0) {
      ctx.textAlign = "center";
      ctx.font = "bold 24px Montserrat, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      // Draw first 2 channels stacked if multiple
      match.channels.slice(0, 2).forEach((channel, idx) => {
        ctx.fillText(channel.toUpperCase(), col5X + 80, yCenter - 5 + (idx * 35));
      });
    }
  }

  // 5. FOOTER - image_10.png exact replication
  const footerY = 1850;
  
  // "ASSINE JÁ!" Button (Left)
  const btnX = 60;
  const btnW = 240;
  const btnH = 70;
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.roundRect(btnX, footerY - 45, btnW, btnH, 10);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 30px Montserrat, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ASSINE JÁ!", btnX + (btnW / 2), footerY);

  // Center Text
  ctx.font = "500 24px Montserrat, sans-serif";
  ctx.fillText("ASSISTA EM QUALQUER DISPOSITIVO", width / 2, footerY);

  // Device Icons (Right) - Simplified placeholders for standard devices
  const iconText = "SAMSUNG | LG | ROKU | GOOGLE | FIRE TV | ANDROID";
  ctx.font = "bold 20px Montserrat, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.fillText(iconText, width - 60, footerY);

  return canvas.toDataURL("image/png");
};
