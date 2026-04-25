
export interface MatchData {
  home_team: string;
  away_team: string;
  home_logo: string;
  away_logo: string;
  match_time: string;
  league_name: string;
  channels: string[];
}

export const generateBannerCanvas = async (
  matches: MatchData[],
  brandLogo: string | null,
  dayOfWeek: string,
  templateId: number = 1
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
        // Fallback for failed images - return a 1x1 transparent pixel
        const fallback = new Image();
        fallback.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
        resolve(fallback);
      };
      img.src = src;
    });
  };

  // Helper to adjust time to Brasília (UTC-3)
  const formatBrasiliaTime = (isoString: string) => {
    const date = new Date(isoString);
    // Force UTC-3
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const brasiliaDate = new Date(utc + (3600000 * -3));
    return brasiliaDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const stadiumUrl = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1080";
  
  // Load background and logo
  const [bgImg, logoImg] = await Promise.all([
    loadImage(stadiumUrl),
    brandLogo ? loadImage(brandLogo) : Promise.resolve(null),
  ]);

  // 1. Draw Background
  ctx.drawImage(bgImg, 0, 0, width, height);
  
  // Dark overlay gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (templateId === 2) {
    // Neon purple/blue gradient
    gradient.addColorStop(0, "rgba(20, 0, 40, 0.9)");
    gradient.addColorStop(0.5, "rgba(30, 0, 60, 0.95)");
    gradient.addColorStop(1, "rgba(10, 0, 20, 0.98)");
  } else {
    gradient.addColorStop(0, "rgba(0, 0, 20, 0.85)");
    gradient.addColorStop(0.5, "rgba(5, 5, 10, 0.9)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.95)");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Watermark "TV MAX" (Subtle)
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.font = "bold 150px Montserrat, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.textAlign = "center";
  ctx.fillText("TV MAX", 0, 0);
  ctx.fillText("TV MAX", -400, 400);
  ctx.fillText("TV MAX", 400, -400);
  ctx.restore();

  // 3. Draw Header
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  
  // "JOGOS" title
  ctx.font = "bold 140px Montserrat, sans-serif";
  const titleColor = templateId === 2 ? "#d8b4fe" : "#FFFFFF"; // purple-300 for template 2
  ctx.fillStyle = titleColor;
  ctx.shadowColor = templateId === 2 ? "rgba(168, 85, 247, 0.8)" : "rgba(59, 130, 246, 0.5)";
  ctx.shadowBlur = 30;
  ctx.fillText("JOGOS", width / 2, 280);
  ctx.shadowBlur = 0;
  
  // Day of week
  ctx.font = "italic 50px Montserrat, sans-serif";
  ctx.fillStyle = "#3b82f6"; // blue-500
  ctx.fillText(dayOfWeek.toUpperCase(), width / 2, 350);

  // 4. Draw Brand Logo (Top Right)
  if (logoImg && logoImg.width > 1) {
    const logoWidth = 180;
    const aspectRatio = logoImg.height / logoImg.width;
    const logoHeight = logoWidth * aspectRatio;
    ctx.drawImage(logoImg, width - logoWidth - 60, 60, logoWidth, logoHeight);
  } else {
    // Default TV MAX logo text
    ctx.font = "black italic 60px Montserrat, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("TV MAX", width - 60, 110);
  }

  // 5. Draw Matches
  const startY = 550;
  const rowHeight = 240;
  const maxMatches = templateId === 3 ? 1 : 5;
  const matchesToDraw = matches.slice(0, maxMatches);

  for (let i = 0; i < matchesToDraw.length; i++) {
    const match = matchesToDraw[i];
    const y = startY + i * rowHeight;

    // Draw row background (subtle)
    ctx.fillStyle = templateId === 2 
      ? "rgba(168, 85, 247, 0.05)" 
      : "rgba(255, 255, 255, 0.03)";
    ctx.beginPath();
    ctx.roundRect(80, y - 100, width - 160, rowHeight, 30);
    ctx.fill();
    
    if (templateId === 2) {
      ctx.strokeStyle = "rgba(168, 85, 247, 0.2)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const [homeShield, awayShield] = await Promise.all([
      loadImage(match.home_logo),
      loadImage(match.away_logo),
    ]);

    const shieldSize = 120;
    const centerX = width / 2;

    // Home Shield
    if (homeShield && homeShield.width > 1) {
      ctx.drawImage(homeShield, centerX - 420, y - 60, shieldSize, shieldSize);
    }
    
    // Home Name
    ctx.textAlign = "right";
    ctx.font = "bold 42px Montserrat, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.home_team.toUpperCase(), centerX - 120, y + 15);

    // "X"
    ctx.textAlign = "center";
    ctx.font = "italic 55px Montserrat, sans-serif";
    ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
    ctx.fillText("X", centerX, y + 15);

    // Away Name
    ctx.textAlign = "left";
    ctx.font = "bold 42px Montserrat, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(match.away_team.toUpperCase(), centerX + 120, y + 15);

    // Away Shield
    if (awayShield && awayShield.width > 1) {
      ctx.drawImage(awayShield, centerX + 300, y - 60, shieldSize, shieldSize);
    }

    // Time and Channels
    ctx.textAlign = "center";
    ctx.font = "500 34px Montserrat, sans-serif";
    ctx.fillStyle = "#94a3b8"; // slate-400
    const timeStr = formatBrasiliaTime(match.match_time);
    const channelsStr = match.channels && match.channels.length > 0 
      ? ` | ${match.channels.join(" & ")}` 
      : "";
    ctx.fillText(`${timeStr}${channelsStr}`, centerX, y + 85);
  }

  // 6. Draw Footer CTA
  ctx.textAlign = "center";
  const footerY = height - 180;
  
  const ctaText = "ASSINE AGORA E ASSISTA EM 4K";
  ctx.font = "bold 38px Montserrat, sans-serif";
  const textWidth = ctx.measureText(ctaText).width;
  const padding = 50;
  
  ctx.fillStyle = "#2563eb"; // blue-600
  const btnWidth = textWidth + padding * 2;
  const btnHeight = 85;
  const btnX = (width - btnWidth) / 2;
  const btnY = footerY - 55;
  
  // Draw rounded rect with glow
  ctx.shadowColor = "rgba(37, 99, 235, 0.5)";
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 42.5);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(ctaText, width / 2, footerY);

  return canvas.toDataURL("image/png");
};
