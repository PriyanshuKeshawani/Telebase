"use client";

import React, { useState, useRef, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Lock, Mail, AlertCircle, RefreshCw, CheckCircle2, UserPlus, LogIn, ShieldCheck, ArrowLeft } from "lucide-react";

type AuthStep = "form" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // OTP verification state
  const [authStep, setAuthStep] = useState<AuthStep>("form");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleTabChange = (tab: "signin" | "register") => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
    setPassword("");
    setAuthStep("form");
    setOtpDigits(["", "", "", "", "", ""]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (activeTab === "register") {
        // Step 1: Send registration request → get OTP
        const regRes = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const regData = await regRes.json();
        
        if (!regData.success) {
          setError(regData.error || "Failed to create account.");
        } else {
          // Move to OTP verification step
          setAuthStep("otp");
          setSuccess("Verification code sent! Check your email inbox.");
          setResendCooldown(60);
          // Focus first OTP input
          setTimeout(() => otpInputRefs.current[0]?.focus(), 300);
        }
      } else {
        // Sign in flow
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (res?.error) {
          setError("Invalid credentials. If you are new, please register first.");
        } else {
          router.push("/dashboard");
          router.refresh();
        }
      }
    } catch (e: any) {
      setError("An unexpected network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP digit input
  const handleOTPChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    if (digit && index === 5) {
      const fullOTP = [...newDigits.slice(0, 5), digit].join("");
      if (fullOTP.length === 6) {
        handleVerifyOTP(fullOTP);
      }
    }
  };

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split("");
      setOtpDigits(digits);
      otpInputRefs.current[5]?.focus();
      handleVerifyOTP(pasted);
    }
  };

  const handleVerifyOTP = async (otpCode: string) => {
    setIsVerifyingOTP(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Verification failed.");
        setOtpDigits(["", "", "", "", "", ""]);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } else {
        setSuccess("Email verified! Signing you in...");
        
        // Auto sign-in after verification
        setTimeout(async () => {
          try {
            const signInRes = await signIn("credentials", {
              email,
              password,
              redirect: false,
            });

            if (signInRes?.error) {
              setActiveTab("signin");
              setAuthStep("form");
              setError("Account created! Please sign in manually.");
              setSuccess(null);
            } else {
              router.push("/dashboard");
              router.refresh();
            }
          } catch {
            setActiveTab("signin");
            setAuthStep("form");
            setError("Account created! Please sign in manually.");
            setSuccess(null);
          } finally {
            setIsVerifyingOTP(false);
          }
        }, 1500);
        return;
      }
    } catch (err: any) {
      setError("Network error during verification.");
      setOtpDigits(["", "", "", "", "", ""]);
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success) {
        setSuccess("New verification code sent!");
        setResendCooldown(60);
        setOtpDigits(["", "", "", "", "", ""]);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } else {
        setError(data.error || "Failed to resend code.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#050506] px-6 text-white overflow-hidden">
      {/* Ambient Gradients */}
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-blue-600/8 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/8 blur-[140px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        {/* Card */}
        <div className="p-8 rounded-2xl border border-zinc-800/60 bg-[#0a0a0d]/80 backdrop-blur-xl">
          
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
              <Database size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Welcome to TeleBase
            </h2>
            <p className="text-xs text-zinc-500 font-medium mt-1.5">
              Serverless Database powered by Telegram
            </p>
          </div>

          <AnimatePresence mode="wait">
            {authStep === "form" ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Tab Selector */}
                <div className="grid grid-cols-2 p-1 bg-[#08080a] border border-zinc-800/40 rounded-xl mb-6">
                  <button
                    onClick={() => handleTabChange("signin")}
                    className={`py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === "signin"
                        ? "bg-zinc-800/70 text-white border border-zinc-700/50 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <LogIn size={13} />
                    <span>Sign In</span>
                  </button>
                  <button
                    onClick={() => handleTabChange("register")}
                    className={`py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === "register"
                        ? "bg-zinc-800/70 text-white border border-zinc-700/50 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <UserPlus size={13} />
                    <span>Register</span>
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Mail size={11} className="text-zinc-500" />
                      <span>Email Address</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none text-white transition-all placeholder:text-zinc-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Lock size={11} className="text-zinc-500" />
                      <span>Password</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={6}
                      className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none text-white transition-all placeholder:text-zinc-700"
                    />
                  </div>

                  {/* Error / Success Messages */}
                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-start gap-2.5 text-xs text-rose-400 font-medium bg-rose-500/8 p-3 rounded-xl border border-rose-500/15"
                      >
                        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </motion.div>
                    )}

                    {success && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-start gap-2.5 text-xs text-emerald-400 font-medium bg-emerald-500/8 p-3 rounded-xl border border-emerald-500/15"
                      >
                        <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                        <span>{success}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/15 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>{activeTab === "register" ? "Sending Code..." : "Signing In..."}</span>
                      </>
                    ) : (
                      <span>{activeTab === "register" ? "Send Verification Code" : "Sign In"}</span>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              /* ════════ OTP VERIFICATION STEP ════════ */
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Back button */}
                <button
                  onClick={() => { setAuthStep("form"); setError(null); setSuccess(null); }}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-6 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to registration</span>
                </button>

                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={22} className="text-emerald-400" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Verify Your Email</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    We sent a 6-digit code to<br />
                    <strong className="text-zinc-300">{email}</strong>
                  </p>
                </div>

                {/* OTP Input Grid */}
                <div className="flex items-center justify-center gap-2.5 mb-6" onPaste={handleOTPPaste}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpInputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOTPChange(i, e.target.value)}
                      onKeyDown={(e) => handleOTPKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-xl font-bold rounded-xl border outline-none transition-all ${
                        digit
                          ? "bg-blue-500/8 border-blue-500/30 text-white"
                          : "bg-[#08080a] border-zinc-800/50 text-zinc-400"
                      } focus:border-blue-500/50 focus:bg-blue-500/5`}
                      disabled={isVerifyingOTP}
                    />
                  ))}
                </div>

                {/* Error / Success Messages */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-start gap-2.5 text-xs text-rose-400 font-medium bg-rose-500/8 p-3 rounded-xl border border-rose-500/15 mb-4"
                    >
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  {success && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-start gap-2.5 text-xs text-emerald-400 font-medium bg-emerald-500/8 p-3 rounded-xl border border-emerald-500/15 mb-4"
                    >
                      <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{success}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Verify Button */}
                <button
                  onClick={() => {
                    const code = otpDigits.join("");
                    if (code.length === 6) handleVerifyOTP(code);
                  }}
                  disabled={isVerifyingOTP || otpDigits.join("").length < 6}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-2 cursor-pointer mb-4"
                >
                  {isVerifyingOTP ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Verify & Create Account</span>
                    </>
                  )}
                </button>

                {/* Resend */}
                <div className="text-center">
                  <p className="text-[11px] text-zinc-600 mb-1">Didn't receive the code?</p>
                  {resendCooldown > 0 ? (
                    <span className="text-[11px] text-zinc-500 font-medium">
                      Resend in <strong className="text-zinc-300">{resendCooldown}s</strong>
                    </span>
                  ) : (
                    <button
                      onClick={handleResendOTP}
                      disabled={isLoading}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Resend verification code
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer hint */}
        <p className="text-center text-[10px] text-zinc-700 mt-4">
          Secured with SHA-256 hashing • Zero external auth dependencies
        </p>
      </motion.div>
    </main>
  );
}
