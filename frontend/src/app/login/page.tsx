"use client";

import React, { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Database, ShieldAlert, CheckCircle2, MessageSquare, Copy, ExternalLink, RefreshCw, Send } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>("TelebaseBot");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [verified, setVerified] = useState(false);

  // Poll for request verification status
  useEffect(() => {
    if (!code || !isPolling || verified) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/poll-login?code=${code}`);
        const data = await res.json();
        
        if (data.success && data.verified) {
          setVerified(true);
          setIsPolling(false);
          clearInterval(interval);
          
          // Auto sign in using next-auth
          const signInRes = await signIn("credentials", {
            code,
            redirect: false,
          });

          if (signInRes?.error) {
            setError("Authentication failed. Please try again.");
          } else {
            router.push("/dashboard");
            router.refresh();
          }
        } else if (!data.success && data.error !== "pending") {
          setError(data.error);
          setIsPolling(false);
          clearInterval(interval);
        }
      } catch (err) {
        // Suppress network errors during polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [code, isPolling, verified, router]);

  // Set webhook on render in production environment
  useEffect(() => {
    fetch("/api/auth/telegram-webhook").catch(() => {});
  }, []);

  const handleStartLogin = async () => {
    setIsLoading(true);
    setError(null);
    setCode(null);
    setVerified(false);
    
    try {
      const res = await fetch("/api/auth/login-code", { method: "POST" });
      const data = await res.json();
      
      if (data.success) {
        setCode(data.code);
        setBotUsername(data.botUsername || "TelebaseBot");
        setIsPolling(true);
      } else {
        setError(data.error || "Failed to generate login request.");
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

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#050506] px-6 text-white overflow-hidden">
      {/* Dynamic Ambient Blur */}
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[130px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        <div className="p-8 rounded-2xl border border-zinc-800/60 bg-[#0a0a0d]/85 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25">
              <Database size={24} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Welcome to TeleBase
            </h2>
            <p className="text-xs text-zinc-500 font-medium mt-2">
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
                <div className="text-center bg-[#07070a] border border-zinc-800/40 p-5 rounded-xl text-xs text-zinc-400 leading-relaxed">
                  TeleBase uses Telegram as the single secure identity provider. No passwords or email addresses are stored.
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 text-xs text-rose-400 font-medium bg-rose-500/8 p-4 rounded-xl border border-rose-500/15">
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
                <div className="flex flex-col items-center bg-[#07070a] border border-zinc-800/60 p-6 rounded-xl relative">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Your Authentication Code</span>
                  <span className="text-3xl font-mono tracking-wider font-extrabold text-blue-400 selection:bg-blue-500/20">{code}</span>
                  <div className="w-full border-t border-zinc-900 my-4" />
                  
                  <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                    Send the command below to the TeleBase Bot:
                  </p>
                  
                  <div className="w-full flex mt-3 bg-black/40 border border-zinc-800 rounded-lg overflow-hidden items-center">
                    <code className="text-xs font-mono text-zinc-400 px-3 flex-1 select-all py-2">/login {code}</code>
                    <button
                      onClick={handleCopy}
                      className="p-2 border-l border-zinc-800 hover:bg-zinc-800/50 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Copy Command"
                    >
                      <Copy size={14} className={copied ? "text-emerald-400" : ""} />
                    </button>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-blue-300 font-medium">
                  {verified ? (
                    <>
                      <CheckCircle2 size={16} className="text-emerald-400 animate-bounce" />
                      <span>Authorization complete! Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} className="animate-spin text-blue-400" />
                      <span>Waiting for Bot Verification...</span>
                    </>
                  )}
                </div>

                {/* Direct Bot Link */}
                <div className="flex flex-col gap-2.5">
                  <a
                    href={`https://t.me/${botUsername}?start=${code}`}
                    target="_blank"
                    rel="noreferrer"
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
                    className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-800"
                  >
                    <span>Open in Telegram Web</span>
                  </a>

                  <button
                    onClick={handleStartLogin}
                    className="w-full py-2.5 rounded-xl bg-transparent border border-zinc-900 hover:border-zinc-800 text-zinc-500 hover:text-zinc-400 text-[11px] transition-colors cursor-pointer"
                  >
                    Cancel / Generate New Code
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-[10px] text-zinc-700 mt-6">
          Exclusively secured via cryptographically signed Telegram requests.
        </p>
      </motion.div>
    </main>
  );
}
