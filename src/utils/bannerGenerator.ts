
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
  dayOfWeek: string
): Promise<string> => {
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Could not get canvas context");

  // 1. Load all images first
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const stadiumUrl = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1080";
  const [bgImg, logoImg] = await Promise.all([
    loadImage(stadiumUrl),
    brandLogo ? loadImage(brandLogo).catch(() => null) : Promise.resolve(null),
  ]);

  // 2. Draw Background
  ctx.drawImage(bgImg, 0, 0, width, height);
  // Dark overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(0, 0, width, height);
  
  // Add some blur effect (simulated since native filter can be slow/buggy on some browsers)
  // Actually, standard Canvas filter works well enough if applied before drawing
  // but for simplicity and compatibility, we'll just use a dark gradient overlay
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(0, 0, 30, 0.8)");
  gradient.addColorStop(0.5, "rgba(10, 10, 20, 0.9)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.95)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 3. Draw Header
  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  
  // "JOGOS" title
  ctx.font = "bold 120px Montserrat, sans-serif";
  ctx.fillText("JOGOS", width / 2, 250);
  
  // Day of week
  ctx.font = "italic 40px Montserrat, sans-serif";
  ctx.fillStyle = "#3b82f6"; // blue-500
  ctx.fillText(dayOfWeek.toUpperCase(), width / 2, 310);

  // 4. Draw Brand Logo (Top Right)
  if (logoImg) {
    const logoWidth = 200;
    const aspectRatio = logoImg.height / logoImg.width;
    const logoHeight = logoWidth * aspectRatio;
    ctx.drawImage(logoImg, width - logoWidth - 50, 50, logoWidth, logoHeight);
  } else {
    // Default TV MAX logo if none provided
    ctx.font = "black italic 60px Montserrat, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("TV MAX", width - 50, 100);
  }

  // 5. Draw Matches
  const startY = 450;
  const rowHeight = 220;
  const maxMatches = 5; // Limit to fit in banner
  const matchesToDraw = matches.slice(0, maxMatches);

  for (let i = 0; i < matchesToDraw.length; i++) {
    const match = matchesToDraw[i];
    const y = startY + i * rowHeight;

    // Draw separator line
    if (i > 0) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, y - 50);
      ctx.lineTo(width - 100, y - 50);
      ctx.stroke();
    }

    // Load team shields (this should ideally be pre-loaded)
    try {
      const [homeShield, awayShield] = await Promise.all([
        loadImage(match.home_logo).catch(() => null),
        loadImage(match.away_logo).catch(() => null),
      ]);

      const shieldSize = 100;
      const centerX = width / 2;

      // Home Shield
      if (homeShield) {
        ctx.drawImage(homeShield, centerX - 400, y - 50, shieldSize, shieldSize);
      }
      
      // Home Name
      ctx.textAlign = "right";
      ctx.font = "bold 40px Montserrat, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(match.home_team.toUpperCase(), centerX - 120, y + 15);

      // "X"
      ctx.textAlign = "center";
      ctx.font = "italic 50px Montserrat, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillText("X", centerX, y + 15);

      // Away Name
      ctx.textAlign = "left";
      ctx.font = "bold 40px Montserrat, sans-serif";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(match.away_team.toUpperCase(), centerX + 120, y + 15);

      // Away Shield
      if (awayShield) {
        ctx.drawImage(awayShield, centerX + 300, y - 50, shieldSize, shieldSize);
      }

      // Time and Channels
      ctx.textAlign = "center";
      ctx.font = "500 30px Montserrat, sans-serif";
      ctx.fillStyle = "#94a3b8"; // slate-400
      const timeStr = match.match_time.split("T")[1]?.substring(0, 5) || "";
      const channelsStr = match.channels?.join(" | ") || "";
      ctx.fillText(`${timeStr} | ${channelsStr}`, centerX, y + 70);

    } catch (e) {
      console.error("Error drawing match", e);
    }
  }

  // 6. Draw Footer CTA
  ctx.textAlign = "center";
  const footerY = height - 150;
  
  // Rounded button background for CTA
  const ctaText = "ASSINE AGORA E ASSISTA EM 4K";
  ctx.font = "bold 35px Montserrat, sans-serif";
  const textWidth = ctx.measureText(ctaText).width;
  const padding = 40;
  
  ctx.fillStyle = "#2563eb"; // blue-600
  const btnWidth = textWidth + padding * 2;
  const btnHeight = 70;
  const btnX = (width - btnWidth) / 2;
  const btnY = footerY - 45;
  
  // Draw rounded rect
  const radius = 35;
  ctx.beginPath();
  ctx.moveTo(btnX + radius, btnY);
  ctx.lineTo(btnX + btnWidth - radius, btnY);
  ctx.quadraticCurveTo(btnX + btnWidth, btnY, btnX + btnWidth, btnY + radius);
  ctx.lineTo(btnX + btnWidth, btnY + btnHeight - radius);
  ctx.quadraticCurveTo(btnX + btnWidth, btnY + btnHeight, btnX + btnWidth - radius, btnY + btnHeight);
  ctx.lineTo(btnX + radius, btnY + btnHeight);
  ctx.quadraticCurveTo(btnX, btnY + btnHeight, btnX, btnY + btnHeight - radius);
  ctx.lineTo(btnX, btnY + radius);
  ctx.quadraticCurveTo(btnX, btnY, btnX + radius, btnY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(ctaText, width / 2, footerY);

  return canvas.toDataURL("image/png");
};
