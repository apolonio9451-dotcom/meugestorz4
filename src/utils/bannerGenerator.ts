
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

    // 1. ZONA VERDE (HORÁRIO) - Cobertura de limpeza e texto
    const timeY = yCenter - 65;
    const timeStr = formatBrasiliaTime(match.match_time);
    
    // Opcional: Desenhar fundo se o template tiver texto fixo
    // ctx.fillStyle = "#054523"; 
    // ctx.fillRect(canvasCenterX - 100, timeY - 30, 200, 50);

    ctx.textAlign = "center";
    ctx.font = "bold 38px Montserrat, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(timeStr, canvasCenterX, timeY);

    // 2. ZONA CENTRAL: VS
    ctx.textAlign = "center";
    ctx.font = "italic bold 52px Montserrat, sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("VS", canvasCenterX, yCenter + 20);

    // 3. ZONA PRETA (NOMES E ESCUDOS) - Central
    // Cobertura de limpeza (opcional, mas garante que placeholders sumam)
    // ctx.fillStyle = "#000000";
    // ctx.fillRect(100, yCenter - 40, 350, 80); // Lado Esquerdo
    // ctx.fillRect(width - 450, yCenter - 40, 350, 80); // Lado Direito

    // Escudo Casa (Extremidade Esquerda)
    const shieldY = yCenter - (shieldSize / 2) + 5;
    const homeShieldX = 130; 
    if (homeShield && homeShield.width > 1) {
      ctx.drawImage(homeShield, homeShieldX, shieldY, shieldSize, shieldSize);
    }

    // Nome Casa (Alinhado à Direita, sem encostar no VS)
    const leftNameRightEdge = canvasCenterX - zonePadding;
    const homeNameSize = getAutoShrinkFontSize(match.home_team, nameMaxWidth, 44);
    ctx.font = `bold ${homeNameSize}px Montserrat, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.home_team.toUpperCase(), leftNameRightEdge, yCenter + 20);

    // Nome Fora (Alinhado à Esquerda, sem encostar no VS)
    const rightNameLeftEdge = canvasCenterX + zonePadding;
    const awayNameSize = getAutoShrinkFontSize(match.away_team, nameMaxWidth, 44);
    ctx.font = `bold ${awayNameSize}px Montserrat, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.away_team.toUpperCase(), rightNameLeftEdge, yCenter + 20);

    // Escudo Fora (Extremidade Direita)
    const awayShieldX = width - 130 - shieldSize;
    if (awayShield && awayShield.width > 1) {
      ctx.drawImage(awayShield, awayShieldX, shieldY, shieldSize, shieldSize);
    }

    // 4. ZONA BRANCA (TRANSMISSÃO) - Inferior
    const transmissionY = yCenter + 95;
    const transmission = match.channels && match.channels.length > 0 ? match.channels.join(" | ") : "ONDE ASSISTIR";
    
    // Cobertura de limpeza (opcional)
    // ctx.fillStyle = "#FFFFFF";
    // ctx.fillRect(canvasCenterX - 200, transmissionY - 30, 400, 50);

    ctx.textAlign = "center";
    ctx.font = "bold 30px Montserrat, sans-serif";
    ctx.fillStyle = "#000033"; // Cor escura para contraste no branco
    ctx.fillText(transmission.toUpperCase(), canvasCenterX, transmissionY);
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
