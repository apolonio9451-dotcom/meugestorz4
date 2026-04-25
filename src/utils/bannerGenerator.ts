
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

  // 2. Configuration - Centered Content Area Focus
  const config: TemplateConfig = dynamicConfig || {
    title: { x: 540, y: 220, fontSize: 130, color: "#FFFFFF", text: "JOGOS DE HOJE" },
    dayOfWeek: { x: 540, y: 310, fontSize: 50, color: "#3b82f6" },
    logo: { x: 840, y: 60, width: 180 },
    matches: {
      startY: 450,
      rowHeight: 220,
      shieldSize: 100,
      nameFontSize: 38,
      infoFontSize: 28,
      maxPerPage: 6
    },
    footer: { y: 1780, text: "ASSINE AGORA E ASSISTA EM 4K", bgColor: "#2563eb" }
  };

  // 3. Header - Title and Date (Automatically updated)
  // Even with backgroundUrl, we might want to draw these if they are meant to be dynamic content
  const shouldDrawDynamicText = true; // Based on "O sistema só tem permissão para alterar os textos..."
  
  if (shouldDrawDynamicText) {
    ctx.textAlign = "center";
    ctx.fillStyle = config.title.color;
    ctx.font = `bold ${config.title.fontSize}px Montserrat, sans-serif`;
    
    const today = new Date();
    const formattedDate = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const fullTitle = `${config.title.text} - ${formattedDate}`;
    
    ctx.fillText(fullTitle.toUpperCase(), config.title.x, config.title.y);
    
    ctx.font = `italic ${config.dayOfWeek.fontSize}px Montserrat, sans-serif`;
    ctx.fillStyle = config.dayOfWeek.color;
    ctx.fillText(dayOfWeek.toUpperCase(), config.dayOfWeek.x, config.dayOfWeek.y);

    // 4. Logo - Maintain TV MAX branding if not in template
    if (!backgroundUrl && logoImg && logoImg.width > 1) {
      const aspectRatio = logoImg.height / logoImg.width;
      const logoHeight = config.logo.width * aspectRatio;
      ctx.drawImage(logoImg, config.logo.x, config.logo.y, config.logo.width, logoHeight);
    }
  }

  // 5. Matches - 5 Rigid Zones Logic (Box Model)
  const maxMatches = config.matches.maxPerPage;
  // Filter only matches for current date if possible, otherwise use passed matches
  const matchesToDraw = matches.slice(0, maxMatches);
  
  const shieldSize = 50; // Zona A/E: Máximo 50x50px
  const rowHeight = 220;
  const startY = 480; 
  const zoneWidthLimit = 120; // Zona B/D: Limite de 120px
  const margin = 10; // Margem de segurança de 10px

  const getAutoShrinkFontSize = (text: string, maxWidth: number, baseSize: number) => {
    ctx.font = `bold ${baseSize}px Montserrat, sans-serif`;
    let size = baseSize;
    while (ctx.measureText(text.toUpperCase()).width > maxWidth && size > 12) {
      size--;
      ctx.font = `bold ${size}px Montserrat, sans-serif`;
    }
    return size;
  };

  for (let i = 0; i < matchesToDraw.length; i++) {
    const match = matchesToDraw[i];
    const yCenter = startY + i * rowHeight;
    const canvasCenterX = width / 2;

    const [homeShield, awayShield] = await Promise.all([
      loadImage(match.home_logo),
      loadImage(match.away_logo),
    ]);

    // ZONA C: VS (Ponto central fixo)
    ctx.textAlign = "center";
    ctx.font = "italic bold 42px Montserrat, sans-serif";
    ctx.fillStyle = config.dayOfWeek.color;
    ctx.fillText("VS", canvasCenterX, yCenter + 10);

    // ZONA B: Nome Casa (Limite 120px, alinhado à direita de VS)
    const zonaB_EndX = canvasCenterX - 40; // Spacing from VS
    const zonaB_StartX = zonaB_EndX - zoneWidthLimit;
    
    const homeNameSize = getAutoShrinkFontSize(match.home_team, zoneWidthLimit, 36);
    ctx.font = `bold ${homeNameSize}px Montserrat, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.home_team.toUpperCase(), zonaB_EndX, yCenter + 10);

    // ZONA A: Escudo Casa (50x50px, à esquerda da Zona B)
    const zonaA_X = zonaB_StartX - shieldSize - margin;
    if (homeShield && homeShield.width > 1) {
      ctx.drawImage(homeShield, zonaA_X, yCenter - 25, shieldSize, shieldSize);
    }

    // ZONA D: Nome Fora (Limite 120px, alinhado à esquerda de VS)
    const zonaD_StartX = canvasCenterX + 40; // Spacing from VS
    
    const awayNameSize = getAutoShrinkFontSize(match.away_team, zoneWidthLimit, 36);
    ctx.font = `bold ${awayNameSize}px Montserrat, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.away_team.toUpperCase(), zonaD_StartX, yCenter + 10);

    // ZONA E: Escudo Fora (50x50px, à direita da Zona D)
    const zonaE_X = zonaD_StartX + zoneWidthLimit + margin;
    if (awayShield && awayShield.width > 1) {
      ctx.drawImage(awayShield, zonaE_X, yCenter - 25, shieldSize, shieldSize);
    }

    // ANCORAGEM DE TRANSMISSÃO: Centralizado abaixo do VS
    const infoY = yCenter + 65;
    const channelsStr = match.channels && match.channels.length > 0 
      ? match.channels[0] // Use first channel as primary transmission
      : "TRANSMISSÃO";
    
    ctx.textAlign = "center";
    ctx.font = "bold 24px Montserrat, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText(channelsStr.toUpperCase(), canvasCenterX, infoY);
    
    // Horário (opcional, mantido pequeno se necessário, ou omitido se o template já tiver)
    const timeStr = formatBrasiliaTime(match.match_time);
    ctx.font = "italic 20px Montserrat, sans-serif";
    ctx.fillText(timeStr, canvasCenterX, infoY + 25);
  }

  // 6. Footer - Persistence of design
  if (!backgroundUrl) {
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
