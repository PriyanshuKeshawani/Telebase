"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Database, Zap, Lock, HardDrive, Cpu, Radio, Plus, Trash2, 
  Download, RefreshCw, Key, Shield, AlertCircle, CheckCircle2,
  FileText, PlusCircle, ArrowLeft, Bot, Server
} from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  apiKey: string;
  channelId: string;
  storageType: "TELEGRAM" | "SUPABASE";
  botsCount: number;
}

interface StoredFile {
  uuid: string;
  filename: string;
  size: string;
  chunks: number;
  version: number;
  hash: string;
  createdAt: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([
    { id: "1", name: "Telebase Production", apiKey: "sk_proj_9e83cfd10842fe91aa0d6", channelId: "-100192837465", storageType: "TELEGRAM", botsCount: 3 },
    { id: "2", name: "Analytics Logs Backup", apiKey: "sk_proj_ff209c74ab9c34a9e91", channelId: "-100183749281", storageType: "TELEGRAM", botsCount: 1 }
  ]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("1");
  const [files, setFiles] = useState<StoredFile[]>([
    { uuid: "9c8a-b570643beaaa", filename: "user_database_backup.json", size: "24.5 MB", chunks: 2, version: 1, hash: "d68eecccf4aff424d68e...", createdAt: "2026-05-19 14:02" },
    { uuid: "f995-4371-9c8a-b570", filename: "media_assets_v2.zip", size: "389.2 MB", chunks: 21, version: 2, hash: "f3faa0c39ad07b3axieq...", createdAt: "2026-05-19 18:24" },
    { uuid: "b29b-18ae4817ed3c", filename: "system_logs_archive.json", size: "1.2 MB", chunks: 1, version: 1, hash: "8fd31bd6436e3cb2e776...", createdAt: "2026-05-20 00:15" }
  ]);

  // Modal State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [botTokens, setBotTokens] = useState<string[]>([""]);

  const [isLoading, setIsLoading] = useState(false);

  const handleAddBotTokenField = () => {
    setBotTokens([...botTokens, ""]);
  };

  const handleBotTokenChange = (index: number, val: string) => {
    const updated = [...botTokens];
    updated[index] = val;
    setBotTokens(updated);
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;

    const newProj: Project = {
      id: (projects.length + 1).toString(),
      name: newProjectName,
      apiKey: `sk_proj_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      channelId: newChannelId || "-100123456789",
      storageType: "TELEGRAM",
      botsCount: botTokens.filter(t => t.trim() !== "").length || 1
    };

    setProjects([...projects, newProj]);
    setSelectedProjectId(newProj.id);
    setIsNewProjectModalOpen(false);
    setNewProjectName("");
    setNewChannelId("");
    setBotTokens([""]);
  };

  const handleTriggerSync = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="relative min-h-screen bg-[#09090b] text-white">
      {/* Dynamic BG Gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6 mb-8">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Database className="text-blue-500 w-6 h-6" />
                <h1 className="text-2xl font-bold tracking-tight">TeleBase Dashboard</h1>
              </div>
              <p className="text-sm text-zinc-400">Professional-Grade Telegram Cloud Storage DX</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleTriggerSync}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition-all"
            >
              <RefreshCw size={15} className={`${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Restoring Index..." : "Force Sync State"}</span>
            </button>
            <button 
              onClick={() => setIsNewProjectModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-500/10"
            >
              <PlusCircle size={15} />
              <span>New Project</span>
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { title: "Total Saved Storage", val: "414.9 MB", desc: "Unlimited Free Telegram Space", icon: HardDrive, color: "text-blue-400" },
            { title: "Active Rotated Bots", val: projects.find(p => p.id === selectedProjectId)?.botsCount || 0, desc: "Token Load-Balancer pool", icon: Bot, color: "text-indigo-400" },
            { title: "AES-256 Auth Tag Pass", val: "100%", desc: "Verified GCM Cryptographic integrity", icon: Shield, color: "text-emerald-400" },
            { title: "Avg Network Latency", val: "84ms", desc: "Parallel multi-bot chunk fetches", icon: Radio, color: "text-violet-400" },
          ].map((stat, i) => (
            <div key={i} className="p-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md relative overflow-hidden group hover:border-zinc-700/80 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <stat.icon className="w-12 h-12" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-zinc-400 font-medium">{stat.title}</span>
              </div>
              <div className="text-2xl font-bold mb-1">{stat.val}</div>
              <p className="text-xs text-zinc-500">{stat.desc}</p>
            </div>
          ))}
        </section>

        {/* Workspace Matrix Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Hand: Project Panel */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Server size={18} className="text-blue-500" />
                <span>Active Project</span>
              </h2>
              
              <div className="space-y-3 mb-6">
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    onClick={() => setSelectedProjectId(proj.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedProjectId === proj.id 
                        ? "bg-blue-600/10 border-blue-500/50 text-white" 
                        : "bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:border-zinc-700/80 hover:text-zinc-200"
                    }`}
                  >
                    <div className="font-semibold text-sm mb-1">{proj.name}</div>
                    <div className="flex items-center gap-2 text-xs opacity-80">
                      <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-mono border border-zinc-700">{proj.storageType}</span>
                      <span>•</span>
                      <span>{proj.botsCount} Bots Rotation</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Selected Project Credentials display */}
              {(() => {
                const currentProj = projects.find(p => p.id === selectedProjectId);
                if (!currentProj) return null;
                return (
                  <div className="border-t border-zinc-800/80 pt-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5">
                        <Key size={12} className="text-zinc-500" />
                        <span>Project API Key</span>
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-950 p-2.5 rounded border border-zinc-800 font-mono text-[10px] select-all relative overflow-hidden">
                        <div className="truncate text-zinc-300 w-[90%]">{currentProj.apiKey}</div>
                        <CheckCircle2 size={12} className="text-emerald-500 absolute right-2" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5">
                        <Database size={12} className="text-zinc-500" />
                        <span>Telegram Channel ID</span>
                      </div>
                      <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800 font-mono text-[10px] text-zinc-300">
                        {currentProj.channelId}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Quick Security Tips */}
            <div className="p-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md">
              <h3 className="text-sm font-bold flex items-center gap-1.5 text-zinc-200 mb-3">
                <Shield size={16} className="text-emerald-500" />
                <span>AES-256-GCM Secure Cloud</span>
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                All uploaded chunks are fully encrypted on-the-fly inside our Node proxy using authenticated <strong>AES-256-GCM</strong>. Anyone inspecting the Telegram channel directly will only see raw encrypted binary noise.
              </p>
            </div>
          </div>

          {/* Right Hand: Files List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-xl border border-zinc-800/80 bg-zinc-900/30 backdrop-blur-md">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <FileText size={18} className="text-blue-500" />
                <span>Stored Secure Files</span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800/80 text-zinc-400 text-xs font-semibold">
                      <th className="py-3 px-4">Filename</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Chunks</th>
                      <th className="py-3 px-4">Status / Integrity</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr key={file.uuid} className="border-b border-zinc-800/30 hover:bg-zinc-900/20 transition-all text-sm">
                        <td className="py-4 px-4">
                          <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                            <span className="truncate max-w-[180px]">{file.filename}</span>
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded border border-blue-500/20">v{file.version}</span>
                          </div>
                          <div className="text-[10px] font-mono text-zinc-500 mt-1">UUID: {file.uuid}</div>
                        </td>
                        <td className="py-4 px-4 text-zinc-300 font-mono text-xs">{file.size}</td>
                        <td className="py-4 px-4">
                          <span className="text-xs bg-zinc-800 px-2 py-1 rounded font-mono text-zinc-300">{file.chunks} chunks</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 size={13} className="text-emerald-500" />
                            <span>SHA-256 Passed</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button className="p-2 rounded-lg bg-zinc-800/50 hover:bg-blue-600 hover:text-white text-zinc-400 transition-all">
                              <Download size={14} />
                            </button>
                            <button className="p-2 rounded-lg bg-zinc-800/50 hover:bg-rose-600/20 hover:text-rose-400 text-zinc-400 transition-all">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* New Project Modal */}
      <AnimatePresence>
        {isNewProjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#0e0e11] border border-zinc-800 rounded-2xl p-6 shadow-2xl relative"
            >
              <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                <PlusCircle size={20} className="text-blue-500" />
                <span>Create New TeleBase Project</span>
              </h3>
              <p className="text-xs text-zinc-500 mb-6">Connect a new private Telegram channel to use as database-less storage.</p>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Project Name</label>
                  <input 
                    type="text" 
                    required
                    value={newProjectName} 
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Telebase Prod Cloud" 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm focus:border-blue-500 outline-none text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Telegram Channel ID</label>
                  <input 
                    type="text" 
                    value={newChannelId} 
                    onChange={(e) => setNewChannelId(e.target.value)}
                    placeholder="e.g. -100XXXXXXXXXX" 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm focus:border-blue-500 outline-none text-white font-mono"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Rotated Bot Tokens</label>
                    <button 
                      type="button" 
                      onClick={handleAddBotTokenField}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      + Add Bot (Load Balancer)
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {botTokens.map((token, i) => (
                      <input 
                        key={i}
                        type="text" 
                        required={i === 0}
                        value={token} 
                        onChange={(e) => handleBotTokenChange(i, e.target.value)}
                        placeholder={`Bot Token #${i + 1}`}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm focus:border-blue-500 outline-none text-white font-mono text-xs"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-zinc-800/80 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className="w-full py-2.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-sm font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/10"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
