"use client";

import LoginForm from "./components/LoginForm";

// Inline Left Vector Illustration (Styled with Global Brand Colors)
function LeftIllustration() {
  return (
    <div className="relative w-full flex items-center justify-center">
      {/* Background Soft Glow */}
      <div className="absolute inset-0 bg-brand-subtle/50 blur-[40px] rounded-full scale-90 -z-10" />
      <svg
        viewBox="0 0 500 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto transition-transform duration-500 hover:scale-[1.02]"
      >
        {/* Desk Base */}
        <rect x="50" y="320" width="400" height="12" rx="6" fill="#e2e8f0" />
        <rect x="90" y="332" width="12" height="50" fill="#cbd5e1" />
        <rect x="398" y="332" width="12" height="50" fill="#cbd5e1" />

        {/* Monitor Base & Display */}
        <rect x="180" y="180" width="140" height="100" rx="10" fill="#0f172a" />
        <rect
          x="188"
          y="188"
          width="124"
          height="84"
          rx="6"
          fill="#2563eb"
          fillOpacity="0.18"
        />
        <rect x="235" y="280" width="30" height="30" fill="#94a3b8" />
        <rect x="210" y="310" width="80" height="10" rx="5" fill="#64748b" />

        {/* UI Elements on Display */}
        <rect x="200" y="200" width="45" height="25" rx="4" fill="#2563eb" />
        <rect
          x="252"
          y="200"
          width="48"
          height="25"
          rx="4"
          fill="#1d4ed8"
          fillOpacity="0.5"
        />
        <circle cx="215" cy="245" r="12" fill="#2563eb" />
        <rect x="235" y="240" width="55" height="6" rx="3" fill="#cbd5e1" />
        <rect x="235" y="250" width="35" height="6" rx="3" fill="#e2e8f0" />

        {/* Plant Pot */}
        <path d="M 80 320 L 90 270 L 120 270 L 130 320 Z" fill="#2563eb" />
        <path
          d="M 105 270 C 80 230, 60 210, 75 190 C 95 210, 100 240, 105 270 Z"
          fill="#10b981"
        />
        <path
          d="M 105 270 C 130 230, 150 210, 135 190 C 115 210, 110 240, 105 270 Z"
          fill="#059669"
        />

        {/* Floating Badges */}
        <g className="animate-bounce" style={{ animationDuration: "3.5s" }}>
          <rect
            x="320"
            y="120"
            width="110"
            height="60"
            rx="12"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="2"
          />
          <circle cx="345" cy="150" r="12" fill="#10b981" fillOpacity="0.2" />
          <path
            d="M 340 150 L 344 154 L 352 145"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="365" y="140" width="50" height="8" rx="4" fill="#0f172a" />
          <rect x="365" y="153" width="35" height="6" rx="3" fill="#94a3b8" />
        </g>

        <g className="animate-pulse" style={{ animationDuration: "4s" }}>
          <rect
            x="70"
            y="100"
            width="100"
            height="55"
            rx="12"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="2"
          />
          <rect x="85" y="115" width="40" height="8" rx="4" fill="#2563eb" />
          <rect x="85" y="130" width="65" height="6" rx="3" fill="#cbd5e1" />
        </g>
      </svg>
    </div>
  );
}

// Inline Right Vector Illustration (Styled with Global Brand Colors)
function RightIllustration() {
  return (
    <div className="relative w-full flex items-center justify-center">
      {/* Background Soft Glow */}
      <div className="absolute inset-0 bg-brand-accent/20 blur-[40px] rounded-full scale-90 -z-10" />
      <svg
        viewBox="0 0 500 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto transition-transform duration-500 hover:scale-[1.02]"
      >
        {/* Lounge Chair Backing */}
        <path
          d="M 120 380 C 100 280, 180 180, 320 180 C 420 180, 450 280, 430 380 Z"
          fill="#ffffff"
          fillOpacity="0.15"
        />
        <path
          d="M 140 370 C 130 290, 200 210, 310 210 C 400 210, 420 290, 400 370 Z"
          fill="#ffffff"
          fillOpacity="0.2"
        />

        {/* Character Seated */}
        <path
          d="M 220 320 Q 280 370 360 350 L 370 380 Q 270 400 200 340 Z"
          fill="#0f172a"
        />
        <rect x="360" y="340" width="40" height="20" rx="8" fill="#fbbf24" />

        {/* Torso & Head */}
        <rect x="210" y="210" width="80" height="100" rx="20" fill="#fbbf24" />
        <circle cx="250" cy="170" r="28" fill="#fde047" />
        <path
          d="M 230 155 C 240 140, 270 140, 275 160 C 260 160, 240 165, 230 155 Z"
          fill="#0f172a"
        />

        {/* Tablet Display */}
        <rect
          x="180"
          y="230"
          width="90"
          height="60"
          rx="8"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="3"
        />
        <rect x="188" y="238" width="74" height="44" rx="4" fill="#2563eb" />
        <line
          x1="195"
          y1="250"
          x2="235"
          y2="250"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <line
          x1="195"
          y1="262"
          x2="220"
          y2="262"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="248" cy="256" r="8" fill="#ffffff" fillOpacity="0.6" />

        {/* Arms */}
        <path
          d="M 220 230 Q 180 250 190 270"
          stroke="#fbbf24"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 280 230 Q 290 270 260 280"
          stroke="#fbbf24"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Accent Shapes */}
        <circle cx="140" cy="140" r="5" fill="#ffffff" />
        <circle cx="380" cy="120" r="7" fill="#fde047" />
        <circle cx="410" cy="150" r="4" fill="#ffffff" />
      </svg>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen w-full bg-surface-main font-sans antialiased flex flex-col lg:h-screen lg:overflow-hidden">
      
      {/* Precision Header (72px Height) */}
      <header className="sticky top-0 z-40 w-full h-[72px] flex items-center justify-between px-[16px] sm:px-[32px] lg:px-[48px] 2xl:px-[64px] bg-surface-card/80 backdrop-blur-[12px] border-b border-line-subtle shrink-0">
        
        {/* Brand Logo - Using CSS Theme Colors */}
        <div className="flex items-center gap-[12px]">
          <div className="w-[40px] h-[40px] rounded-[12px] bg-brand-accent text-white flex items-center justify-center font-black text-[20px] shadow-sm">
            S
          </div>
          <span className="text-[22px] font-black tracking-tight text-content-main">
            Syncup<span className="text-brand-accent">.</span>
          </span>
        </div>

        {/* Header Badges */}
        <div className="flex items-center gap-[12px]">
          
          {/* Status Badge */}
          <div className="inline-flex items-center gap-[8px] px-[14px] py-[6px] rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[13px] font-semibold text-emerald-700">
            <span className="relative flex h-[8px] w-[8px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-[8px] w-[8px] bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">Systems Normal</span>
            <span className="sm:hidden">Online</span>
          </div>

          {/* Version Tag - Using Brand Theme Accent */}
          <span className="px-[14px] py-[6px] rounded-full bg-brand-subtle text-brand-accent border border-brand-accent/20 text-[13px] font-bold">
            v2.4
          </span>

        </div>

      </header>

      {/* Main Split Content */}
      <div className="relative flex-1 flex flex-col lg:flex-row w-full h-[calc(100vh-72px)] min-h-0">
        
        {/* LEFT HALF - Pure White Background with Subtle Grid Pattern */}
        <div className="relative w-full lg:w-1/2 h-full bg-surface-card flex items-center justify-start overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
          
          {/* Left Wing Illustration Box */}
          <div className="hidden lg:flex w-full justify-start items-center pl-[32px] xl:pl-[64px] 2xl:pl-[120px]">
            <div className="w-[280px] xl:w-[360px] 2xl:w-[440px] shrink-0">
              <LeftIllustration />
            </div>
          </div>

        </div>

        {/* RIGHT HALF - Deep Brand Blue Gradient Background */}
        <div className="relative w-full lg:w-1/2 h-full bg-gradient-to-br from-brand-accent via-brand-hover to-brand-hover flex items-center justify-end overflow-hidden">
          
          {/* Ambient Radial Background Glows */}
          <div className="absolute -top-[80px] -right-[80px] w-[320px] h-[320px] bg-brand-accent/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-[80px] -left-[80px] w-[320px] h-[320px] bg-brand-subtle/20 rounded-full blur-[80px] pointer-events-none" />

          {/* Right Wing Illustration Box */}
          <div className="hidden lg:flex w-full justify-end items-center pr-[32px] xl:pr-[64px] 2xl:pr-[120px]">
            <div className="w-[280px] xl:w-[360px] 2xl:w-[440px] shrink-0">
              <RightIllustration />
            </div>
          </div>

        </div>

        {/* CENTER FLOATING LOGIN CARD */}
        <div className="w-full max-w-[440px] sm:max-w-[480px] lg:max-w-[520px] xl:max-w-[580px] 2xl:max-w-[640px] lg:absolute lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 z-30 px-[16px] py-[32px] lg:p-0 my-auto mx-auto">
          <div className="bg-surface-card/95 backdrop-blur-[16px] rounded-[24px] p-[24px] sm:p-[28px] xl:p-[36px] border border-line-subtle shadow-lg transition-all">
            <LoginForm />
          </div>
        </div>

      </div>

    </div>
  );
}