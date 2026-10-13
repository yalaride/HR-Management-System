"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

// Inline Left Vector Illustration (Design System Matched)
function LeftIllustration() {
  return (
    <div className="relative w-full flex items-center justify-center">
      <div className="absolute inset-0 bg-sky-200/40 blur-[40px] rounded-full scale-90 -z-10" />
      <svg
        viewBox="0 0 500 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto transition-transform duration-500 hover:scale-[1.02]"
      >
        <rect x="50" y="320" width="400" height="12" rx="6" fill="#e2e8f0" />
        <rect x="90" y="332" width="12" height="50" fill="#cbd5e1" />
        <rect x="398" y="332" width="12" height="50" fill="#cbd5e1" />

        <rect x="180" y="180" width="140" height="100" rx="10" fill="#0f172a" />
        <rect
          x="188"
          y="188"
          width="124"
          height="84"
          rx="6"
          fill="#2563eb"
          fillOpacity="0.15"
        />
        <rect x="235" y="280" width="30" height="30" fill="#94a3b8" />
        <rect x="210" y="310" width="80" height="10" rx="5" fill="#64748b" />

        <rect x="200" y="200" width="45" height="25" rx="4" fill="#2563eb" />
        <rect
          x="252"
          y="200"
          width="48"
          height="25"
          rx="4"
          fill="#0284c7"
          fillOpacity="0.4"
        />
        <circle cx="215" cy="245" r="12" fill="#2563eb" />
        <rect x="235" y="240" width="55" height="6" rx="3" fill="#cbd5e1" />
        <rect x="235" y="250" width="35" height="6" rx="3" fill="#e2e8f0" />

        <path d="M 80 320 L 90 270 L 120 270 L 130 320 Z" fill="#2563eb" />
        <path
          d="M 105 270 C 80 230, 60 210, 75 190 C 95 210, 100 240, 105 270 Z"
          fill="#10b981"
        />
        <path
          d="M 105 270 C 130 230, 150 210, 135 190 C 115 210, 110 240, 105 270 Z"
          fill="#059669"
        />

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

// Inline Right Vector Illustration (Design System Matched)
function RightIllustration() {
  return (
    <div className="relative w-full flex items-center justify-center">
      <div className="absolute inset-0 bg-cyan-200/30 blur-[40px] rounded-full scale-90 -z-10" />
      <svg
        viewBox="0 0 500 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto transition-transform duration-500 hover:scale-[1.02]"
      >
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

        <path
          d="M 220 320 Q 280 370 360 350 L 370 380 Q 270 400 200 340 Z"
          fill="#0f172a"
        />
        <rect x="360" y="340" width="40" height="20" rx="8" fill="#fbbf24" />

        <rect x="210" y="210" width="80" height="100" rx="20" fill="#fbbf24" />
        <circle cx="250" cy="170" r="28" fill="#fde047" />
        <path
          d="M 230 155 C 240 140, 270 140, 275 160 C 260 160, 240 165, 230 155 Z"
          fill="#0f172a"
        />

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

        <circle cx="140" cy="140" r="5" fill="#ffffff" />
        <circle cx="380" cy="120" r="7" fill="#fde047" />
        <circle cx="410" cy="150" r="4" fill="#ffffff" />
      </svg>
    </div>
  );
}

// Styled Password Field Component
function StyledPasswordInput({
  label,
  value,
  onChange,
  placeholder = "••••••••",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <label className="block text-[13px] font-bold text-slate-700 mb-[6px]">
        {label}
      </label>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          required
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-[48px] px-[16px] pl-[44px] pr-[44px] rounded-[14px] bg-slate-50 border border-slate-200 text-[14px] text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent transition-all disabled:opacity-60"
        />
        {/* Left Lock Icon */}
        <svg
          className="w-[20px] h-[20px] text-slate-400 absolute left-[14px] top-1/2 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>

        {/* Right Toggle Eye Icon */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-[14px] top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          {showPassword ? (
            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.52 10.52 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          ) : (
            <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.074 4.148 4.77 7.25 9.964 7.25 5.194 0 8.89-3.102 9.964-7.25C20.89 7.852 17.194 4.75 12 4.75c-5.194 0-8.89 3.102-9.964 7.25z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// Reset Password Inner Content Block
function ResetPasswordFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const missingParams = !token || !email;

  useEffect(() => {
    if (!token || !email) {
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(
          `/api/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`
        );
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data.message || "This password reset link is invalid or has expired.");
          setTokenValid(false);
        } else {
          setTokenValid(true);
        }
      } catch {
        setError("Unable to connect to the verification server. Please try again.");
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token, email]);

  const isVerifying = !missingParams && verifying;
  const isTokenValid = !missingParams && tokenValid;
  const displayError = missingParams
    ? "The reset parameters are missing. Please request a new link."
    : error;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          token,
          newPassword: password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || "Failed to update password.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 3500);
    } catch {
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      
      {/* 1. Verifying State Spinner */}
      {isVerifying && (
        <div className="text-center py-[32px] space-y-[16px]">
          <div className="w-[36px] h-[36px] border-3 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[14px] font-semibold text-slate-600">
            Verifying secure authorization link...
          </p>
        </div>
      )}

      {/* 2. Error Display (If token verification failed) */}
      {!isVerifying && !isTokenValid && (
        <div className="space-y-[20px]">
          <div className="w-[48px] h-[48px] rounded-[14px] bg-rose-500/10 text-rose-600 flex items-center justify-center">
            <svg className="w-[24px] h-[24px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>

          <div>
            <h1 className="text-[24px] sm:text-[28px] font-black tracking-tight text-slate-900 mb-[6px]">
              Invalid Link
            </h1>
            <p className="text-[14px] font-medium text-slate-500 leading-relaxed">
              The password reset link you used might be expired, already used, or modified.
            </p>
          </div>

          <div className="p-[14px] rounded-[14px] bg-rose-50 border border-rose-200/80 text-rose-800 text-[13px] font-semibold flex items-start gap-[10px]">
            <svg className="w-[18px] h-[18px] text-rose-600 shrink-0 mt-[1px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{displayError || "Verification failed."}</span>
          </div>

          <Link
            href="/forgot-password"
            className="w-full h-[48px] rounded-[14px] bg-gradient-to-r from-brand-accent to-brand-hover hover:from-brand-hover hover:to-brand-hover text-white text-[15px] font-bold transition-all flex items-center justify-center gap-[8px]"
          >
            Request New Reset Link
          </Link>

          <div className="pt-[12px] text-center">
            <Link href="/" className="text-[14px] font-bold text-slate-600 hover:text-brand-accent transition-colors">
              Back to Login
            </Link>
          </div>
        </div>
      )}

      {/* 3. Main Form Area (If token is valid) */}
      {!isVerifying && isTokenValid && (
        <div>
          {/* Header Icon */}
          <div className="w-[48px] h-[48px] rounded-[14px] bg-brand-subtle text-brand-accent flex items-center justify-center mb-[20px]">
            <svg className="w-[24px] h-[24px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>

          <h1 className="text-[24px] sm:text-[28px] font-black tracking-tight text-slate-900 mb-[6px]">
            Set New Password
          </h1>
          <p className="text-[14px] font-medium text-slate-500 mb-[24px] leading-relaxed">
            Please enter your new security credentials below to update your account access.
          </p>

          {/* Validation Error Alert */}
          {error && (
            <div className="mb-[20px] p-[14px] rounded-[14px] bg-rose-50 border border-rose-200/80 text-rose-800 text-[13px] font-semibold flex items-start gap-[10px]">
              <svg className="w-[18px] h-[18px] text-rose-600 shrink-0 mt-[1px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Success State */}
          {success ? (
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-[16px] p-[20px] text-center space-y-[12px]">
              <div className="w-[40px] h-[40px] bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto">
                <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-[16px] font-bold text-emerald-900">
                Password Reset Successful!
              </h3>
              <p className="text-[13px] text-emerald-700 font-medium">
                Your credentials have been updated. Redirecting to login in a moment...
              </p>
            </div>
          ) : (
            /* Main Form Inputs */
            <form onSubmit={handleSubmit} className="space-y-[18px]">
              <StyledPasswordInput
                label="New Password"
                value={password}
                onChange={setPassword}
                disabled={loading}
              />

              <StyledPasswordInput
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading}
              className="w-full h-[48px] mt-[8px] rounded-[14px] bg-gradient-to-r from-brand-accent to-brand-hover hover:from-brand-hover hover:to-brand-hover text-white text-[15px] font-bold transition-all cursor-pointer flex items-center justify-center gap-[8px]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-[8px]">
                    <span className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating Password...
                  </span>
                ) : (
                  "Save New Password"
                )}
              </button>
            </form>
          )}

          {/* Back to Sign In Link */}
          <div className="mt-[24px] pt-[20px] border-t border-slate-100 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-[8px] text-[14px] font-bold text-slate-600 hover:text-brand-accent transition-colors"
            >
              <svg className="w-[16px] h-[16px]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Login
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}

// Exported Page Component with Exact Pixel Layout Alignment
export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen w-full bg-slate-50 font-sans antialiased flex flex-col lg:h-screen lg:overflow-hidden">
      
      {/* Precision Header (72px Height - System Uniformity) */}
      <header className="sticky top-0 z-40 w-full h-[72px] flex items-center justify-between px-[16px] sm:px-[32px] lg:px-[48px] 2xl:px-[64px] bg-white/80 backdrop-blur-[12px] border-b border-slate-200/80 shrink-0">
        
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-[12px]">
          <div className="w-[40px] h-[40px] rounded-[12px] bg-brand-accent text-white flex items-center justify-center font-black text-[20px]">
            S
          </div>
          <span className="text-[22px] font-black tracking-tight text-slate-900">
            Syncup<span className="text-brand-accent">.</span>
          </span>
        </Link>

        {/* Header Badges */}
        <div className="flex items-center gap-[12px]">
          
          {/* Status Indicator */}
          <div className="inline-flex items-center gap-[8px] px-[14px] py-[6px] rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[13px] font-semibold text-emerald-700">
            <span className="relative flex h-[8px] w-[8px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-[8px] w-[8px] bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">Systems Normal</span>
            <span className="sm:hidden">Online</span>
          </div>

          {/* Version Tag */}
          <span className="px-[14px] py-[6px] rounded-full bg-brand-subtle text-brand-accent border border-brand-accent/20 text-[13px] font-bold">
            v2.4
          </span>

        </div>

      </header>

      {/* Main Pixel-Controlled Split Content */}
      <div className="relative flex-1 flex flex-col lg:flex-row w-full h-[calc(100vh-72px)] min-h-0">
        
        {/* LEFT HALF - Pure White Background with Subtle Radial Pattern */}
        <div className="relative w-full lg:w-1/2 h-full bg-white flex items-center justify-start overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
          
          {/* Left Wing Illustration Container */}
          <div className="hidden lg:flex w-full justify-start items-center pl-[32px] xl:pl-[64px] 2xl:pl-[120px]">
            <div className="w-[280px] xl:w-[360px] 2xl:w-[440px] shrink-0">
              <LeftIllustration />
            </div>
          </div>

        </div>

        {/* RIGHT HALF - Deep Teal Gradient Background */}
        <div className="relative w-full lg:w-1/2 h-full bg-gradient-to-br from-brand-accent via-brand-hover to-brand-hover flex items-center justify-end overflow-hidden">
          
          {/* Ambient Glows */}
          <div className="absolute -top-[80px] -right-[80px] w-[320px] h-[320px] bg-cyan-300/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-[80px] -left-[80px] w-[320px] h-[320px] bg-sky-400/20 rounded-full blur-[80px] pointer-events-none" />

          {/* Right Wing Illustration Container */}
          <div className="hidden lg:flex w-full justify-end items-center pr-[32px] xl:pr-[64px] 2xl:pr-[120px]">
            <div className="w-[280px] xl:w-[360px] 2xl:w-[440px] shrink-0">
              <RightIllustration />
            </div>
          </div>

        </div>

        {/* CENTER FLOATING CARD (Wrapped in Suspense for CSR Next.js Search Params) */}
        <div className="w-full max-w-[440px] sm:max-w-[480px] lg:max-w-[520px] xl:max-w-[580px] 2xl:max-w-[640px] lg:absolute lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 z-30 px-[16px] py-[32px] lg:p-0 my-auto mx-auto">
          <div className="bg-white/95 backdrop-blur-[16px] rounded-[24px] p-[24px] sm:p-[28px] xl:p-[36px] border border-slate-200/80 transition-all">
            <Suspense
              fallback={
                <div className="text-center py-[24px] space-y-[12px]">
                  <div className="w-[32px] h-[32px] border-3 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-[13px] font-semibold text-slate-500">Loading parameters...</p>
                </div>
              }
            >
              <ResetPasswordFormContent />
            </Suspense>
          </div>
        </div>

      </div>

    </div>
  );
}