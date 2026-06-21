"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Database, ShieldAlert, CheckCircle2, MessageSquare, Copy, ExternalLink, RefreshCw, Send, Clock } from "lucide-react";

// Safe error message map — never expose raw API internals to the user
const SAFE_ERRORS: Record<string, string> = {
  "Code not recognised. Please generate a new one.": "Code not recognised. Please generate a new one.",
  "Your code has expired. Please generate a new one.": "Your code has expired. Please generate a new one.",
  "This code has already been used.": "This code has already been used.",
  "Code was cancelled. Please generate a new one.": "Code was cancelled. Please generate a new one.",
};

function safeError(raw: string | undefined): string {
  if (!raw) return "An error occurred. Please try again.";
  if (raw.toLowerCase().includes("too many")) {
    return "Too many attempts. Please try again later.";
  }
  return SAFE_ERRORS[raw] ?? "An error occurred. Please try again.";
}

// Polling UX state
type PollingStatus = "waiting" | "verifying" | "redirecting";

export default function LoginClient() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>("TelebaseBot");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<PollingStatus>("waiting");
  const [openedBot, setOpenedBot] = useState(false);

  // Cooldown for "Generate New Code" button
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);
  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown ticker
  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setCooldownLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(left);
      if (left === 0 && cooldownTimer.current) {
        clearInterval(cooldownTimer.current);
        cooldownTimer.current = null;
      }
    };
    tick();
    cooldownTimer.current = setInterval(tick, 1000);
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, [cooldownUntil]);

  // Poll for request verification status
  useEffect(() => {
    if (!code || !isPolling || pollingStatus !== "waiting") return;

    let timerId: ReturnType<typeof setTimeout> | null = null;
    const startTime = Date.now();

    const poll = async () => {
      try {
        const res = await fetch(`/api/auth/poll-login?code=${code}`);
        const data = await res.json();

        if (data.success && data.verified) {
          setIsPolling(false);
          setPollingStatus("verifying");

          // Auto sign in using custom JWT auth
          const signInRes = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          const signInData = await signInRes.json();

          if (!signInData.success) {
            setError(safeError(signInData.error));
            setPollingStatus("waiting");
          } else {
            setPollingStatus("redirecting");
            setTimeout(() => {
              router.push("/dashboard");
              router.refresh();
            }, 800);
          }
          return;
        } else if (!data.success) {
          // Only stop polling for terminal errors (expired, cancelled, already used)
          const isTerminal =
            res.status === 410 || res.status === 409 || res.status === 404;
          if (isTerminal) {
            setError(safeError(data.error));
            setIsPolling(false);
            return;
          }
          // 429s are ignored — keep polling
        }
      } catch (err) {
        // Suppress transient network errors during polling
      }

      const elapsed = Date.now() - startTime;
      const delay = elapsed < 30000 ? 1000 : 3000;
      timerId = setTimeout(poll, delay);
    };

    // Initial check
    const elapsed = Date.now() - startTime;
    const initialDelay = elapsed < 30000 ? 1000 : 3000;
    timerId = setTimeout(poll, initialDelay);

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [code, isPolling, pollingStatus, router]);

  // Set webhook on render in production environment
  useEffect(() => {
    fetch("/api/auth/telegram-webhook").catch(() => {});
  }, []);

  const handleStartLogin = async () => {
    if (cooldownLeft > 0) return;

    setIsLoading(true);
    setError(null);
    setCode(null);
    setPollingStatus("waiting");
    setOpenedBot(false);

    try {
      const res = await fetch("/api/auth/login-code", { method: "POST" });
      
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          const m = Math.floor(seconds / 60);
          const s = seconds % 60;
          setError(`Too many attempts. Try again in ${m}m ${s}s`);
          return;
        }
      }

      const data = await res.json();

      if (data.success) {
        setCode(data.code);
        setBotUsername(data.botUsername || "TelebaseBot");
        setIsPolling(true);
        setPollingStatus("waiting");
        // 30-second cooldown on the button (as requested)
        setCooldownUntil(Date.now() + 30_000);
      } else {
        setError(safeError(data.error));
      }
    } catch (err) {
      setError("Network connection issue. Please retry.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (code) {
      navigator.clipboard.writeText(`/login ${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const pollingLabel = {
    waiting: "Waiting for verification...",
    verifying: "Verifying...",
    redirecting: "Login successful. Redirecting...",
  }[pollingStatus];

  const newCodeLabel =
    cooldownLeft > 0
      ? `Generate New Code (${cooldownLeft}s)`
      : "Cancel / Generate New Code";

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-bg-base px-6 text-text-primary overflow-hidden">
      {/* Dynamic Ambient Blur */}
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 dark:bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/5 dark:bg-indigo-600/10 blur-[130px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="p-8 rounded-2xl border border-border-subtle bg-bg-surface/85 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25">
              <Database size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary">
              Welcome to TeleBase
            </h2>
            <p className="text-xs text-text-muted font-medium mt-2">
              Telegram-Backed Secure Storage Engine
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!code ? (
              <motion.div
                key="initial"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="text-center bg-bg-input border border-border-subtle p-5 rounded-xl text-xs text-text-secondary leading-relaxed">
                  TeleBase uses Telegram as the single secure identity provider. No passwords or email addresses are stored.
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-500/8 p-4 rounded-xl border border-rose-500/15">
                    <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={handleStartLogin}
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/15 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Generating secure code...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Login with Telegram</span>
                    </>
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="code-ready"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Code display */}
                <div className="flex flex-col items-center bg-bg-input border border-border-subtle p-6 rounded-xl relative">
                  <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-3">Your Authentication Code</span>
                  <span className="text-3xl font-mono tracking-wider font-extrabold text-blue-600 dark:text-blue-400 selection:bg-blue-500/20">{code}</span>
                  <div className="w-full border-t border-border-subtle my-4" />

                  <p className="text-[11px] text-text-secondary text-center leading-relaxed">
                    Send the command below to the TeleBase Bot:
                  </p>

                  <div className="w-full flex mt-3 bg-bg-base border border-border-subtle rounded-lg overflow-hidden items-center">
                    <code className="text-xs font-mono text-text-secondary px-3 flex-1 select-all py-2">/login {code}</code>
                    <button
                      onClick={handleCopy}
                      className="p-2 border-l border-border-subtle hover:bg-bg-input text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                      title="Copy Command"
                    >
                      <Copy size={14} className={copied ? "text-emerald-500" : ""} />
                    </button>
                  </div>
                </div>

                {/* 4-Step Progress Indicator */}
                <div className="bg-bg-input border border-border-subtle p-5 rounded-xl space-y-3">
                  <div className="flex items-center gap-3 text-xs">
                    {(openedBot || pollingStatus !== "waiting") ? (
                      <span className="text-emerald-500 dark:text-emerald-400 font-bold">✓</span>
                    ) : (
                      <span className="text-text-muted font-bold animate-pulse">⏳</span>
                    )}
                    <span className={(openedBot || pollingStatus !== "waiting") ? "text-text-primary" : "text-text-muted"}>
                      Open Telegram Bot
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    {(pollingStatus !== "waiting") ? (
                      <span className="text-emerald-500 dark:text-emerald-400 font-bold">✓</span>
                    ) : (
                      <span className="text-text-muted font-bold">⏳</span>
                    )}
                    <span className={(pollingStatus !== "waiting") ? "text-text-primary" : "text-text-muted"}>
                      Send /login {code}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    {pollingStatus === "redirecting" ? (
                      <span className="text-emerald-500 dark:text-emerald-400 font-bold">✓</span>
                    ) : pollingStatus === "verifying" ? (
                      <span className="text-amber-500 dark:text-amber-400 font-bold animate-spin">⏳</span>
                    ) : (
                      <span className="text-text-muted font-bold">⏳</span>
                    )}
                    <span className={pollingStatus === "verifying" ? "text-amber-600 dark:text-amber-300 font-medium" : pollingStatus === "redirecting" ? "text-text-primary" : "text-text-muted"}>
                      {pollingStatus === "verifying" ? "Verifying..." : "Waiting for verification"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    {pollingStatus === "redirecting" ? (
                      <span className="text-emerald-500 dark:text-emerald-400 font-bold animate-pulse">⏳</span>
                    ) : (
                      <span className="text-text-muted font-bold">⏳</span>
                    )}
                    <span className={pollingStatus === "redirecting" ? "text-emerald-500 dark:text-emerald-400 font-medium" : "text-text-muted"}>
                      Redirecting to dashboard
                    </span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className={`flex items-center justify-center gap-3 p-4 rounded-xl text-xs font-medium border ${
                  pollingStatus === "redirecting"
                    ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                    : pollingStatus === "verifying"
                    ? "bg-amber-500/5 border-amber-500/10 text-amber-600 dark:text-amber-300"
                    : "bg-blue-500/5 border-blue-500/10 text-blue-600 dark:text-blue-300"
                }`}>
                  {pollingStatus === "redirecting" ? (
                    <>
                      <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400" />
                      <span>{pollingLabel}</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>{pollingLabel}</span>
                    </>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400 font-medium bg-rose-500/8 p-4 rounded-xl border border-rose-500/15">
                    <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Direct Bot Link */}
                <div className="flex flex-col gap-2.5">
                  <a
                    href={`https://t.me/${botUsername}?start=${code}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpenedBot(true)}
                    className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-blue-500/30"
                  >
                    <MessageSquare size={15} />
                    <span>Open Telegram Bot</span>
                    <ExternalLink size={13} className="opacity-75" />
                  </a>

                  <a
                    href={`https://web.telegram.org/a/#?tgaddr=tg%3A%2F%2Fresolve%3Fdomain%3D${botUsername}%26start%3D${code}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpenedBot(true)}
                    className="w-full py-3 rounded-xl bg-bg-input hover:bg-bg-base text-text-primary text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-border-subtle"
                  >
                    <span>Open in Telegram Web</span>
                  </a>

                  <button
                    onClick={handleStartLogin}
                    disabled={cooldownLeft > 0 || isLoading}
                    className="w-full py-2.5 rounded-xl bg-transparent border border-border-subtle hover:border-text-muted/30 text-text-muted hover:text-text-secondary text-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    {cooldownLeft > 0 && <Clock size={11} className="text-text-muted" />}
                    <span>{newCodeLabel}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-[10px] text-text-muted mt-6">
          Exclusively secured via cryptographically signed Telegram requests.
        </p>
      </motion.div>
    </main>
  );
}
