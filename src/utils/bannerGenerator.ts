
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

  // 2. HEADER - "JOGOS DE HOJE" + DATA
  const headerY = 220;
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 90px Montserrat, sans-serif";
  
  const today = new Date();
  const dayName = today.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
  const dayNum = today.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  
  let mainTitle = `JOGOS DE HOJE - ${dayName}, ${dayNum}`;
  if (pageInfo && pageInfo.total > 1) {
    mainTitle += ` (${pageInfo.current}/${pageInfo.total})`;
  }
  
  // Limpar área do cabeçalho caso o template tenha texto fixo
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)"; // Cobertura escura para placeholders
  ctx.fillRect(100, headerY - 100, width - 200, 200);
  
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(mainTitle, width / 2, headerY);

  // 3. LOGO TV MAX
  if (logoImg && logoImg.width > 1) {
    const logoW = 180;
    const aspectRatio = logoImg.height / logoImg.width;
    const logoH = logoW * aspectRatio;
    ctx.drawImage(logoImg, width - logoW - 60, 60, logoW, logoH);
  }

  // 4. GRID DE JOGOS (Cordenadas Ajustadas por Zona)
  const startY = 520; // Ajustado para não colidir com o cabeçalho
  const rowHeight = 210;
  const shieldSize = 50; // Reduzido conforme solicitado
  const nameMaxWidth = 360; 
  const zonePadding = 100; // Maior recuo do VS central

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

    // ZONA CENTRAL (10%): VS
    ctx.textAlign = "center";
    ctx.font = "italic bold 56px Montserrat, sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("VS", canvasCenterX, yCenter + 15);

    // ZONA ESQUERDA (40%): [ESCUDO] + [NOME]
    // O nome fica alinhado à direita, encostando na margem do VS
    const leftNameRightEdge = canvasCenterX - zonePadding; 
    const homeNameSize = getAutoShrinkFontSize(match.home_team, nameMaxWidth, 44);
    ctx.font = `bold ${homeNameSize}px Montserrat, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.home_team.toUpperCase(), leftNameRightEdge, yCenter + 15);

    // Escudo Casa - Fica à esquerda do nome
    const homeNameWidth = ctx.measureText(match.home_team.toUpperCase()).width;
    const homeShieldX = leftNameRightEdge - homeNameWidth - shieldSize - 30;
    if (homeShield && homeShield.width > 1) {
      ctx.drawImage(homeShield, homeShieldX, yCenter - (shieldSize / 2), shieldSize, shieldSize);
    }

    // ZONA DIREITA (40%): [NOME] + [ESCUDO]
    // O nome fica alinhado à esquerda, encostando na margem do VS
    const rightNameLeftEdge = canvasCenterX + zonePadding; 
    const awayNameSize = getAutoShrinkFontSize(match.away_team, nameMaxWidth, 44);
    ctx.font = `bold ${awayNameSize}px Montserrat, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.away_team.toUpperCase(), rightNameLeftEdge, yCenter + 15);

    // Escudo Fora - Fica à direita do nome
    const awayNameWidth = ctx.measureText(match.away_team.toUpperCase()).width;
    const awayShieldX = rightNameLeftEdge + awayNameWidth + 30;
    if (awayShield && awayShield.width > 1) {
      ctx.drawImage(awayShield, awayShieldX, yCenter - (shieldSize / 2), shieldSize, shieldSize);
    }

    // INFORMAÇÕES DINÂMICAS: HORÁRIO | TRANSMISSÃO
    const infoY = yCenter + 85;
    const timeStr = formatBrasiliaTime(match.match_time);
    const transmission = match.channels && match.channels.length > 0 ? match.channels.join(" | ") : "ONDE ASSISTIR";
    const infoText = `${timeStr} | ${transmission}`.toUpperCase();
    
    ctx.textAlign = "center";
    ctx.font = "600 28px Montserrat, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillText(infoText, canvasCenterX, infoY);
  }

  // 5. FOOTER - Persistence of Design
  const footerY = 1820;
  ctx.textAlign = "center";
  ctx.font = "bold 34px Montserrat, sans-serif";
  const footerText = "ASSINE AGORA E NÃO PERCA NENHUM LANCE";
  
  // QR Code / CTA Button Style
  const btnWidth = 700;
  const btnHeight = 90;
  ctx.fillStyle = "#2563eb";
  ctx.beginPath();
  ctx.roundRect((width - btnWidth) / 2, footerY - 60, btnWidth, btnHeight, 45);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(footerText, width / 2, footerY);

  return canvas.toDataURL("image/png");
};
