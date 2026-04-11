/**
 * Inline SVG logo for "Meu Gestor – Gestão Inteligente".
 * Renders instantly (no network request) and follows the active theme
 * via CSS custom properties.
 */
const BrandLogoInline = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 260 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Meu Gestor – Gestão Inteligente"
  >
    <defs>
      {/* Gradient that adapts to the active theme via CSS vars */}
      <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="hsl(var(--primary))" />
        <stop offset="100%" stopColor="hsl(var(--accent))" />
      </linearGradient>
      <linearGradient id="logo-grad-glow" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="hsl(var(--primary) / 0.6)" />
        <stop offset="100%" stopColor="hsl(var(--accent) / 0.4)" />
      </linearGradient>
    </defs>

    {/* Decorative icon – stylised "M" mark */}
    <rect x="0" y="4" width="32" height="32" rx="8" fill="url(#logo-grad)" opacity="0.15" />
    <path
      d="M8 28V12l8 10 8-10v16"
      stroke="url(#logo-grad)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    {/* "Meu Gestor" – main title */}
    <text
      x="40"
      y="22"
      fontFamily="'Space Grotesk', system-ui, sans-serif"
      fontWeight="700"
      fontSize="20"
      fill="url(#logo-grad)"
      letterSpacing="-0.5"
    >
      Meu Gestor
    </text>

    {/* "Gestão Inteligente" – subtitle */}
    <text
      x="40"
      y="36"
      fontFamily="'Inter', system-ui, sans-serif"
      fontWeight="400"
      fontSize="9"
      fill="hsl(var(--muted-foreground))"
      letterSpacing="1.5"
    >
      GESTÃO INTELIGENTE
    </text>
  </svg>
);

export default BrandLogoInline;
