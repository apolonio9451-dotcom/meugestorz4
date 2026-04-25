
export const generateVictoryBanner = async (
  participantName: string,
  brandLogo: string | null,
  backgroundUrl?: string,
): Promise<string> => {
  const width = 1080;
  const height = 1920; 
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Could not get canvas context");

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

  const defaultStadiumUrl = "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1080";
  const bgToUse = backgroundUrl || defaultStadiumUrl;
  
  const [bgImg, logoImg] = await Promise.all([
    loadImage(bgToUse),
    brandLogo ? loadImage(brandLogo) : Promise.resolve(null),
  ]);

  // 1. Draw Background & Base Layer
  ctx.drawImage(bgImg, 0, 0, width, height);
  
  // Dark overlay with premium gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(10, 10, 26, 0.85)");
  gradient.addColorStop(0.5, "rgba(5, 5, 16, 0.9)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.95)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Neon glow elements
  const drawGlow = (x: number, y: number, color: string) => {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 400);
    glow.addColorStop(0, color + "44");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 400, y - 400, 800, 800);
  };

  drawGlow(width / 2, height / 3, "#00f2ff"); // Cyan glow
  drawGlow(width / 2, (height * 2) / 3, "#7000ff"); // Purple glow

  // 2. Logo TV MAX
  if (logoImg) {
    const logoW = 350;
    const logoH = (logoImg.height / logoImg.width) * logoW;
    ctx.shadowBlur = 30;
    ctx.shadowColor = "#00f2ff";
    ctx.drawImage(logoImg, width / 2 - logoW / 2, 150, logoW, logoH);
    ctx.shadowBlur = 0;
  }

  // 3. Main Text "PARABÉNS"
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // "PARABÉNS" with neon effect
  ctx.font = "bold 120px Montserrat, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.shadowBlur = 20;
  ctx.shadowColor = "#00f2ff";
  ctx.fillText("PARABÉNS", width / 2, 600);
  
  // Winner Name
  ctx.font = "bold 100px Montserrat, sans-serif";
  ctx.fillStyle = "#00f2ff";
  ctx.shadowBlur = 15;
  ctx.fillText(participantName.toUpperCase(), width / 2, 720);
  ctx.shadowBlur = 0;

  // 4. Achievement Text
  ctx.font = "500 55px Montserrat, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("VOCÊ MITOU NO BOLÃO TV MAX", width / 2, 900);
  
  // Prize Text
  const prizeBoxY = 1050;
  const prizeBoxW = 900;
  const prizeBoxH = 200;
  
  // Glassmorphism box for prize
  ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(width / 2 - prizeBoxW / 2, prizeBoxY - prizeBoxH / 2, prizeBoxW, prizeBoxH, 30);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 70px Montserrat, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("GANHOU 30 DIAS GRÁTIS!", width / 2, prizeBoxY);

  // 5. Decorative elements
  // Football icon or pattern
  ctx.font = "150px serif";
  ctx.globalAlpha = 0.2;
  ctx.fillText("⚽", width / 2, 1350);
  ctx.globalAlpha = 1.0;

  // 6. Footer
  ctx.font = "400 40px Montserrat, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fillText("RESGATE SEU PRÊMIO PELO WHATSAPP", width / 2, 1750);

  return canvas.toDataURL("image/png");
};
