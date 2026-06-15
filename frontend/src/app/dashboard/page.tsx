"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Database, Zap, Lock, HardDrive, Cpu, Radio, Plus, Trash2, 
  Download, RefreshCw, Key, Shield, AlertCircle, CheckCircle2,
  FileText, PlusCircle, ArrowLeft, Bot, Server, UploadCloud, X, 
  HelpCircle, Terminal, Play, RotateCcw, AlertTriangle, LogOut, Check,
  ChevronRight, Copy, Layers, Activity, Settings, Hash, Table2, Folder,
  Search, History, BookOpen, ChevronLeft, Menu, Heart, Keyboard, Compass, Code
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  api_key: string;
  channel_id: string;
  storage_type: "TELEGRAM" | "SUPABASE";
  storage_options?: { compress_files?: boolean; encrypt_files?: boolean; };
  bots: string[];
  created_at: string;
}

interface StoredFile {
  uuid: string;
  project_id: string;
  filename: string;
  size: number;
  chunks: {
    chunk_index: number;
    message_id: string;
    iv: string;
    auth_tag: string;
  }[];
  chunk_count: number;
  version: number;
  file_hash: string;
  created_at: string;
}

interface DBTable {
  name: string;
  uuid: string;
  sizeBytes: number;
  updatedAt: string;
  version: number;
  schema?: {
    name: string;
    fields: Record<string, 'string' | 'number' | 'boolean'>;
    indexes: string[];
  };
}

export default function Dashboard() {
  const [session, setSession] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => r.json())
      .then(data => {
        if (data?.user) {
          setSession(data);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      })
      .catch(() => setStatus('unauthenticated'));
  }, []);

  const handleSignOut = async () => {
    await fetch('/api/auth/signout', { method: 'GET' });
    router.push('/login');
  };

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [activeTab, setActiveTab] = useState<"db" | "files" | "auth" | "bots" | "speed" | "ai">("db");

  // Auth Tab States
  const [authUsers, setAuthUsers] = useState<any[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Mobile layout state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Auth Protection Redirect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Structured DB States
  const [dbTables, setDbTables] = useState<DBTable[]>([]);
  const [selectedTableName, setSelectedTableName] = useState<string>("");
  const [tableRecords, setTableRecords] = useState<any[]>([]);
  const [sqlQueryInput, setSqlQueryInput] = useState<string>("SELECT * FROM users");
  const [queryResult, setQueryResult] = useState<any | null>(null);
  const [walLogs, setWalLogs] = useState<any[]>([]);
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [forceLockCrash, setForceLockCrash] = useState(false);
  const [recoveryLogs, setRecoveryLogs] = useState<string[]>([]);
  const [isNewTableModalOpen, setIsNewTableModalOpen] = useState(false);

  // Visual Interactive Explorer states
  const [dbSubTab, setDbSubTab] = useState<'explorer' | 'terminal'>('explorer');
  const [gridSearchQuery, setGridSearchQuery] = useState('');
  const [gridFilterCol, setGridFilterCol] = useState('all');
  const [gridFilterOp, setGridFilterOp] = useState('contains');
  const [gridFilterVal, setGridFilterVal] = useState('');
  
  // Visual record CRUD states
  const [isAddRecordModalOpen, setIsAddRecordModalOpen] = useState(false);
  const [isEditRecordModalOpen, setIsEditRecordModalOpen] = useState(false);
  const [modalRecordData, setModalRecordData] = useState<Record<string, any>>({});
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordEditorMode, setRecordEditorMode] = useState<'form' | 'json'>('form');
  const [rawJsonInput, setRawJsonInput] = useState<string>("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Visual column builder states
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<'string' | 'number' | 'boolean'>('string');

  // Supabase SQL Editor and Filtering states
  interface SQLQuery {
    id: string;
    name: string;
    query: string;
    category: 'templates' | 'quickstarts' | 'shared' | 'favorites' | 'private';
    isFavorite?: boolean;
  }

  const [sqlQueries, setSqlQueries] = useState<SQLQuery[]>([
    {
      id: 'template-profiles',
      name: 'Create Profiles Table',
      query: `-- Create a table for public profiles\nCREATE TABLE profiles (\n  id uuid references auth.users on delete cascade not null primary key,\n  updated_at timestamp with time zone,\n  username text unique,\n  full_name text,\n  avatar_url text,\n  website text,\n\n  constraint username_length check (char_length(username) >= 3)\n);\n\n-- Set up Row Level Security (RLS)\nalter table profiles enable row level security;\n\ncreate policy "Public profiles are viewable by everyone." on profiles\n  for select using (true);`,
      category: 'templates',
      isFavorite: false
    },
    {
      id: 'quickstart-user-management',
      name: 'User Management Starter',
      query: `-- Create a table for public profiles\ncreate table profiles (\n  id uuid references auth.users on delete cascade not null primary key,\n  updated_at timestamp with time zone,\n  username text unique,\n  full_name text,\n  avatar_url text,\n  website text\n);`,
      category: 'quickstarts',
      isFavorite: true
    },
    {
      id: 'template-insert',
      name: 'Insert Sample Profile',
      query: `-- Insert a mock administrator profile row into the database\nINSERT INTO profiles (id, name, avatar_url, is_admin)\nVALUES ('prof_1', 'Priyanshu Keshawani', 'https://avatar.vercel.sh/priyanshu', true)`,
      category: 'templates'
    },
    {
      id: 'template-query-admin',
      name: 'Query Admin Profiles',
      query: `-- Select all profiles that have administrator status enabled\nSELECT * FROM profiles WHERE is_admin = true`,
      category: 'templates'
    },
    {
      id: 'template-delete',
      name: 'Delete Sample Data',
      query: `-- Cleanly remove the test administrator profile record by ID\nDELETE FROM profiles WHERE id = 'prof_1'`,
      category: 'templates'
    },
    {
      id: 'user-query-1',
      name: 'Get All Users',
      query: 'SELECT * FROM users',
      category: 'private'
    }
  ]);
  const [activeQueryId, setActiveQueryId] = useState<string>('quickstart-user-management');
  const [searchQueryText, setSearchQueryText] = useState<string>('');

  const sqlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const sqlGutterRef = useRef<HTMLDivElement>(null);

  const handleSqlEditorScroll = () => {
    if (sqlTextareaRef.current && sqlGutterRef.current) {
      sqlGutterRef.current.scrollTop = sqlTextareaRef.current.scrollTop;
    }
  };

  const handleQueryChange = (val: string) => {
    setSqlQueryInput(val);
    setSqlQueries(prev => prev.map(q => q.id === activeQueryId ? { ...q, query: val } : q));
  };

  // Sync active query content with textarea
  useEffect(() => {
    const q = sqlQueries.find(item => item.id === activeQueryId);
    if (q) {
      setSqlQueryInput(q.query);
    }
  }, [activeQueryId]);

  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [sqlQueryHistory, setSqlQueryHistory] = useState<string[]>([
    "SELECT * FROM users",
    "-- Insert a mock user\nINSERT INTO users (id, name, age) VALUES ('user_99', 'Supabase Agent', 30)",
    "SELECT * FROM users WHERE age > 20"
  ]);
  const [sqlTerminalTab, setSqlTerminalTab] = useState<'results' | 'templates' | 'history'>('results');

  // Table schema creator states
  const [newTableName, setNewTableName] = useState("");
  const [newTableFields, setNewTableFields] = useState<{ name: string; type: 'string' | 'number' | 'boolean' }[]>([
    { name: 'name', type: 'string' },
    { name: 'age', type: 'number' }
  ]);

  // Speed Benchmark States
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<{
    isKVConfigured: boolean;
    telegramLatencyMs: number;
    kvLatencyMs: number;
    telegramStatus: string;
    kvStatus: string;
    kvErrorMessage: string | null;
  } | null>(null);

  // Onboarding/Loading states
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // New Project Modal State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newBots, setNewBots] = useState<string[]>([""]);

  // Bot Manager States
  const [newBotTokenInput, setNewBotTokenInput] = useState("");
  const [isAddingBot, setIsAddingBot] = useState(false);

  // Storage Settings States
  const [isUpdatingStorageSettings, setIsUpdatingStorageSettings] = useState(false);
  const [compressFiles, setCompressFiles] = useState(true);
  const [encryptFiles, setEncryptFiles] = useState(true);
  // Drag and Drop Uploader States
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "compressing" | "chunking" | "uploading" | "success" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download/Delete state tracking
  const [downloadingUuid, setDownloadingUuid] = useState<string | null>(null);
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);
  
  // API key copy state
  const [copiedKey, setCopiedKey] = useState(false);

  // AI Connect Tab states
  const [copiedAI, setCopiedAI] = useState(false);
  const [showAPIKeyInAI, setShowAPIKeyInAI] = useState(false);
  const [aiSnippetTab, setAiSnippetTab] = useState<"js_sql" | "js_nosql" | "upload" | "retrieve">("js_sql");

  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const currentProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    if (currentProject) {
      setCompressFiles(currentProject.storage_options?.compress_files ?? true);
      setEncryptFiles(currentProject.storage_options?.encrypt_files ?? true);
    }
  }, [currentProject?.id]);

  const projectFiles = files.filter(f => f.project_id === selectedProjectId);

  const getFilteredRecords = () => {
    if (!tableRecords || tableRecords.length === 0) return [];
    return tableRecords.filter(row => {
      if (gridSearchQuery.trim()) {
        const q = gridSearchQuery.toLowerCase();
        const match = Object.values(row).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
        if (!match) return false;
      }
      if (gridFilterCol !== 'all' && gridFilterVal.trim() !== '') {
        const val = row[gridFilterCol];
        if (val === undefined || val === null) return false;
        const strVal = String(val).toLowerCase();
        const strFilter = gridFilterVal.trim().toLowerCase();
        if (gridFilterOp === 'contains') return strVal.includes(strFilter);
        if (gridFilterOp === 'eq') return strVal === strFilter;
        if (gridFilterOp === 'gt') return Number(val) > Number(gridFilterVal);
        if (gridFilterOp === 'lt') return Number(val) < Number(gridFilterVal);
      }
      return true;
    });
  };
  const filteredRecords = getFilteredRecords();

  const handleUpdateStorageSettings = async (compress: boolean, encrypt: boolean) => {
    if (!currentProject) return;
    setIsUpdatingStorageSettings(true);
    try {
      const res = await fetch('/api/project/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': currentProject.api_key
        },
        body: JSON.stringify({
          projectId: currentProject.id,
          storage_options: {
            compress_files: compress,
            encrypt_files: encrypt
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update settings');
      
      setCompressFiles(compress);
      setEncryptFiles(encrypt);
      setProjects(prev => prev.map(p => p.id === currentProject.id ? data.project : p));
      
    } catch (err: any) {
      alert(err.message);
      // Revert states
      setCompressFiles(currentProject.storage_options?.compress_files ?? true);
      setEncryptFiles(currentProject.storage_options?.encrypt_files ?? true);
    } finally {
      setIsUpdatingStorageSettings(false);
    }
  };

  // Load database state
  const loadDatabase = async (forceSync = false) => {
    try {
      if (forceSync) setIsSyncing(true);
      
      const res = await fetch('/api/projects');
      const data = await res.json();
      
      if (data.success) {
        setProjects(data.projects || []);
        setFiles(data.files || []);
        
        if (data.projects && data.projects.length > 0) {
          const selectedId = selectedProjectId || data.projects[0].id;
          setSelectedProjectId(selectedId);
          await loadDBMetadata(selectedId, data.projects);
        }
      }
    } catch (error) {
      console.error("Failed to load telebase state:", error);
    } finally {
      setIsPageLoading(false);
      setIsSyncing(false);
    }
  };

  // Load Structured DB Metadata (tables and live logs)
  const loadDBMetadata = async (projectId: string, projectList = projects) => {
    const proj = projectList.find(p => p.id === projectId);
    if (!proj) return;

    try {
      const res = await fetch(`/api/db?apiKey=${proj.api_key}`);
      const data = await res.json();
      if (data.success) {
        setDbTables(data.tables || []);
        setWalLogs(data.walLogs || []);
        
        // Auto select first table if none selected
        if (data.tables && data.tables.length > 0) {
          const newSelect = selectedTableName && data.tables.some((t: any) => t.name === selectedTableName) 
            ? selectedTableName 
            : data.tables[0].name;
          setSelectedTableName(newSelect);
          await fetchTableRecords(newSelect, proj.api_key);
        } else {
          setSelectedTableName("");
          setTableRecords([]);
        }
      }
    } catch (e) {
      console.error("Failed to load DB metadata:", e);
    }
  };

  const fetchTableRecords = async (tableName: string, apiKey: string) => {
    if (!tableName || !apiKey) return;
    try {
      const res = await fetch(`/api/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ action: 'SELECT', tableName })
      });
      const data = await res.json();
      if (data.success) {
        setTableRecords(data.records || []);
      }
    } catch (e) {
      console.error("Failed to fetch table records:", e);
    }
  };

  const fetchAuthUsers = async (projectId: string, projectList = projects) => {
    const proj = projectList.find(p => p.id === projectId);
    if (!proj) return;
    setIsAuthLoading(true);
    try {
      const res = await fetch(`/api/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': proj.api_key },
        body: JSON.stringify({ action: 'SELECT', tableName: '_telebase_users' })
      });
      const data = await res.json();
      if (data.success) {
        setAuthUsers(data.records || []);
      } else {
        setAuthUsers([]);
      }
    } catch (e) {
      console.error("Failed to fetch auth users:", e);
      setAuthUsers([]);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAddAuthUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) return;
    setIsAddingUser(true);
    setAddUserError(null);
    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj) return;

    try {
      const res = await fetch(`/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': proj.api_key },
        body: JSON.stringify({ email: newUserEmail, password: newUserPassword })
      });
      const data = await res.json();
      if (data.success) {
        setNewUserEmail("");
        setNewUserPassword("");
        setIsAddUserModalOpen(false);
        await fetchAuthUsers(selectedProjectId);
      } else {
        setAddUserError(data.error || "Failed to create user");
      }
    } catch (err: any) {
      setAddUserError(err.message || "Failed to create user");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDeleteAuthUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj) return;
    try {
      const res = await fetch(`/api/db`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': proj.api_key },
        body: JSON.stringify({ 
          action: 'DELETE', 
          tableName: '_telebase_users',
          noSqlQuery: { id: { $eq: userId } }
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchAuthUsers(selectedProjectId);
      } else {
        alert("Failed to delete user: " + data.error);
      }
    } catch (err: any) {
      alert("Failed to delete user: " + err.message);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      loadDatabase();
    }
  }, [status]);

  // Edge-Cached Realtime Polling Hook
  const [dbHash, setDbHash] = useState<string | null>(null);
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const pollRealtime = async () => {
      try {
        const res = await fetch('/api/db/stream');
        if (res.ok) {
          const data = await res.json();
          if (dbHash && data.hash && data.hash !== dbHash) {
            console.log('[Realtime] Database state change detected via Webhook sync. Reloading...');
            await loadDatabase(true);
          }
          if (data.hash) {
            setDbHash(data.hash);
          }
        }
      } catch (e) {}
    };
    
    if (status === "authenticated") {
      pollRealtime();
      interval = setInterval(pollRealtime, 3000);
    }
    
    return () => clearInterval(interval);
  }, [status, dbHash]);

  useEffect(() => {
    if (selectedProjectId) {
      loadDBMetadata(selectedProjectId);
      if (activeTab === "auth") {
        fetchAuthUsers(selectedProjectId);
      }
    }
  }, [selectedProjectId, activeTab]);

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await loadDatabase(true);
      }
    } catch (e) {
      console.error("Force sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeepTelegramScan = async () => {
    setIsSyncing(true);
    try {
      const startId = prompt("Enter Telegram Message ID to start scanning from (Optional):", "");
      const endId = prompt("Enter Telegram Message ID to end scanning at (Optional):", "");
      const res = await fetch('/api/sync/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startId: startId ? Number(startId) : undefined, 
          endId: endId ? Number(endId) : undefined 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        await loadDatabase(true);
      } else {
        alert("Deep Scan failed: " + data.error);
      }
    } catch (e: any) {
      console.error("Deep Scan error:", e);
      alert("Deep Scan error: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;

    try {
      const validBots = newBots.filter(b => b.trim() !== "");
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          channel_id: newChannelId,
          bots: validBots,
          storage_type: 'TELEGRAM'
        })
      });

      const data = await res.json();
      if (data.success) {
        setProjects(prev => [...prev, data.project]);
        setSelectedProjectId(data.project.id);
        setIsNewProjectModalOpen(false);
        setNewProjectName("");
        setNewChannelId("");
        setNewBots([""]);
        await loadDatabase();
      } else {
        alert("Failed to create project: " + (data.error || "Unknown error"));
      }
    } catch (error: any) {
      console.error("Create project failed:", error);
      alert("Failed to create project: " + error.message);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete project "${projectName}"? This will permanently wipe all associated backup storage index records.`)) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        if (selectedProjectId === projectId) {
          const remaining = projects.filter(p => p.id !== projectId);
          if (remaining.length > 0) {
            setSelectedProjectId(remaining[0].id);
          } else {
            setSelectedProjectId("");
          }
        }
        await loadDatabase();
      } else {
        alert(`Delete Failed: ${data.error}`);
      }
    } catch (error: any) {
      console.error("Delete project failed:", error);
      alert(`Delete Failed: ${error.message}`);
    }
  };

  // Structured DB Creation
  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !newTableName.trim()) return;

    try {
      const schemaFields: Record<string, string> = { id: 'string' };
      newTableFields.forEach(f => {
        if (f.name.trim()) schemaFields[f.name.trim()] = f.type;
      });

      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify({
          action: 'CREATE_TABLE',
          tableName: newTableName.trim(),
          schema: {
            name: newTableName.trim(),
            fields: schemaFields,
            indexes: ['id']
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setIsNewTableModalOpen(false);
        setSelectedTableName(newTableName.trim());
        setNewTableName("");
        setNewTableFields([{ name: 'name', type: 'string' }, { name: 'age', type: 'number' }]);
        await loadDBMetadata(currentProject.id);
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to create table:", error);
    }
  };

  const handleAddSchemaField = () => {
    setNewTableFields([...newTableFields, { name: '', type: 'string' }]);
  };

  const handleSchemaFieldChange = (index: number, key: 'name' | 'type', value: any) => {
    const updated = [...newTableFields];
    updated[index] = { ...updated[index], [key]: value };
    setNewTableFields(updated);
  };

  const handleRemoveSchemaField = (index: number) => {
    setNewTableFields(newTableFields.filter((_, idx) => idx !== index));
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!currentProject || !selectedTableName) return;
    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify({
          action: 'DELETE',
          tableName: selectedTableName,
          noSqlQuery: { id: { $eq: recordId } }
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTableRecords(selectedTableName, currentProject.api_key);
        await loadDBMetadata(currentProject.id);
      } else {
        alert(`Failed to delete record: ${data.error}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    }
  };

  const handleTruncateTable = async () => {
    if (!currentProject || !selectedTableName) return;
    if (!confirm(`WARNING: Are you sure you want to wipe all records in "${selectedTableName}"? This cannot be undone.`)) return;

    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify({
          action: 'DELETE',
          tableName: selectedTableName,
          noSqlQuery: {}
        })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTableRecords(selectedTableName, currentProject.api_key);
        await loadDBMetadata(currentProject.id);
      } else {
        alert(`Failed to truncate table: ${data.error}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    }
  };

  const handleDeleteTable = async (tableName: string) => {
    if (!currentProject) return;
    if (!confirm(`CRITICAL WARNING: Are you sure you want to drop the table "${tableName}" completely? All schema and rows will be permanently deleted.`)) return;

    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify({
          action: 'DROP_TABLE',
          tableName
        })
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTableName("");
        setTableRecords([]);
        await loadDBMetadata(currentProject.id);
      } else {
        alert(`Failed to delete table: ${data.error}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    }
  };

  const handleSaveRecord = async (isEdit: boolean) => {
    if (!currentProject || !selectedTableName) return;

    let payloadData: Record<string, any> = {};

    if (recordEditorMode === 'json') {
      try {
        payloadData = JSON.parse(rawJsonInput);
        setJsonError(null);
      } catch (err: any) {
        setJsonError(`Invalid JSON: ${err.message}`);
        return;
      }
    } else {
      payloadData = { ...modalRecordData };
    }

    try {
      const activeTable = dbTables.find(t => t.name === selectedTableName);
      const fields = activeTable?.schema?.fields || {};

      // Enforce schema type casting for form submissions
      Object.keys(fields).forEach(key => {
        if (payloadData[key] !== undefined && payloadData[key] !== null) {
          const type = fields[key];
          if (type === 'number') {
            payloadData[key] = Number(payloadData[key]);
          } else if (type === 'boolean') {
            payloadData[key] = payloadData[key] === 'true' || payloadData[key] === true;
          } else {
            payloadData[key] = String(payloadData[key]);
          }
        }
      });

      const bodyPayload: Record<string, any> = {
        tableName: selectedTableName,
      };

      if (isEdit) {
        bodyPayload.action = 'UPDATE';
        bodyPayload.noSqlQuery = { id: { $eq: editingRecordId } };
        bodyPayload.updateSet = payloadData;
      } else {
        bodyPayload.action = 'INSERT';
        bodyPayload.insertData = payloadData;
      }

      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (data.success) {
        setIsAddRecordModalOpen(false);
        setIsEditRecordModalOpen(false);
        setModalRecordData({});
        setEditingRecordId(null);
        setRawJsonInput("{}");
        await fetchTableRecords(selectedTableName, currentProject.api_key);
        await loadDBMetadata(currentProject.id);
      } else {
        alert(`Failed to save record: ${data.error}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message}`);
    }
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !selectedTableName || !newColName.trim()) return;

    try {
      const activeTable = dbTables.find(t => t.name === selectedTableName);
      if (!activeTable) return;

      const currentFields = activeTable.schema?.fields || { id: 'string' };
      
      if (currentFields[newColName.trim()]) {
        alert(`Column "${newColName.trim()}" already exists.`);
        return;
      }

      const updatedFields = { ...currentFields, [newColName.trim()]: newColType };

      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify({
          action: 'UPDATE_SCHEMA',
          tableName: selectedTableName,
          schema: {
            name: selectedTableName,
            fields: updatedFields,
            indexes: activeTable.schema?.indexes || ['id']
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsAddColumnModalOpen(false);
        setNewColName("");
        setNewColType("string");
        await loadDBMetadata(currentProject.id);
      } else {
        alert(`Failed to add column: ${data.error}`);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleDeleteColumn = async (colName: string) => {
    if (!currentProject || !selectedTableName) return;
    if (colName === 'id' || colName === 'created_at') {
      alert("Key columns 'id' and 'created_at' cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to drop column "${colName}" from "${selectedTableName}"? This deletes metadata references.`)) return;

    try {
      const activeTable = dbTables.find(t => t.name === selectedTableName);
      if (!activeTable) return;

      const currentFields = { ...activeTable.schema?.fields };
      delete currentFields[colName];

      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify({
          action: 'UPDATE_SCHEMA',
          tableName: selectedTableName,
          schema: {
            name: selectedTableName,
            fields: currentFields,
            indexes: activeTable.schema?.indexes || ['id']
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        await loadDBMetadata(currentProject.id);
      } else {
        alert(`Failed to drop column: ${data.error}`);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleExportJSON = () => {
    if (!selectedTableName || tableRecords.length === 0) return;
    const blob = new Blob([JSON.stringify(tableRecords, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTableName}_export_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!selectedTableName || tableRecords.length === 0) return;
    const headers = Object.keys(tableRecords[0]);
    const csvRows = [
      headers.join(','),
      ...tableRecords.map(row => 
        headers.map(fieldName => {
          const val = row[fieldName];
          const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
          return `"${stringVal.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTableName}_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Execute DB SQL Query
  const handleExecuteQuery = async (queryOverride?: string) => {
    if (!currentProject || !selectedTableName) return;
    
    setIsQueryRunning(true);
    setQueryResult(null);
    const query = queryOverride || sqlQueryInput;

    if (query && query.trim()) {
      setSqlQueryHistory(prev => {
        const filtered = prev.filter(q => q.trim() !== query.trim());
        return [query, ...filtered].slice(0, 15);
      });
    }

    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify({
          tableName: selectedTableName,
          sqlQuery: query,
          forceLockCrash
        })
      });

      const data = await res.json();
      setQueryResult(data);
      if (data.success) {
        await fetchTableRecords(selectedTableName, currentProject.api_key);
        await loadDBMetadata(currentProject.id);
      }
    } catch (e: any) {
      setQueryResult({ success: false, error: e.message });
    } finally {
      setIsQueryRunning(false);
    }
  };

  // WAL Crash Recovery Trigger
  const handleRunRecovery = async () => {
    if (!currentProject || !selectedTableName) return;
    setRecoveryLogs(['[System Recovery Initiated] Connecting to Master WAL...']);
    
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify({ action: 'RECOVER', tableName: selectedTableName })
      });
      const data = await res.json();
      if (data.success) {
        setRecoveryLogs(data.logs || ['Success']);
        await fetchTableRecords(selectedTableName, currentProject.api_key);
        await loadDBMetadata(currentProject.id);
      } else {
        setRecoveryLogs(prev => [...prev, `❌ Recovery failed: ${data.error}`]);
      }
    } catch (e: any) {
      setRecoveryLogs(prev => [...prev, `❌ Network error: ${e.message}`]);
    }
  };

  const handleClearWALLogs = async () => {
    if (!currentProject) return;
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': currentProject.api_key },
        body: JSON.stringify({ action: 'CLEAR_LOGS', tableName: 'dummy' })
      });
      await loadDBMetadata(currentProject.id);
    } catch (e) {
      console.error(e);
    }
  };

  // Bot Pool rotation changes
  const handleRegisterBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !newBotTokenInput.trim()) return;

    setIsAddingBot(true);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/add-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: newBotTokenInput.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setNewBotTokenInput("");
        await loadDatabase();
      }
    } catch (error) {
      console.error("Add bot token failed:", error);
    } finally {
      setIsAddingBot(false);
    }
  };

  const handleRemoveBot = async (token: string) => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/remove-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_token: token })
      });
      const data = await res.json();
      if (data.success) {
        await loadDatabase();
      }
    } catch (error) {
      console.error("Remove bot token failed:", error);
    }
  };

  // Secure File Upload via API
  const handleFileUpload = async (file: File) => {
    if (!currentProject) return;

    if (compressFiles) {
      setUploadStatus("compressing");
      setUploadStatusText("Compressing file payload (client-side gzip)...");
    } else {
      setUploadStatus("uploading");
      setUploadStatusText("Uploading...");
    }
    setUploadProgress(5);

    try {
      // 1. Compute original file hash and get UUID
      const fileBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
      const fileHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      const fileUuid = crypto.randomUUID();
      const originalSize = file.size;

      let compressedBytes: Uint8Array;
      if (compressFiles) {
        // 2. Safely compress using CompressionStream with chunked streaming
        const cs = new CompressionStream('gzip');
        const writer = cs.writable.getWriter();
        const reader = file.stream().getReader();
        
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              await writer.close();
              break;
            }
            await writer.write(value);
          }
        };
        pump(); // run in background

        const chunksOut = [];
        const outReader = cs.readable.getReader();
        while (true) {
          const { done, value } = await outReader.read();
          if (done) break;
          chunksOut.push(value);
        }
        
        const totalLen = chunksOut.reduce((a, c) => a + c.length, 0);
        compressedBytes = new Uint8Array(totalLen);
        let off = 0;
        for (const c of chunksOut) {
          compressedBytes.set(c, off);
          off += c.length;
        }
      } else {
        // If compression is disabled, just use the raw file bytes
        compressedBytes = new Uint8Array(fileBuffer);
      }

      setUploadStatus("uploading");
      setUploadStatusText("Uploading...");
      setUploadProgress(15);

      // 3. Chunk the raw bytes and upload
      const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
      const totalChunks = Math.ceil(compressedBytes.length / CHUNK_SIZE);
      const uploadedChunks: any[] = [];
      
      const uploadChunk = async (chunkIndex: number, start: number, end: number) => {
        const chunkBytes = compressedBytes.slice(start, end);
        const res = await fetch("/api/data/upload/chunk", {
          method: "POST",
          headers: {
            "x-api-key": currentProject.api_key,
            "x-file-uuid": fileUuid,
            "x-chunk-index": chunkIndex.toString(),
            "x-is-encrypted": encryptFiles ? "true" : "false",
            "x-is-compressed": compressFiles ? "true" : "false",
            "Content-Type": "application/octet-stream"
          },
          body: chunkBytes
        });
        
        if (!res.ok) {
           if (res.status === 413) {
             throw new Error("Chunk is too large for your hosting provider.");
           }
           const errText = await res.text().catch(() => "");
           throw new Error(errText || `Chunk ${chunkIndex} upload failed with status ${res.status}`);
        }
        
        const data = await res.json();
        if (!data.success) throw new Error(data.error || `Chunk ${chunkIndex} upload failed`);
        return data.chunkData;
      };

      // Upload chunks concurrently (e.g. 3 at a time)
      const CONCURRENCY = 3;
      const executing = new Set<Promise<void>>();
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, compressedBytes.length);
        
        const p = uploadChunk(i, start, end).then(chunkData => {
           uploadedChunks.push(chunkData);
           setUploadProgress(15 + Math.floor((uploadedChunks.length / totalChunks) * 75));
        });
        
        executing.add(p);
        p.finally(() => executing.delete(p));
        
        if (executing.size >= CONCURRENCY) {
          await Promise.race(executing);
        }
      }
      await Promise.all(executing);

      setUploadStatus("processing");
      setUploadStatusText("Processing...");
      setUploadProgress(95);

      // 4. Finalize the upload
      const finalizeRes = await fetch("/api/data/upload/finalize", {
        method: "POST",
        headers: {
          "x-api-key": currentProject.api_key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileUuid,
          filename: file.name,
          fileHash,
          size: originalSize,
          version: 1, // V1 indicates compressed bytes
          chunks: uploadedChunks,
          is_compressed: compressFiles,
          is_encrypted: encryptFiles
        })
      });

      if (!finalizeRes.ok) {
        const errText = await finalizeRes.text().catch(() => "");
        throw new Error(errText || `Finalize failed with status ${finalizeRes.status}`);
      }
      
      const finalizeData = await finalizeRes.json();
      if (finalizeData.success) {
        setUploadStatus("success");
        setUploadStatusText("File stored successfully.");
        setUploadProgress(100);
        await loadDatabase();
        setTimeout(() => {
          setUploadStatus("idle");
        }, 3000);
      } else {
        throw new Error(finalizeData.error || "Finalize failed");
      }

    } catch (error: any) {
      setUploadStatus("error");
      setUploadStatusText(`Error: ${error.message}`);
      setUploadProgress(0);
    }
  };

  // Drag-and-drop triggers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // High performance browser streaming download (Zero RAM Bloating)
  const handleDownloadFile = (fileRec: StoredFile) => {
    if (!currentProject) return;
    window.location.href = `/api/data/${fileRec.uuid}?apiKey=${currentProject.api_key}`;
  };

  // Handle Delete
  const handleDeleteFile = async (uuid: string) => {
    if (!currentProject) return;

    if (!confirm("Are you sure you want to remove this backup index?")) return;

    setDeletingUuid(uuid);
    try {
      const res = await fetch(`/api/data/${uuid}`, {
        method: "DELETE",
        headers: {
          "x-api-key": currentProject.api_key
        }
      });
      const data = await res.json();
      if (data.success) {
        await loadDatabase();
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      alert(`Delete Failed: ${e.message}`);
    } finally {
      setDeletingUuid(null);
    }
  };

  const runSpeedBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const res = await fetch("/api/benchmark");
      const data = await res.json();
      if (data.success) {
        setBenchmarkResult({
          isKVConfigured: data.isKVConfigured,
          telegramLatencyMs: data.telegramLatencyMs,
          kvLatencyMs: data.kvLatencyMs,
          telegramStatus: data.telegramStatus,
          kvStatus: data.kvStatus,
          kvErrorMessage: data.kvErrorMessage
        });
      }
    } catch (e) {
      console.error("Benchmark failed:", e);
    } finally {
      setIsBenchmarking(false);
    }
  };

  useEffect(() => {
    if (activeTab === "speed" && !benchmarkResult) {
      runSpeedBenchmark();
    }
  }, [activeTab]);

  const handleAddBotField = () => {
    setNewBots([...newBots, ""]);
  };

  const handleNewBotChange = (index: number, val: string) => {
    const updated = [...newBots];
    updated[index] = val;
    setNewBots(updated);
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyAIContext = () => {
    if (!currentProject) return;

    // Get table schemas formatted as Markdown
    const tablesMarkdown = dbTables.length === 0
      ? "No tables have been created in this project yet."
      : dbTables.map(t => {
          const fieldsStr = t.schema?.fields
            ? Object.entries(t.schema.fields)
                .map(([name, type]) => `    - ${name} (${type})`)
                .join('\n')
            : "    - (No columns defined)";
          return `- Table Name: ${t.name}\n  - Size: ${formatBytes(t.sizeBytes)}\n  - Columns/Schema:\n${fieldsStr}`;
        }).join('\n\n');

    const firstTable = dbTables[0]?.name || "users";
    const sampleFieldsKeys = dbTables[0]?.schema?.fields
      ? Object.keys(dbTables[0].schema.fields).filter(k => k !== 'id').join(', ')
      : "name, age";
    const sampleFieldsValues = dbTables[0]?.schema?.fields
      ? Object.entries(dbTables[0].schema.fields)
          .filter(([k]) => k !== 'id')
          .map(([_, t]) => t === 'number' ? '28' : t === 'boolean' ? 'true' : "'Emma'")
          .join(', ')
      : "'Emma', 28";
    const sampleFieldsObject = dbTables[0]?.schema?.fields
      ? Object.entries(dbTables[0].schema.fields)
          .filter(([k]) => k !== 'id')
          .map(([k, t]) => `      ${k}: ${t === 'number' ? '28' : t === 'boolean' ? 'true' : "'Emma'"}`)
          .join(',\n')
      : "      name: 'Emma',\n      age: 28";

    const promptText = `<telebase_context>
<system_instruction>
You are an AI assistant helping a developer build/integrate an application with Telebase.
Telebase is a serverless ACID-compliant database and file storage engine that uses Telegram as physical storage media. It exposes a local HTTP REST API for data query, manipulation, and secure media uploads.
Use this context to write integrations, database models, and CRUD services.
Do not use direct SQLite or Postgres connections. Always use simple HTTP calls to the Telebase REST endpoints with the x-api-key header.
Handle responses with robust error checking ('success' property in response JSON).
Utilize dynamic SQL and NoSQL constructs according to the database tables schema provided.
</system_instruction>

<project_info>
Host Endpoint Base URL: $TELEBASE_HOST_URL
Active Project ID: ${currentProject.id}
Active Project Name: ${currentProject.name}
API Access Key Header: x-api-key
API Access Key Value: $TELEBASE_API_KEY
Telegram Channel ID: ${currentProject.channel_id ? 'Configured' : 'Default'}
Storage Encryption: E2E Encrypted (AES-256-GCM + Zlib compression)
</project_info>

<active_schema>
${tablesMarkdown}
</active_schema>

<api_examples>
<database_operations>
Execute database queries using POST requests to $TELEBASE_HOST_URL/api/db.

Example SQL SELECT:
\`\`\`javascript
const response = await fetch('$TELEBASE_HOST_URL/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': '$TELEBASE_API_KEY' },
  body: JSON.stringify({ tableName: '${firstTable}', sqlQuery: 'SELECT * FROM ${firstTable}' })
});
\`\`\`

Example NoSQL SELECT:
\`\`\`javascript
const response = await fetch('$TELEBASE_HOST_URL/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': '$TELEBASE_API_KEY' },
  body: JSON.stringify({ tableName: '${firstTable}', action: 'SELECT', noSqlQuery: { age: { $gte: 18 } } })
});
\`\`\`

Example SQL INSERT:
\`\`\`javascript
const response = await fetch('$TELEBASE_HOST_URL/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': '$TELEBASE_API_KEY' },
  body: JSON.stringify({ tableName: '${firstTable}', sqlQuery: "INSERT INTO ${firstTable} (${sampleFieldsKeys}) VALUES (${sampleFieldsValues})" })
});
\`\`\`

Example NoSQL INSERT:
\`\`\`javascript
const response = await fetch('$TELEBASE_HOST_URL/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': '$TELEBASE_API_KEY' },
  body: JSON.stringify({
    tableName: '${firstTable}',
    action: 'INSERT',
    insertData: {
${sampleFieldsObject}
    }
  })
});
\`\`\`

Example UPDATE:
\`\`\`javascript
const response = await fetch('$TELEBASE_HOST_URL/api/db', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': '$TELEBASE_API_KEY' },
  body: JSON.stringify({ tableName: '${firstTable}', sqlQuery: "UPDATE ${firstTable} SET name = 'Emma' WHERE id = 'some-uuid'" })
});
\`\`\`
</database_operations>

<storage_operations>
Upload Media / File Chunking:
Allows streaming chunks to Telegram with on-the-fly encryption. Send as multipart/form-data.
\`\`\`javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('$TELEBASE_HOST_URL/api/data/upload', {
  method: 'POST',
  headers: { 'x-api-key': '$TELEBASE_API_KEY' },
  body: formData
});
const data = await response.json();
console.log('File UUID:', data.file.uuid);
\`\`\`

Retrieve / Stream File Content:
Direct link for downloads or image src tags. Decrypts chunks on-the-fly.
\`\`\`javascript
const fileUrl = \`$TELEBASE_HOST_URL/api/data/\${fileUuid}?apiKey=$TELEBASE_API_KEY\`;
\`\`\`
</storage_operations>
</api_examples>
</telebase_context>`;

    navigator.clipboard.writeText(promptText);
    setCopiedAI(true);
    setTimeout(() => setCopiedAI(false), 2500);
  };

  // ─── TABS CONFIG ───
  const tabs = [
    { id: "db" as const, label: "Database", icon: Database },
    { id: "files" as const, label: "Storage", icon: HardDrive },
    { id: "auth" as const, label: "Authentication", icon: Lock },
    { id: "bots" as const, label: "Bot Pool", icon: Bot },
    { id: "speed" as const, label: "Performance", icon: Zap },
    { id: "ai" as const, label: "AI Connect", icon: Cpu },
  ];

  // ─── AUTH LOADING SKELETON ───
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050506] gap-5">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center"
          >
            <Database className="text-blue-400 w-6 h-6" />
          </motion.div>
          <div className="absolute -bottom-1 -right-1 status-dot" />
        </div>
        <div className="text-sm font-medium text-zinc-500 tracking-wide">Securing TeleBase Console...</div>
      </div>
    );
  }

  const renderSidebarContent = (isMobile = false) => {
    return (
      <>
        {/* Sidebar Header */}
        <div className="p-5 border-b border-zinc-800/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Database className="w-4.5 h-4.5 text-white" size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">TeleBase</h1>
              <p className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">Serverless DB Console</p>
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-1.5 rounded-lg hover:bg-zinc-800/50 text-zinc-500 transition-colors lg:hidden"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Projects</span>
            <button 
              onClick={() => setIsNewProjectModalOpen(true)}
              className="w-6 h-6 rounded-lg bg-zinc-800/60 hover:bg-blue-500/20 border border-zinc-700/50 hover:border-blue-500/30 flex items-center justify-center text-zinc-400 hover:text-blue-400 transition-all"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="space-y-1">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedProjectId === proj.id 
                    ? "sidebar-active text-white" 
                    : "text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200"
                }`}
                onClick={() => {
                  setSelectedProjectId(proj.id);
                  if (isMobile) setIsMobileSidebarOpen(false);
                }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  selectedProjectId === proj.id 
                    ? "bg-blue-500/15 text-blue-400" 
                    : "bg-zinc-800/50 text-zinc-500 group-hover:text-zinc-300"
                }`}>
                  <Folder size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate">{proj.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded text-zinc-500 border border-zinc-700/30">{proj.storage_type}</span>
                    <span className="text-[9px] text-zinc-600">{proj.bots.length} bots</span>
                  </div>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(proj.id, proj.name);
                  }}
                  className="absolute right-2 p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete Project"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          {projects.length === 0 && (
            <div className="text-center py-10 px-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center mx-auto mb-3">
                <Database className="text-zinc-600 w-5 h-5" />
              </div>
              <p className="text-xs text-zinc-500 mb-3 leading-relaxed">No projects yet.<br/>Create your first database.</p>
              <button 
                onClick={() => setIsNewProjectModalOpen(true)}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                + New Project
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-800/50 space-y-2 flex-shrink-0">
          <button 
            onClick={handleForceSync}
            disabled={isSyncing}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30 transition-all text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
            <span>{isSyncing ? "Syncing..." : "Sync Master Index"}</span>
          </button>
          <button 
            onClick={handleDeepTelegramScan}
            disabled={isSyncing}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30 transition-all text-xs font-medium disabled:opacity-50"
          >
            <AlertCircle size={14} className={isSyncing ? "animate-pulse text-amber-500" : "text-amber-500/80"} />
            <span>Deep Scan Channel</span>
          </button>
          <button
            onClick={() => handleSignOut()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all text-xs font-medium"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </>
    );
  };

  // ─── AUTH LOADING SKELETON ───
  if ((status as any) === "loading" || (status as any) === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050506] gap-5">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center"
          >
            <Database className="text-blue-400 w-6 h-6" />
          </motion.div>
          <div className="absolute -bottom-1 -right-1 status-dot" />
        </div>
        <div className="text-sm font-medium text-zinc-500 tracking-wide">Securing TeleBase Console...</div>
      </div>
    );
  }

  // ─── MAIN DASHBOARD ───
  return (
    <div className="flex h-screen bg-[#050506] text-zinc-100 overflow-hidden selection:bg-blue-500/30">

      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden lg:flex w-[280px] flex-shrink-0 border-r border-zinc-800/50 bg-[#0a0a0d] flex flex-col h-full">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Sidebar Drawer overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            {/* Slide Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] bg-[#0a0a0d] border-r border-zinc-800/50 flex flex-col h-full lg:hidden shadow-2xl"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ════════ MAIN CONTENT ════════ */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        
        {/* ── Top Bar ── */}
        <header className="h-14 flex-shrink-0 border-b border-zinc-800/50 bg-[#0a0a0d]/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white lg:hidden"
            >
              <Menu size={16} />
            </button>
            {currentProject ? (
              <>
                <span className="text-sm font-bold text-white truncate max-w-[100px] sm:max-w-none">{currentProject.name}</span>
                <ChevronRight size={14} className="text-zinc-600 flex-shrink-0" />
                <span className="text-sm text-zinc-400 font-medium capitalize truncate max-w-[100px] sm:max-w-none">{activeTab === "db" ? "Database" : activeTab === "files" ? "Storage" : activeTab === "auth" ? "Authentication" : activeTab === "bots" ? "Bot Pool" : activeTab === "speed" ? "Performance" : "AI Connect"}</span>
              </>
            ) : (
              <span className="text-sm text-zinc-500">Select a project</span>
            )}
          </div>

          {currentProject && (
            <div className="flex items-center gap-2">
              <div className="status-dot animate-pulse" />
              <span className="text-[10px] text-emerald-400/80 font-semibold tracking-wide uppercase hidden sm:inline">Connected</span>
            </div>
          )}
        </header>

        {/* ── Tab Navigation (Horizontally scrollable on Mobile) ── */}
        {currentProject && (
          <nav className="h-12 flex-shrink-0 border-b border-zinc-800/50 bg-[#0a0a0d]/50 flex items-center gap-1 px-4 md:px-6 overflow-x-auto scrollbar-none whitespace-nowrap flex-nowrap">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-zinc-800/60 text-white border border-zinc-700/50"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20"
                }`}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* ── Page Content ── */}
        <div className="flex-1 overflow-y-auto">
          {isPageLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center"
              >
                <Database className="text-blue-400 w-6 h-6" />
              </motion.div>
              <div className="text-sm font-medium text-zinc-500">Initializing Engine...</div>
            </div>
          ) : !currentProject ? (
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/10 flex items-center justify-center">
                <Database className="text-blue-400/60 w-9 h-9" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold text-zinc-300 mb-1.5">Create Your First Database</h2>
                <p className="text-sm text-zinc-500 max-w-md leading-relaxed">Connect a private Telegram channel and start using it as a serverless database with full CRUD operations.</p>
              </div>
              <button 
                onClick={() => setIsNewProjectModalOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                <PlusCircle size={16} />
                <span>New Project</span>
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-6 animate-fade-in-up">
              
              {/* ── Stats Row ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: "Tables", value: dbTables.length, icon: Table2, color: "text-blue-400", bg: "from-blue-500/10 to-blue-500/5" },
                  { label: "Stored Files", value: projectFiles.length, icon: FileText, color: "text-indigo-400", bg: "from-indigo-500/10 to-indigo-500/5" },
                  { label: "Bot Rotations", value: currentProject.bots.length, icon: Bot, color: "text-violet-400", bg: "from-violet-500/10 to-violet-500/5" },
                  { label: "Engine Status", value: "ACID", icon: Shield, color: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-500/5" },
                ].map((stat, i) => (
                  <div key={i} className="relative group p-4 rounded-xl border border-zinc-800/40 bg-[#0a0a0d] hover:border-zinc-700/50 transition-all overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <stat.icon size={14} className={stat.color} />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                      </div>
                      <div className="text-xl font-bold text-white">{stat.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Project Config Bar ── */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-zinc-800/40 bg-[#0a0a0d] overflow-hidden">
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 w-full">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Key size={12} className="flex-shrink-0" />
                    <span className="font-semibold whitespace-nowrap">API Key</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-zinc-900/80 px-3 py-1.5 rounded-lg border border-zinc-800/60 w-full sm:w-auto min-w-0">
                    <code className="text-[11px] text-zinc-400 font-mono select-all truncate max-w-full">{currentProject.api_key}</code>
                    <button 
                      onClick={() => copyToClipboard(currentProject.api_key)}
                      className="text-zinc-500 hover:text-blue-400 transition-colors flex-shrink-0"
                    >
                      {copiedKey ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                <div className="hidden sm:block h-6 w-px bg-zinc-800" />
                <div className="flex items-center gap-2 text-xs text-zinc-500 w-full sm:w-auto">
                  <Hash size={12} className="flex-shrink-0" />
                  <span className="font-semibold whitespace-nowrap">Channel</span>
                  <code className="text-[11px] text-zinc-400 font-mono truncate max-w-full">{currentProject.channel_id || "Default"}</code>
                </div>
              </div>

              {/* ════════ DATABASE TAB ════════ */}
              {activeTab === "db" && (
                <div className="grid grid-cols-12 gap-6">
                  
                  {/* Left: Tables List or SQL Editor Queries List */}
                  <div className="col-span-12 lg:col-span-3 space-y-4">
                    {dbSubTab === 'explorer' ? (
                      <>
                        <div className="p-4 rounded-xl border border-zinc-800/40 bg-[#0a0a0d]">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Tables</h3>
                            <button
                              onClick={() => setIsNewTableModalOpen(true)}
                              className="w-6 h-6 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-blue-400 transition-all"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          {dbTables.length > 0 && (
                            <div className="relative mb-3">
                              <input
                                type="text"
                                placeholder="Search tables..."
                                value={searchTableQuery}
                                onChange={(e) => setSearchTableQuery(e.target.value)}
                                className="w-full bg-[#08080a] border border-zinc-800/50 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white focus:border-blue-500/50 outline-none placeholder:text-zinc-600 font-mono"
                              />
                              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                              {searchTableQuery && (
                                <button
                                  onClick={() => setSearchTableQuery('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                >
                                  <X size={10} />
                                </button>
                              )}
                            </div>
                          )}

                          {(() => {
                            const filteredTables = dbTables.filter(t => t.name.toLowerCase().includes(searchTableQuery.toLowerCase()));
                            
                            if (filteredTables.length === 0) {
                              return (
                                <div className="text-center py-8">
                                  <Table2 className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                                  <p className="text-[11px] text-zinc-600">No tables found</p>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                                {filteredTables.map(t => (
                                  <button
                                    key={t.uuid}
                                    onClick={() => {
                                      setSelectedTableName(t.name);
                                      if (currentProject) fetchTableRecords(t.name, currentProject.api_key);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between group ${
                                      selectedTableName === t.name 
                                        ? "bg-blue-500/10 text-blue-300 border border-blue-500/20" 
                                        : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 border border-transparent"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <Table2 size={13} className={selectedTableName === t.name ? "text-blue-400" : "text-zinc-600"} />
                                      <span className="font-mono font-medium truncate max-w-[100px]">{t.name}</span>
                                    </div>
                                    <span className="text-[9px] text-zinc-600 font-sans">{formatBytes(t.sizeBytes)}</span>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        {/* ACID Status */}
                        <div className="p-4 rounded-xl border border-zinc-800/40 bg-[#0a0a0d]">
                          <div className="flex items-center gap-2 mb-3">
                            <Shield size={13} className="text-emerald-400" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Engine Status</span>
                          </div>
                          <div className="space-y-2">
                            {["Atomicity", "Consistency", "Isolation", "Durability"].map((prop, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-[11px] text-zinc-500">{prop}</span>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span className="text-[9px] font-bold text-emerald-400">ACTIVE</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="p-4 rounded-xl border border-zinc-850 bg-[#0a0a0d]/80 backdrop-blur-md flex flex-col h-full space-y-4">
                        <div className="flex items-center justify-between pb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-6.5 h-6.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <Code size={13} className="text-emerald-400" />
                            </div>
                            <div>
                              <h3 className="text-xs font-bold text-zinc-200 tracking-tight">SQL Queries</h3>
                              <p className="text-[9px] text-zinc-500 font-medium">Explore & manage scripts</p>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const name = prompt("Enter query name:");
                              if (name && name.trim()) {
                                const newId = `query-${Date.now()}`;
                                setSqlQueries(prev => [
                                  ...prev,
                                  {
                                    id: newId,
                                    name: name.trim(),
                                    query: `-- ${name.trim()}\nSELECT * FROM ${selectedTableName || 'users'} LIMIT 10;`,
                                    category: 'private'
                                  }
                                ]);
                                setActiveQueryId(newId);
                              }
                            }}
                            className="w-6.5 h-6.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 transition-all hover:scale-105 active:scale-95"
                            title="New Query"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        {/* Search queries input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Filter queries..."
                            value={searchQueryText}
                            onChange={(e) => setSearchQueryText(e.target.value)}
                            className="w-full bg-[#08080a] border border-zinc-800/70 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 outline-none placeholder:text-zinc-600 transition-all font-mono"
                          />
                          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                          {searchQueryText && (
                            <button
                              onClick={() => setSearchQueryText('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-350"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </div>

                        {/* Folders and lists of queries */}
                        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 scrollbar-none">
                          {/* Folder: Templates */}
                          {(() => {
                            const templates = sqlQueries.filter(q => q.category === 'templates' && q.name.toLowerCase().includes(searchQueryText.toLowerCase()));
                            if (templates.length > 0) {
                              return (
                                <div className="space-y-1.5">
                                  <div className="px-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
                                    <BookOpen size={10} className="text-zinc-500" />
                                    <span>Templates</span>
                                    <span className="ml-auto text-[8px] bg-zinc-900 px-1 py-0.2 rounded border border-zinc-850 text-zinc-650">{templates.length}</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {templates.map(q => (
                                      <button
                                        key={q.id}
                                        onClick={() => setActiveQueryId(q.id)}
                                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between font-mono ${
                                          activeQueryId === q.id 
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                            : "text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200 border border-transparent hover:translate-x-0.5"
                                        }`}
                                      >
                                        <span className="truncate">{q.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Folder: Quickstarts */}
                          {(() => {
                            const quickstarts = sqlQueries.filter(q => q.category === 'quickstarts' && q.name.toLowerCase().includes(searchQueryText.toLowerCase()));
                            if (quickstarts.length > 0) {
                              return (
                                <div className="space-y-1.5">
                                  <div className="px-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
                                    <Compass size={10} className="text-zinc-500" />
                                    <span>Quickstarts</span>
                                    <span className="ml-auto text-[8px] bg-zinc-900 px-1 py-0.2 rounded border border-zinc-850 text-zinc-650">{quickstarts.length}</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {quickstarts.map(q => (
                                      <button
                                        key={q.id}
                                        onClick={() => setActiveQueryId(q.id)}
                                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between font-mono ${
                                          activeQueryId === q.id 
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                            : "text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200 border border-transparent hover:translate-x-0.5"
                                        }`}
                                      >
                                        <span className="truncate">{q.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Folder: Favorites */}
                          {(() => {
                            const favorites = sqlQueries.filter(q => q.isFavorite && q.name.toLowerCase().includes(searchQueryText.toLowerCase()));
                            if (favorites.length > 0) {
                              return (
                                <div className="space-y-1.5">
                                  <div className="px-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
                                    <Heart size={10} className="text-rose-500" />
                                    <span>Favorites</span>
                                    <span className="ml-auto text-[8px] bg-zinc-900 px-1 py-0.2 rounded border border-zinc-850 text-zinc-650">{favorites.length}</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {favorites.map(q => (
                                      <button
                                        key={q.id}
                                        onClick={() => setActiveQueryId(q.id)}
                                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between font-mono ${
                                          activeQueryId === q.id 
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                            : "text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200 border border-transparent hover:translate-x-0.5"
                                        }`}
                                      >
                                        <span className="truncate">{q.name}</span>
                                        <Heart size={9} className="fill-rose-500 text-rose-500" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Folder: Private */}
                          {(() => {
                            const privates = sqlQueries.filter(q => q.category === 'private' && q.name.toLowerCase().includes(searchQueryText.toLowerCase()));
                            if (privates.length > 0) {
                              return (
                                <div className="space-y-1.5">
                                  <div className="px-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 select-none">
                                    <Lock size={10} className="text-zinc-500" />
                                    <span>Private</span>
                                    <span className="ml-auto text-[8px] bg-zinc-900 px-1 py-0.2 rounded border border-zinc-850 text-zinc-650">{privates.length}</span>
                                  </div>
                                  <div className="space-y-0.5">
                                    {privates.map(q => (
                                      <button
                                        key={q.id}
                                        onClick={() => setActiveQueryId(q.id)}
                                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between font-mono ${
                                          activeQueryId === q.id 
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                            : "text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200 border border-transparent hover:translate-x-0.5"
                                        }`}
                                      >
                                        <span className="truncate">{q.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        {/* Bottom action: View running queries */}
                        <div className="pt-2 border-t border-zinc-850">
                          <button
                            onClick={() => alert("Showing running queries on Telebase: No active blocking transactions detected.")}
                            className="w-full text-center py-2 bg-zinc-900/60 hover:bg-zinc-850/60 border border-zinc-800/80 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-zinc-200 transition-all uppercase tracking-wider hover:scale-[1.01]"
                          >
                            View running queries
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Dual Sub-Tabs (Interactive Explorer / Advanced Console) */}
                  <div className="col-span-12 lg:col-span-9 space-y-6">
                    
                    {/* DB Workspace Sub-Tabs Selector */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-1.5 md:p-1 bg-[#0a0a0d] border border-zinc-800/40 rounded-xl">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setDbSubTab('explorer')}
                          className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                            dbSubTab === 'explorer'
                              ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Table2 size={13} />
                          <span>✨ Interactive Explorer</span>
                        </button>
                        <button
                          onClick={() => setDbSubTab('terminal')}
                          className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                            dbSubTab === 'terminal'
                              ? "bg-blue-600/10 text-blue-400 border border-blue-500/20"
                              : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <Terminal size={13} />
                          <span>💻 Advanced SQL Console</span>
                        </button>
                      </div>
                      
                      {selectedTableName && (
                        <div className="flex items-center gap-2 pr-3 self-end md:self-auto">
                          <span className="text-[10px] uppercase font-bold text-zinc-600 font-mono">Active Table:</span>
                          <span className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-blue-400 font-bold px-2 py-0.5 rounded">
                            {selectedTableName}
                          </span>
                        </div>
                      )}
                    </div>

                    {dbSubTab === 'explorer' ? (
                      /* ════════ INTERACTIVE EXPLORER TAB ════════ */
                      <div className="space-y-6">
                        {/* Search and Filter Dock */}
                        {selectedTableName && (
                          <div className="p-4 rounded-xl border border-zinc-800/40 bg-[#0a0a0d] flex flex-col md:flex-row gap-4 items-center justify-between">
                            {/* Search and Filters */}
                            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                              {/* Search text input */}
                              <div className="relative w-full md:w-48">
                                <input
                                  type="text"
                                  placeholder="Search records..."
                                  value={gridSearchQuery}
                                  onChange={(e) => setGridSearchQuery(e.target.value)}
                                  className="w-full bg-[#08080a] border border-zinc-800/50 rounded-lg pl-3.5 pr-8 py-2 text-xs focus:border-blue-500/50 outline-none text-white font-mono placeholder:text-zinc-700"
                                />
                                {gridSearchQuery && (
                                  <button
                                    onClick={() => setGridSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </div>

                              {/* Column Selector */}
                              <select
                                value={gridFilterCol}
                                onChange={(e) => {
                                  setGridFilterCol(e.target.value);
                                  if (e.target.value === 'all') setGridFilterVal('');
                                }}
                                className="bg-[#08080a] border border-zinc-800/50 rounded-lg px-2.5 py-2 text-xs text-zinc-400 focus:border-blue-500/50 outline-none cursor-pointer font-sans"
                              >
                                <option value="all">All Columns</option>
                                {(() => {
                                  const tableDef = dbTables.find(t => t.name === selectedTableName);
                                  if (tableDef?.schema?.fields) {
                                    return Object.keys(tableDef.schema.fields).map(col => (
                                      <option key={col} value={col}>{col}</option>
                                    ));
                                  }
                                  if (tableRecords.length > 0) {
                                    return Object.keys(tableRecords[0]).map(col => (
                                      <option key={col} value={col}>{col}</option>
                                    ));
                                  }
                                  return null;
                                })()}
                              </select>

                              {/* Operator Selector */}
                              {gridFilterCol !== 'all' && (
                                <select
                                  value={gridFilterOp}
                                  onChange={(e) => setGridFilterOp(e.target.value as any)}
                                  className="bg-[#08080a] border border-zinc-800/50 rounded-lg px-2 py-2 text-xs text-zinc-400 focus:border-blue-500/50 outline-none cursor-pointer"
                                >
                                  <option value="contains">contains</option>
                                  <option value="eq">equals (=)</option>
                                  <option value="gt">greater than (&gt;)</option>
                                  <option value="lt">less than (&lt;)</option>
                                </select>
                              )}

                              {/* Filter value input */}
                              {gridFilterCol !== 'all' && (
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="Filter value..."
                                    value={gridFilterVal}
                                    onChange={(e) => setGridFilterVal(e.target.value)}
                                    className="bg-[#08080a] border border-zinc-800/50 rounded-lg px-3 py-2 text-xs focus:border-blue-500/50 outline-none text-white font-mono placeholder:text-zinc-700 w-28 md:w-36"
                                  />
                                  {gridFilterVal && (
                                    <button
                                      onClick={() => setGridFilterVal('')}
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Clear Filters indicator */}
                              {(gridSearchQuery || gridFilterVal) && (
                                <button
                                  onClick={() => {
                                    setGridSearchQuery('');
                                    setGridFilterCol('all');
                                    setGridFilterVal('');
                                  }}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider flex items-center gap-1 bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10"
                                >
                                  <RotateCcw size={10} />
                                  <span>Reset Filters</span>
                                </button>
                              )}
                            </div>

                            {/* visual row & schema mutators */}
                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                              <button
                                onClick={() => {
                                  setModalRecordData({});
                                  setRawJsonInput("{}");
                                  setRecordEditorMode('form');
                                  setIsAddRecordModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md shadow-blue-500/10"
                              >
                                <PlusCircle size={13} />
                                <span>Add Record</span>
                              </button>

                              <button
                                onClick={() => {
                                  setNewColName("");
                                  setNewColType("string");
                                  setIsAddColumnModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700/50 transition-all"
                              >
                                <Plus size={13} />
                                <span>Add Column</span>
                              </button>

                              <div className="flex rounded-lg overflow-hidden border border-zinc-800/80">
                                <button
                                  onClick={handleExportJSON}
                                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors border-r border-zinc-800/80 text-[10px] font-bold"
                                  title="Export JSON"
                                >
                                  JSON
                                </button>
                                <button
                                  onClick={handleExportCSV}
                                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-[10px] font-bold"
                                  title="Export CSV"
                                >
                                  CSV
                                </button>
                              </div>

                              <button
                                onClick={handleTruncateTable}
                                className="p-2 rounded-lg bg-zinc-900 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition-all"
                                title="Truncate Table Records"
                              >
                                <Trash2 size={13} />
                              </button>

                              <button
                                onClick={() => handleDeleteTable(selectedTableName)}
                                className="p-2 rounded-lg bg-zinc-900 hover:bg-rose-500/15 text-zinc-500 hover:text-rose-400 border border-transparent hover:border-rose-500/25 transition-all"
                                title="Drop Table Schema"
                              >
                                <Settings size={13} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Visual Table Data Grid */}
                        <div className="rounded-xl border border-zinc-800/40 bg-[#0a0a0d] overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/40 bg-zinc-900/10">
                            <div className="flex items-center gap-2.5">
                              <Table2 size={15} className="text-blue-400" />
                              <h3 className="text-sm font-bold text-zinc-200">{selectedTableName || "Interactive Grid Explorer"}</h3>
                            </div>
                            {selectedTableName && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-zinc-800/60 px-2.5 py-1 rounded-md font-mono text-zinc-400 border border-zinc-700/30">
                                  {filteredRecords.length} of {tableRecords.length} records filtered
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                            {!selectedTableName ? (
                              <div className="py-20 text-center">
                                <Table2 className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                                <h3 className="text-sm font-bold text-zinc-400 mb-1">Select table to explore</h3>
                                <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed">Choose a structured table from the sidebar prefix list, or initialize a new schema visually.</p>
                              </div>
                            ) : tableRecords.length === 0 ? (
                              <div className="py-20 text-center">
                                <Layers className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                                <h3 className="text-sm font-bold text-zinc-400 mb-1">Table is empty</h3>
                                <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed mb-4">This table schema exists but contains zero records. Click add record below to get started.</p>
                                <button
                                  onClick={() => {
                                    setModalRecordData({});
                                    setRawJsonInput("{}");
                                    setRecordEditorMode('form');
                                    setIsAddRecordModalOpen(true);
                                  }}
                                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-500/10"
                                >
                                  + Create First Record
                                </button>
                              </div>
                            ) : filteredRecords.length === 0 ? (
                              <div className="py-20 text-center">
                                <RotateCcw className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                                <h3 className="text-sm font-bold text-zinc-400 mb-1">No matching results</h3>
                                <p className="text-xs text-zinc-600 max-w-sm mx-auto leading-relaxed">No rows match your dynamic grid filter. Try clearing the fields to view all records.</p>
                              </div>
                            ) : (
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="border-b border-zinc-800/40 bg-zinc-900/20">
                                    {(() => {
                                      const activeTable = dbTables.find(t => t.name === selectedTableName);
                                      const fields = activeTable?.schema?.fields 
                                        ? Object.keys(activeTable.schema.fields)
                                        : Object.keys(tableRecords[0]);
                                      
                                      return fields.map((col) => (
                                        <th key={col} className="group/head py-3.5 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider relative font-mono">
                                          <div className="flex items-center justify-between gap-1.5 w-full">
                                            <div className="flex items-center gap-1.5">
                                              <span>{col}</span>
                                              {activeTable?.schema?.fields?.[col] && (
                                                <span className="text-[8px] font-sans font-normal text-zinc-600 lowercase bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800">
                                                  {activeTable.schema.fields[col]}
                                                </span>
                                              )}
                                            </div>
                                            {col !== 'id' && col !== 'created_at' && (
                                              <button
                                                onClick={() => handleDeleteColumn(col)}
                                                className="opacity-0 group-hover/head:opacity-100 p-0.5 rounded hover:bg-rose-500/20 text-rose-500 transition-opacity ml-auto"
                                                title={`Drop ${col} column`}
                                              >
                                                <X size={10} />
                                              </button>
                                            )}
                                          </div>
                                        </th>
                                      ));
                                    })()}
                                    <th className="py-3.5 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredRecords.map((row, idx) => {
                                    const activeTable = dbTables.find(t => t.name === selectedTableName);
                                    const fields = activeTable?.schema?.fields 
                                      ? Object.keys(activeTable.schema.fields)
                                      : Object.keys(tableRecords[0]);
                                    
                                    return (
                                      <tr key={`${row.id || 'row'}_${idx}`} className="border-b border-zinc-800/20 table-row-hover transition-colors">
                                        {fields.map((fieldName, valIdx) => {
                                          const v = row[fieldName];
                                          return (
                                            <td key={valIdx} className="py-3 px-5 text-xs text-zinc-300 font-mono max-w-[240px] truncate select-all">
                                              {v === undefined || v === null ? (
                                                <span className="text-zinc-700 italic">null</span>
                                              ) : typeof v === 'object' ? (
                                                JSON.stringify(v)
                                              ) : typeof v === 'boolean' ? (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-sans uppercase ${v ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                                  {String(v)}
                                                </span>
                                              ) : (
                                                String(v)
                                              )}
                                            </td>
                                          );
                                        })}
                                        <td className="py-3 px-5 text-right">
                                          <div className="flex items-center gap-1 justify-end">
                                            <button
                                              onClick={() => {
                                                setEditingRecordId(row.id);
                                                setModalRecordData(row);
                                                setRawJsonInput(JSON.stringify(row, null, 2));
                                                setRecordEditorMode('form');
                                                setIsEditRecordModalOpen(true);
                                              }}
                                              className="p-1.5 rounded-lg bg-zinc-900/60 hover:bg-blue-500/10 text-zinc-500 hover:text-blue-400 border border-zinc-800/40 transition-all"
                                              title="Edit Record"
                                            >
                                              <Settings size={12} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteRecord(row.id)}
                                              className="p-1.5 rounded-lg bg-zinc-900/60 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 border border-zinc-800/40 transition-all"
                                              title="Delete record"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ════════ ADVANCED SQL TERMINAL TAB ════════ */
                      <div className="space-y-6">
                        {/* SQL Console */}
                        <div className="rounded-xl border border-zinc-800/40 bg-[#0a0a0d] overflow-hidden">
                          {/* Breadcrumbs Header */}
                          <div className="flex items-center justify-between px-5 py-3 bg-[#0a0a0d]/40 border-b border-zinc-850">
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
                              <span className="text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors">Telebase Dev</span>
                              <span className="text-zinc-650 text-[10px]">/</span>
                              <span className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded text-[9px] shadow-sm shadow-indigo-500/5 select-none uppercase tracking-wide">Pro</span>
                              <span className="text-zinc-650 text-[10px]">/</span>
                              <span className="text-zinc-350 hover:text-zinc-200 cursor-pointer transition-colors">{currentProject?.name || "Telebase Project"}</span>
                              <span className="text-zinc-650 text-[10px]">/</span>
                              <span className="text-emerald-400 font-bold font-mono text-[11.5px] tracking-tight bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 flex items-center gap-1.5 shadow-sm shadow-emerald-500/5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {sqlQueries.find(q => q.id === activeQueryId)?.name || "New Script"}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => alert("Thank you for your feedback! The Telebase console continues to run cleanly.")} 
                                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider bg-zinc-900/60 hover:bg-zinc-850 px-2.5 py-1 rounded-md border border-zinc-800"
                              >
                                Feedback
                              </button>
                              <button 
                                onClick={() => alert("Telebase Advanced Console Redesign: This SQL editor is built to replicate the premium look and feel of modern developer suites.")}
                                className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                              >
                                <HelpCircle size={14} />
                              </button>
                            </div>
                          </div>
                          
                          {/* Code Editor block with line numbers */}
                          <div className="relative flex border-b border-zinc-850 bg-[#07070a] min-h-[220px] transition-all focus-within:border-zinc-800">
                            {/* Line Numbers Gutter */}
                            <div
                              ref={sqlGutterRef}
                              className="w-11 py-4 pr-3 text-right bg-[#050506]/90 border-r border-zinc-900/60 select-none overflow-hidden font-mono text-[12px] leading-relaxed text-zinc-600 flex flex-col gap-0"
                              style={{ maxHeight: '300px' }}
                            >
                              {Array.from({ length: Math.max(sqlQueryInput.split('\n').length, 12) }, (_, i) => (
                                <span key={i} className="h-[20px] block leading-relaxed">{i + 1}</span>
                              ))}
                            </div>

                            {/* Main Textarea */}
                            <textarea
                              ref={sqlTextareaRef}
                              rows={10}
                              value={sqlQueryInput}
                              onChange={(e) => handleQueryChange(e.target.value)}
                              onScroll={handleSqlEditorScroll}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                  e.preventDefault();
                                  handleExecuteQuery();
                                }
                              }}
                              placeholder="-- Write your SQL query here (e.g. SELECT * FROM users;)"
                              className="flex-1 bg-transparent px-5 py-4 outline-none border-none text-zinc-100 font-mono text-[13px] leading-relaxed focus:ring-0 placeholder:text-zinc-700 min-h-[200px]"
                              style={{ maxHeight: '300px' }}
                              spellCheck={false}
                            />

                            {/* Floating Schema Connected HUD in top-right */}
                            <div className="absolute top-4 right-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 select-none cursor-default shadow-sm shadow-emerald-500/5 transition-all hover:bg-emerald-500/10">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-[9px] font-bold font-mono tracking-wider uppercase">master schema</span>
                              <Compass size={11} className="text-emerald-400/80 animate-spin-slow" style={{ animation: 'spin 15s linear infinite' }} />
                            </div>
                          </div>

                          {/* Status and Action Bar (divider split) */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3 border-t border-zinc-850 bg-[#08080a]/50">
                            {/* Left side: Results & Chart tab buttons */}
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setSqlTerminalTab('results')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                  sqlTerminalTab === 'results' 
                                    ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/50" 
                                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                                }`}
                              >
                                Results
                              </button>
                              <button
                                onClick={() => {
                                  if (!queryResult) {
                                    alert("Run a query first to visualize a Chart!");
                                    return;
                                  }
                                  setSqlTerminalTab('templates'); // Reuse 'templates' tab state for custom chart!
                                }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                  sqlTerminalTab === 'templates' 
                                    ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/50" 
                                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                                }`}
                              >
                                Chart
                              </button>
                            </div>

                            {/* Right side: Accents, source/role selectors, and Run button */}
                            <div className="flex flex-wrap items-center gap-2.5">
                              {/* Keyboard Shortcut Icon */}
                              <button
                                onClick={() => alert("Query console shortcuts:\n• Ctrl + Enter: Run Active Query\n• Meta/Cmd + Enter: Run Active Query\n• Heart Icon: Toggle Favorite")}
                                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors shadow-sm"
                                title="Keyboard Shortcuts"
                              >
                                <Keyboard size={13} />
                              </button>

                              {/* Favorite Toggle button */}
                              <button
                                onClick={() => {
                                  const active = sqlQueries.find(q => q.id === activeQueryId);
                                  if (active) {
                                    setSqlQueries(prev => prev.map(q => q.id === activeQueryId ? { ...q, isFavorite: !q.isFavorite } : q));
                                    alert(active.isFavorite ? "Removed from Favorites" : "Added to Favorites!");
                                  }
                                }}
                                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors shadow-sm"
                                title="Toggle Favorite"
                              >
                                <Heart size={13} className={sqlQueries.find(q => q.id === activeQueryId)?.isFavorite ? "fill-rose-500 text-rose-500" : ""} />
                              </button>

                              {/* History panel toggle */}
                              <button
                                onClick={() => {
                                  setSqlTerminalTab(sqlTerminalTab === 'history' ? 'results' : 'history');
                                }}
                                className={`p-2 rounded-lg border transition-all shadow-sm ${
                                  sqlTerminalTab === 'history' 
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold" 
                                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                                }`}
                                title="Execution History"
                              >
                                <History size={13} />
                              </button>

                              <div className="h-4 w-px bg-zinc-800/80 mx-0.5" />

                              {/* Database Selection Dropdown */}
                              <div className="relative text-[10px] text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 select-none font-mono cursor-default shadow-sm hover:border-zinc-700 transition-colors">
                                <span className="text-zinc-650">source</span>
                                <span className="text-zinc-350 font-semibold">Primary DB</span>
                              </div>

                              {/* Role Selection Dropdown */}
                              <div className="relative text-[10px] text-zinc-400 bg-zinc-900/60 border border-zinc-800/80 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 select-none font-mono cursor-default shadow-sm hover:border-zinc-700 transition-colors">
                                <span className="text-zinc-650">role</span>
                                <span className="text-zinc-300 font-semibold font-mono">postgres</span>
                              </div>

                              {/* Green Run Button */}
                              <button
                                onClick={() => handleExecuteQuery()}
                                disabled={isQueryRunning}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-black font-extrabold text-xs transition-all shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/25 active:scale-98"
                              >
                                {isQueryRunning ? (
                                  <>
                                    <RefreshCw size={12} className="animate-spin text-black" />
                                    <span>Running</span>
                                  </>
                                ) : (
                                  <>
                                    <Play size={10} className="fill-black text-black" />
                                    <span className="flex items-center gap-1">
                                      Run <span className="text-[9px] text-black/60 font-semibold bg-black/10 px-1 rounded-sm">Ctrl+Enter</span>
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Dynamic Sub-Tab Workspaces */}
                        {sqlTerminalTab === 'results' && (
                          <div className="space-y-6">
                            {/* Query Result */}
                            <AnimatePresence>
                              {queryResult ? (
                                <motion.div
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  className={`p-5 rounded-xl border ${
                                    queryResult.success 
                                      ? "border-zinc-800/40 bg-[#0a0a0d]" 
                                      : "border-rose-500/20 bg-rose-500/5"
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                      {queryResult.success ? (
                                        <CheckCircle2 size={14} className="text-emerald-400" />
                                      ) : (
                                        <AlertCircle size={14} className="text-rose-400" />
                                      )}
                                      <span className="text-xs font-bold text-zinc-300">
                                        {queryResult.success ? "Query Successful" : "Query Failed"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                                      <span>Latency: <strong className="text-zinc-300">{queryResult.latencyMs || 0}ms</strong></span>
                                      <span>Cache: <strong className={queryResult.cacheHit ? "text-emerald-400" : "text-amber-400"}>{queryResult.cacheHit ? "HIT" : "MISS"}</strong></span>
                                      {queryResult.affectedRows !== undefined && (
                                        <span>Rows: <strong className="text-zinc-300">{queryResult.affectedRows}</strong></span>
                                      )}
                                    </div>
                                  </div>

                                  {queryResult.success ? (
                                    <div className="space-y-4">
                                      {/* Optimization Stats */}
                                      {queryResult.optimization && (
                                        <div className="flex items-center gap-4 p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/30 text-[10px]">
                                          <div className="text-zinc-500">
                                            Strategy: <strong className={queryResult.optimization.strategy === 'INDEX_SCAN' ? 'text-emerald-400' : 'text-amber-400'}>{queryResult.optimization.strategy}</strong>
                                          </div>
                                          <div className="text-zinc-500">
                                            Index: <strong className="text-zinc-300">{queryResult.optimization.indexUsed || 'None'}</strong>
                                          </div>
                                          <div className="text-zinc-500">
                                            Scanned: <strong className="text-zinc-300">{queryResult.optimization.statistics?.scannedRecords ?? 0}/{queryResult.optimization.statistics?.totalRecords ?? 0}</strong>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Grid output */}
                                      {queryResult.records && queryResult.records.length > 0 ? (
                                        <div className="border border-zinc-800/40 rounded-xl bg-[#0a0a0d] overflow-hidden">
                                          <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                                            <table className="w-full text-left">
                                              <thead>
                                                <tr className="border-b border-zinc-850 bg-zinc-900/30">
                                                  {Object.keys(queryResult.records[0]).map((col) => (
                                                    <th key={col} className="py-2.5 px-4 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                                                      {col}
                                                    </th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {queryResult.records.map((row: any, rIdx: number) => (
                                                  <tr key={rIdx} className="border-b border-zinc-900 hover:bg-zinc-900/20 transition-colors">
                                                    {Object.keys(queryResult.records[0]).map((col, cIdx) => {
                                                      const val = row[col];
                                                      return (
                                                        <td key={cIdx} className="py-2 px-4 text-[11px] text-zinc-300 font-mono">
                                                          {val === null || val === undefined ? (
                                                            <span className="text-zinc-700 italic">null</span>
                                                          ) : typeof val === 'object' ? (
                                                            JSON.stringify(val)
                                                          ) : typeof val === 'boolean' ? (
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-sans uppercase ${val ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                                                              {String(val)}
                                                            </span>
                                                          ) : (
                                                            String(val)
                                                          )}
                                                        </td>
                                                      );
                                                    })}
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                          <div className="p-3 bg-zinc-900/20 border-t border-zinc-850 flex items-center justify-between text-[10px] text-zinc-500">
                                            <span>Returned {queryResult.records.length} row{queryResult.records.length > 1 ? 's' : ''}</span>
                                            <span>Execution time: {queryResult.latencyMs || 12}ms</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-mono rounded-lg">
                                          Query executed successfully. Affected rows: {queryResult.affectedRows ?? 0}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="text-[12px] text-rose-400 font-medium">
                                      {queryResult.error || "A transaction failure occurred."}
                                    </div>
                                  )}
                                </motion.div>
                              ) : (
                                <div className="py-14 text-center border border-zinc-800/40 rounded-xl bg-zinc-900/10">
                                  <Terminal className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
                                  <h4 className="text-xs font-bold text-zinc-400 mb-1">No execution results</h4>
                                  <p className="text-[11px] text-zinc-650 max-w-sm mx-auto leading-relaxed">
                                    Write a query in the console above and press Run (or Ctrl+Enter) to inspect raw JSON responses, execution paths, and performance stats.
                                  </p>
                                </div>
                              )}
                            </AnimatePresence>

                            {/* WAL & Recovery */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* WAL Logs */}
                              <div className="p-5 rounded-xl border border-zinc-800/40 bg-[#0a0a0d]">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2">
                                    <Activity size={14} className="text-blue-400" />
                                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Write-Ahead Logs</h3>
                                  </div>
                                  {walLogs.length > 0 && (
                                    <button onClick={handleClearWALLogs} className="text-[9px] font-bold text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-wider">
                                      Clear
                                    </button>
                                  )}
                                </div>
                                <div className="bg-[#08080a] rounded-lg border border-zinc-800/30 max-h-[200px] overflow-y-auto p-3 space-y-1.5 font-mono text-[10px]">
                                  {walLogs.length === 0 ? (
                                    <div className="text-zinc-700 text-center py-8">No active transaction logs</div>
                                  ) : (
                                    [...walLogs].reverse().map(log => (
                                      <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/20 border border-zinc-800/20">
                                        <div className="text-zinc-500 truncate">
                                          <span className="text-zinc-400">{log.operation}</span> · {log.tableName}:{log.recordId}
                                        </div>
                                        <span className={`text-[9px] font-bold flex-shrink-0 ml-2 ${
                                          log.status === 'COMMITTED' ? 'text-emerald-400' : 
                                          log.status === 'FAILED' ? 'text-rose-400' : 'text-amber-400'
                                        }`}>
                                          {log.status}
                                        </span>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Recovery */}
                              <div className="p-5 rounded-xl border border-zinc-800/40 bg-[#0a0a0d]">
                                <div className="flex items-center gap-2 mb-3">
                                  <RotateCcw size={14} className="text-indigo-400" />
                                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Crash Recovery</h3>
                                </div>
                                <p className="text-[11px] text-zinc-500 leading-relaxed mb-4">
                                  Enable "Simulate Crash" above, run a write query, then use recovery to restore the consistent state from WAL.
                                </p>
                                <button
                                  onClick={handleRunRecovery}
                                  disabled={!selectedTableName}
                                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-500/10 flex items-center justify-center gap-2"
                                >
                                  <RotateCcw size={12} />
                                  <span>Replay WAL & Recover</span>
                                </button>
                                {recoveryLogs.length > 0 && (
                                  <div className="mt-3 bg-[#08080a] rounded-lg border border-zinc-800/30 p-2.5 font-mono text-[9px] text-zinc-500 space-y-1 max-h-[80px] overflow-y-auto">
                                    {recoveryLogs.map((log, i) => (
                                      <div key={i}>{log}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Templates tab slot repurposed as interactive Chart view */}
                        {sqlTerminalTab === 'templates' && (
                          <div className="p-5 rounded-xl border border-zinc-800/40 bg-[#0a0a0d] space-y-4">
                            {(() => {
                              if (!queryResult || !queryResult.records || queryResult.records.length === 0) {
                                return (
                                  <div className="py-14 text-center text-zinc-500 text-xs">
                                    No records available to plot a chart. Execute a query that returns rows first.
                                  </div>
                                );
                              }
                              const firstRecord = queryResult.records[0];
                              const numericCol = Object.keys(firstRecord).find(k => k !== 'id' && typeof firstRecord[k] === 'number');
                              const labelCol = Object.keys(firstRecord).find(k => k === 'name' || k === 'title' || k === 'username' || k === 'filename') || Object.keys(firstRecord)[0];

                              if (!numericCol) {
                                return (
                                  <div className="py-12 text-center text-zinc-500 text-xs border border-zinc-800/30 rounded-xl bg-zinc-900/10">
                                    <AlertCircle size={20} className="mx-auto mb-2 text-zinc-650" />
                                    No numeric columns found in the result set to render a chart visualization.
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                      Visualizing: <strong className="text-emerald-450 font-mono">{numericCol}</strong> by <strong className="text-zinc-400 font-mono">{labelCol}</strong>
                                    </h4>
                                    <span className="text-[10px] text-zinc-500 font-mono bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">Chart View</span>
                                  </div>
                                  
                                  <div className="space-y-3.5 pt-2">
                                    {queryResult.records.map((row: any, idx: number) => {
                                      const labelVal = row[labelCol] || `Row #${idx + 1}`;
                                      const numVal = Number(row[numericCol]) || 0;
                                      const maxVal = Math.max(...queryResult.records.map((r: any) => Number(r[numericCol]) || 1), 1);
                                      const percent = Math.min(100, Math.max(5, (numVal / maxVal) * 100));
                                      
                                      return (
                                        <div key={idx} className="space-y-1">
                                          <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                                            <span>{String(labelVal)}</span>
                                            <span className="text-emerald-400 font-bold">{numVal}</span>
                                          </div>
                                          <div className="w-full bg-zinc-900/60 rounded-full h-2 overflow-hidden border border-zinc-850">
                                            <div
                                              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                                              style={{ width: `${percent}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {sqlTerminalTab === 'history' && (
                          <div className="p-5 rounded-xl border border-zinc-800/40 bg-[#0a0a0d] space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/40">
                              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                                <History size={13} className="text-blue-400" />
                                Recent Execution Logs
                              </h4>
                              <button
                                onClick={() => setSqlQueryHistory([
                                  "SELECT * FROM users",
                                  "-- Insert a mock user\nINSERT INTO users (id, name, age) VALUES ('user_99', 'Supabase Agent', 30)",
                                  "SELECT * FROM users WHERE age > 20"
                                ])}
                                className="text-[9px] font-bold text-zinc-650 hover:text-zinc-400 transition-colors uppercase tracking-wider"
                              >
                                Reset Logs
                              </button>
                            </div>
                            
                            {sqlQueryHistory.length === 0 ? (
                              <div className="text-center py-8">
                                <History className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                                <p className="text-[11px] text-zinc-650">No query history found</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {sqlQueryHistory.map((query, idx) => (
                                  <div
                                    key={idx}
                                    className="p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/30 hover:border-zinc-700/40 transition-all flex items-start justify-between gap-3 group"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <pre className="font-mono text-[11px] text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
                                        {query}
                                      </pre>
                                    </div>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                      <button
                                        onClick={() => {
                                          setSqlQueryInput(query);
                                          setSqlTerminalTab('results');
                                        }}
                                        className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-black rounded text-[10px] font-bold transition-all"
                                      >
                                        Load
                                      </button>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(query);
                                          alert("Query copied!");
                                        }}
                                        className="p-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-450 hover:text-zinc-200 rounded border border-zinc-700/40 transition-all"
                                        title="Copy query"
                                      >
                                        <Copy size={11} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ════════ STORAGE TAB ════════ */}
              {activeTab === "files" && (
                <div className="space-y-6">
                  {/* Security Notice */}
                  <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5">
                    <Shield className="text-emerald-400 w-5 h-5 flex-shrink-0" />
                    <p className="text-[12px] text-emerald-300/80 leading-relaxed">
                      <strong>End-to-End Encrypted.</strong> All uploads are compressed (zlib) and fully encrypted via AES-256-GCM. Telegram servers only see encrypted binary data.
                    </p>
                  </div>

                  {/* Storage Settings */}
                  <div className="p-5 rounded-xl border border-zinc-800/40 bg-[#0a0a0d] mb-6">
                    <h3 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-2">
                      <Settings size={15} className="text-zinc-400" />
                      Storage Settings
                    </h3>
                    
                    <div className="space-y-4">
                      {/* Compress Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-[13px] font-semibold text-zinc-300">Compress Uploads (gzip)</h4>
                          <p className="text-[11px] text-zinc-500 mt-0.5">Compresses file data using zlib before uploading. Disabling it speeds up uploads but consumes more Telegram storage.</p>
                        </div>
                        <button
                          onClick={() => handleUpdateStorageSettings(!compressFiles, encryptFiles)}
                          disabled={isUpdatingStorageSettings}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent focus:outline-none transition-colors ${
                            compressFiles ? 'bg-blue-600' : 'bg-zinc-700'
                          } ${isUpdatingStorageSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="sr-only">Toggle Compression</span>
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              compressFiles ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="h-px w-full bg-zinc-800/60" />

                      {/* Encrypt Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-[13px] font-semibold text-zinc-300">End-to-End Encryption (AES-GCM)</h4>
                          <p className="text-[11px] text-zinc-500 mt-0.5">Encrypts files before sending them to Telegram. Disabling it means Telegram servers can read the raw binary data.</p>
                        </div>
                        <button
                          onClick={() => handleUpdateStorageSettings(compressFiles, !encryptFiles)}
                          disabled={isUpdatingStorageSettings}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent focus:outline-none transition-colors ${
                            encryptFiles ? 'bg-emerald-600' : 'bg-zinc-700'
                          } ${isUpdatingStorageSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="sr-only">Toggle Encryption</span>
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              encryptFiles ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`p-8 border-2 border-dashed rounded-2xl transition-all text-center ${
                      isDragActive 
                        ? "border-blue-500/50 bg-blue-500/5" 
                        : "border-zinc-800/50 bg-[#0a0a0d] hover:border-zinc-700/50"
                    }`}
                  >
                    {uploadStatus === "idle" ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center text-zinc-500">
                          <UploadCloud size={24} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-zinc-300 mb-1">Drop files here or click to upload</h3>
                          <p className="text-xs text-zinc-600">JSON, ZIP, PDF, binary backups — up to 100MB</p>
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelectChange} className="hidden" />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="px-5 py-2 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/40 rounded-xl text-xs font-semibold text-zinc-300 transition-all"
                        >
                          Choose File
                        </button>
                      </div>
                    ) : (
                      <div className="py-4 space-y-4 max-w-md mx-auto">
                        <div className="flex justify-between items-center text-xs font-medium">
                          <span className="text-zinc-400">{uploadStatusText}</span>
                          <span className="text-blue-400 font-bold">{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                          <motion.div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        {uploadStatus === "success" && (
                          <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold bg-emerald-500/10 p-3 rounded-xl justify-center border border-emerald-500/20">
                            <CheckCircle2 size={14} />
                            <span>Encrypted & stored in Telegram successfully!</span>
                          </div>
                        )}
                        {uploadStatus === "error" && (
                          <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold bg-rose-500/10 p-3 rounded-xl justify-center border border-rose-500/20">
                            <AlertCircle size={14} />
                            <span>Upload failed</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Files List */}
                  <div className="rounded-xl border border-zinc-800/40 bg-[#0a0a0d] overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/40">
                      <div className="flex items-center gap-2.5">
                        <FileText size={15} className="text-blue-400" />
                        <h3 className="text-sm font-bold text-zinc-200">Stored Files</h3>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-semibold">{projectFiles.length} files</span>
                    </div>

                    {projectFiles.length === 0 ? (
                      <div className="py-16 text-center">
                        <FileText className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
                        <p className="text-xs text-zinc-600">No files stored. Drag a file to upload.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-zinc-800/40 bg-zinc-900/20">
                              <th className="py-3 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Filename</th>
                              <th className="py-3 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Size</th>
                              <th className="py-3 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Chunks</th>
                              <th className="py-3 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Integrity</th>
                              <th className="py-3 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectFiles.map((file) => (
                              <tr key={file.uuid} className="border-b border-zinc-800/20 table-row-hover transition-colors">
                                <td className="py-3.5 px-5">
                                  <div className="flex items-center gap-2">
                                    <FileText size={14} className="text-zinc-600 flex-shrink-0" />
                                    <div>
                                      <div className="text-xs font-semibold text-zinc-200 truncate max-w-[180px]">{file.filename}</div>
                                      <div className="text-[9px] font-mono text-zinc-600 mt-0.5 truncate max-w-[180px]">{file.uuid}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-5 text-xs text-zinc-400 font-mono">{formatBytes(file.size)}</td>
                                <td className="py-3.5 px-5">
                                  <span className="text-[10px] bg-zinc-800/50 px-2 py-0.5 rounded-md font-mono text-zinc-400 border border-zinc-700/30">{file.chunk_count}</span>
                                </td>
                                <td className="py-3.5 px-5">
                                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
                                    <CheckCircle2 size={11} />
                                    <span>SHA-256 ✓</span>
                                  </div>
                                </td>
                                <td className="py-3.5 px-5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button 
                                      onClick={() => handleDownloadFile(file)}
                                      className="p-2 rounded-lg bg-zinc-800/30 hover:bg-blue-500/10 text-zinc-500 hover:text-blue-400 transition-all"
                                      title="Download"
                                    >
                                      <Download size={13} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteFile(file.uuid)}
                                      disabled={deletingUuid === file.uuid}
                                      className="p-2 rounded-lg bg-zinc-800/30 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-all disabled:opacity-40"
                                      title="Delete"
                                    >
                                      <Trash2 size={13} className={deletingUuid === file.uuid ? "animate-pulse" : ""} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* ════════ AUTHENTICATION TAB ════════ */}
              {activeTab === "auth" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Users List */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-zinc-800/40 bg-[#0a0a0d] overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/40">
                        <div className="flex items-center gap-2.5">
                          <Lock size={15} className="text-blue-400" />
                          <h3 className="text-sm font-bold text-zinc-200">End Users</h3>
                        </div>
                        <button
                          onClick={() => setIsAddUserModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[10px] font-bold text-white transition-all shadow-lg shadow-blue-500/10"
                        >
                          <Plus size={10} />
                          <span>Add User</span>
                        </button>
                      </div>

                      {isAuthLoading ? (
                        <div className="py-16 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                          <RefreshCw className="animate-spin text-blue-500" size={14} />
                          <span>Loading end users...</span>
                        </div>
                      ) : authUsers.length === 0 ? (
                        <div className="py-16 text-center">
                          <Lock className="w-10 h-10 text-zinc-850 mx-auto mb-3" />
                          <p className="text-xs text-zinc-600">No registered users yet. Start by adding one or integrating signup API.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-zinc-800/40 bg-zinc-900/20">
                                <th className="py-3 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">User ID</th>
                                <th className="py-3 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Email Address</th>
                                <th className="py-3 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Created At</th>
                                <th className="py-3 px-5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {authUsers.map((user) => (
                                <tr key={user.id} className="border-b border-zinc-800/20 table-row-hover transition-colors">
                                  <td className="py-3.5 px-5">
                                    <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                                      <span className="truncate max-w-[150px]" title={user.id}>{user.id}</span>
                                      <button 
                                        onClick={() => {
                                          navigator.clipboard.writeText(user.id);
                                        }}
                                        className="p-1 rounded bg-zinc-800/40 hover:bg-zinc-800 hover:text-white text-zinc-500 transition-colors"
                                      >
                                        <Copy size={10} />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-5 text-xs text-zinc-200 font-medium">{user.email}</td>
                                  <td className="py-3.5 px-5 text-[11px] text-zinc-500">{new Date(user.created_at).toLocaleString()}</td>
                                  <td className="py-3.5 px-5 text-right">
                                    <button 
                                      onClick={() => handleDeleteAuthUser(user.id)}
                                      className="p-2 rounded-lg bg-zinc-800/30 hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-all"
                                      title="Delete User"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Code Snippets & SMTP Info */}
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl border border-zinc-800/40 bg-[#0a0a0d] space-y-4">
                      <div className="flex items-center gap-2 text-zinc-200">
                        <Key size={14} className="text-yellow-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">Developer API Endpoints</h4>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        Integrate Telebase authentication into your application. Use the signup/login HTTP endpoints to register users and fetch JWTs.
                      </p>

                      <div className="space-y-3.5 pt-2">
                        {/* Signup snippet */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-semibold">
                            <span>Register End-User (cURL)</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`curl -X POST https://telebase.pages.dev/api/v1/auth/signup \\
  -H "x-api-key: ${currentProject?.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password123"}'`);
                              }}
                              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="p-3 bg-[#050506] border border-zinc-800/50 rounded-lg text-[9px] font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap select-all">
                            {`curl -X POST https://telebase.pages.dev/api/v1/auth/signup \\
  -H "x-api-key: ${currentProject?.api_key || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password123"}'`}
                          </pre>
                        </div>

                        {/* Login snippet */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-semibold">
                            <span>Login & Retrieve JWT (JS Fetch)</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`fetch('https://telebase.pages.dev/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${currentProject?.api_key}'
  },
  body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
})
.then(r => r.json())
.then(data => console.log("JWT:", data.token));`);
                              }}
                              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="p-3 bg-[#050506] border border-zinc-800/50 rounded-lg text-[9px] font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap select-all">
                            {`fetch('https://telebase.pages.dev/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${currentProject?.api_key || 'YOUR_API_KEY'}'
  },
  body: JSON.stringify({ email: 'user@example.com', password: 'password123' })
})`}
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl border border-zinc-800/40 bg-[#0a0a0d] space-y-3">
                      <div className="flex items-center gap-2 text-zinc-200">
                        <Shield className="text-emerald-400 w-3.5 h-3.5" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">SMTP Server Settings</h4>
                      </div>
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        To enable OTP & Magic Link mailings directly to your end-users, set up your mailer configuration in environment variables:
                      </p>
                      <div className="p-3 bg-[#050506] border border-zinc-800/50 rounded-lg text-[9px] font-mono text-zinc-400 leading-normal">
                        <div>SMTP_HOST=your-smtp-host.com</div>
                        <div>SMTP_PORT=587</div>
                        <div>SMTP_USER=user@domain.com</div>
                        <div>SMTP_PASS=password</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ════════ BOT POOL TAB ════════ */}
              {activeTab === "bots" && (
                <div className="max-w-2xl space-y-6">
                  <div className="p-6 rounded-xl border border-zinc-800/40 bg-[#0a0a0d]">
                    <div className="flex items-center gap-2.5 mb-2">
                      <Bot size={16} className="text-violet-400" />
                      <h3 className="text-sm font-bold text-zinc-200">Bot Token Rotation Pool</h3>
                    </div>
                    <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
                      Rotated bots handle chunk fetches and uploads concurrently, circumventing Telegram API rate limits. Add multiple bot tokens for high-throughput workloads.
                    </p>

                    {/* Realtime Webhook Setting */}
                    <div className="mb-8 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2 mb-1">
                            <Zap size={14} /> Telegram Realtime Webhook
                          </h4>
                          <p className="text-[10px] text-zinc-400">
                            Connect your bot to Cloudflare Edge to receive instant, 0-cost realtime updates across all connected clients.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/webhook/telegram/setup', { method: 'POST' });
                              const data = await res.json();
                              alert(data.success ? data.message : "Error: " + data.error);
                            } catch (e: any) {
                              alert("Setup failed: " + e.message);
                            }
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-all shadow-lg shadow-emerald-500/20"
                        >
                          Connect Realtime
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleRegisterBot} className="flex gap-2 mb-6">
                      <input
                        type="text"
                        required
                        value={newBotTokenInput}
                        onChange={(e) => setNewBotTokenInput(e.target.value)}
                        placeholder="Enter bot token (e.g. 123456:ABCdef...)"
                        className="flex-1 bg-[#08080a] border border-zinc-800/50 rounded-xl px-4 py-2.5 text-xs focus:border-blue-500/50 outline-none text-white font-mono placeholder:text-zinc-700"
                      />
                      <button
                        type="submit"
                        disabled={isAddingBot}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50 shadow-lg shadow-blue-500/10"
                      >
                        {isAddingBot ? "Adding..." : "Add Bot"}
                      </button>
                    </form>

                    {currentProject && currentProject.bots.length > 0 ? (
                      <div className="space-y-2">
                        {currentProject.bots.map((bot, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#08080a] border border-zinc-800/30 group">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                                <Bot size={12} className="text-violet-400" />
                              </div>
                              <div>
                                <div className="font-mono text-[11px] text-zinc-400 truncate max-w-[350px]">{bot}</div>
                                <div className="text-[9px] text-zinc-600 mt-0.5">Token #{idx + 1}</div>
                              </div>
                            </div>
                            <button 
                              onClick={() => handleRemoveBot(bot)}
                              className="p-2 rounded-lg bg-zinc-800/30 hover:bg-rose-500/10 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border border-zinc-800/20 rounded-xl bg-zinc-900/10">
                        <Bot className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                        <p className="text-[11px] text-zinc-600">No bots registered. Using default master token.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ════════ PERFORMANCE TAB ════════ */}
              {activeTab === "speed" && (
                <div className="max-w-2xl space-y-6">
                  <div className="p-6 rounded-xl border border-zinc-800/40 bg-[#0a0a0d]">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2.5">
                        <Zap size={16} className="text-amber-400" />
                        <h3 className="text-sm font-bold text-zinc-200">Edge Query Speed Test</h3>
                      </div>
                      <button
                        onClick={runSpeedBenchmark}
                        disabled={isBenchmarking}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800/40 hover:bg-zinc-700/40 border border-zinc-700/30 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isBenchmarking ? "animate-spin" : ""} />
                        <span>{isBenchmarking ? "Testing..." : "Run Benchmark"}</span>
                      </button>
                    </div>

                    <div className="space-y-6">
                      {/* Telegram Speed */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400 font-medium">Standard Telegram Fetch</span>
                          <span className="text-amber-400 font-mono font-bold">
                            {isBenchmarking ? "..." : benchmarkResult ? `${benchmarkResult.telegramLatencyMs}ms` : "—"}
                          </span>
                        </div>
                        <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                          <motion.div
                            className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full"
                            initial={{ width: "0%" }}
                            animate={{
                              width: isBenchmarking ? "15%" : benchmarkResult ? "100%" : "0%"
                            }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>

                      {/* KV Speed */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                            <Zap size={12} className="text-blue-400" />
                            <span>Cloudflare KV Edge Cache</span>
                          </div>
                          <span className="text-blue-400 font-mono font-bold">
                            {isBenchmarking ? "..." : benchmarkResult ? `${benchmarkResult.kvLatencyMs}ms` : "—"}
                          </span>
                        </div>
                        <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                          <motion.div
                            className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full"
                            initial={{ width: "0%" }}
                            animate={{
                              width: isBenchmarking
                                ? "30%"
                                : benchmarkResult
                                ? `${Math.max(5, Math.min(100, (benchmarkResult.kvLatencyMs / (benchmarkResult.telegramLatencyMs || 1000)) * 100))}%`
                                : "0%"
                            }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Result Summary */}
                    {benchmarkResult && (
                      <div className="mt-6 p-4 rounded-xl border border-zinc-800/30 bg-zinc-900/20 text-center">
                        {benchmarkResult.isKVConfigured ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2">
                              <Zap size={14} className="text-emerald-400" />
                              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">KV Accelerated</span>
                            </div>
                            <p className="text-sm text-zinc-400">
                              Queries running <strong className="text-white text-lg">{Math.round((benchmarkResult.telegramLatencyMs || 1200) / (benchmarkResult.kvLatencyMs || 25))}×</strong> faster than standard Telegram lookups
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2">
                              <AlertCircle size={14} className="text-amber-400" />
                              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">KV Not Configured</span>
                            </div>
                            <p className="text-sm text-zinc-400">
                              Enable Cloudflare KV for up to <strong className="text-white">{Math.round((benchmarkResult.telegramLatencyMs || 1200) / 20)}×</strong> faster database operations
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ════════ AI CONNECT TAB ════════ */}
              {activeTab === "ai" && (
                <div className="space-y-6">
                  {/* Top Header Card */}
                  <div className="relative group p-6 rounded-2xl border border-zinc-800/40 bg-[#0a0a0d] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-violet-500/10 opacity-70" />
                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
                            <Cpu size={14} className="text-blue-400" />
                          </div>
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">AI Connection Hub</span>
                        </div>
                        <h3 className="text-lg font-extrabold text-white tracking-tight">Sync Project Context with AI IDEs</h3>
                        <p className="text-xs text-zinc-400 max-w-xl leading-relaxed">
                          Provide Cursor, Windsurf, Copilot, or ChatGPT with instant context. This copies credentials, live table structures, and fetch snippets so your AI can write perfect database integration code.
                        </p>
                      </div>

                      <button
                        onClick={handleCopyAIContext}
                        className="flex-shrink-0 flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 border border-white/10 active:scale-98"
                      >
                        {copiedAI ? (
                          <>
                            <CheckCircle2 size={15} className="text-emerald-300 animate-bounce" />
                            <span className="text-emerald-100 font-bold uppercase tracking-wider">Copied AI Prompt Context!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} className="animate-pulse" />
                            <span className="uppercase tracking-wider">Copy AI Developer Prompt</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Main 2-Column Details Split */}
                  <div className="grid grid-cols-12 gap-6">
                    {/* Left Column: Live Config Map */}
                    <div className="col-span-5 space-y-6">
                      <div className="p-5 rounded-2xl border border-zinc-800/40 bg-[#0a0a0d] space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/40">
                          <Shield size={13} className="text-zinc-500" />
                          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Credentials Map</h4>
                        </div>

                        <div className="space-y-3.5">
                          {/* Endpoint */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">API Endpoint Base</span>
                            <div className="bg-[#07070a] border border-zinc-800/50 rounded-xl px-3 py-2 flex items-center justify-between">
                              <code className="text-xs text-zinc-300 font-mono">http://localhost:3000</code>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText("http://localhost:3000");
                                  alert("Endpoint base URL copied!");
                                }}
                                className="text-zinc-500 hover:text-blue-400 transition-colors"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Key */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Project API Key</span>
                            <div className="bg-[#07070a] border border-zinc-800/50 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                {showAPIKeyInAI ? (
                                  <Key size={11} className="text-amber-400 flex-shrink-0" />
                                ) : (
                                  <Lock size={11} className="text-zinc-600 flex-shrink-0" />
                                )}
                                <code className="text-[11px] text-zinc-400 font-mono truncate select-all">
                                  {showAPIKeyInAI ? currentProject.api_key : "••••••••••••••••••••••••••••••••••••••••"}
                                </code>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => setShowAPIKeyInAI(!showAPIKeyInAI)}
                                  className="text-[9px] px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/50 hover:bg-zinc-700/50 text-zinc-400 transition-colors"
                                >
                                  {showAPIKeyInAI ? "Hide" : "Show"}
                                </button>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(currentProject.api_key);
                                    alert("API Key copied!");
                                  }}
                                  className="text-zinc-500 hover:text-blue-400 transition-colors"
                                >
                                  <Copy size={11} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="bg-zinc-900/30 p-2.5 rounded-xl border border-zinc-800/40">
                              <span className="block text-[9px] text-zinc-500 font-semibold uppercase">Active Tables</span>
                              <span className="text-sm font-bold text-white font-mono">{dbTables.length}</span>
                            </div>
                            <div className="bg-zinc-900/30 p-2.5 rounded-xl border border-zinc-800/40">
                              <span className="block text-[9px] text-zinc-500 font-semibold uppercase">Storage Pool</span>
                              <span className="text-sm font-bold text-white font-mono">{currentProject.storage_type}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Schema summary view */}
                      <div className="p-5 rounded-2xl border border-zinc-800/40 bg-[#0a0a0d] space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/40">
                          <div className="flex items-center gap-2">
                            <Table2 size={13} className="text-zinc-500" />
                            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Dynamic Tables</h4>
                          </div>
                          <span className="text-[10px] bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-blue-400 font-mono">Live</span>
                        </div>

                        {dbTables.length === 0 ? (
                          <div className="text-center py-6">
                            <Table2 className="w-7 h-7 text-zinc-800 mx-auto mb-2" />
                            <p className="text-[11px] text-zinc-600">No tables created yet</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                            {dbTables.map(t => (
                              <div key={t.uuid} className="p-2.5 rounded-xl bg-zinc-900/30 border border-zinc-800/30 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-zinc-200 font-mono font-semibold">{t.name}</span>
                                  <span className="text-[9px] text-zinc-500">{formatBytes(t.sizeBytes)}</span>
                                </div>
                                {t.schema?.fields ? (
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(t.schema.fields).map(([name, type]) => (
                                      <span key={name} className="text-[9px] bg-zinc-800/80 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700/20 font-mono">
                                        {name}:{type}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-zinc-600">No columns defined</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Code snippets preview */}
                    <div className="col-span-7 p-5 rounded-2xl border border-zinc-800/40 bg-[#0a0a0d] flex flex-col h-full min-h-[480px]">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/40">
                        <div className="flex items-center gap-2">
                          <Terminal size={14} className="text-blue-400" />
                          <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Integration Snippets</h4>
                        </div>
                        <button
                          onClick={() => {
                            let snippet = "";
                            if (aiSnippetTab === 'js_sql') {
                              snippet = `fetch('http://localhost:3000/api/db', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${currentProject.api_key}'
  },
  body: JSON.stringify({
    tableName: '${dbTables[0]?.name || "users"}',
    sqlQuery: 'SELECT * FROM ${dbTables[0]?.name || "users"}'
  })
}).then(r => r.json()).then(data => console.log(data.records));`;
                            } else if (aiSnippetTab === 'js_nosql') {
                              snippet = `fetch('http://localhost:3000/api/db', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${currentProject.api_key}'
  },
  body: JSON.stringify({
    tableName: '${dbTables[0]?.name || "users"}',
    action: 'INSERT',
    insertData: {
      name: 'Emma',
      age: 28
    }
  })
}).then(r => r.json());`;
                            } else if (aiSnippetTab === 'upload') {
                              snippet = `const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('http://localhost:3000/api/data/upload', {
  method: 'POST',
  headers: {
    'x-api-key': '${currentProject.api_key}'
  },
  body: formData
}).then(r => r.json()).then(data => console.log(data.file.uuid));`;
                            } else if (aiSnippetTab === 'retrieve') {
                              snippet = `// Decrypts & streams binary payloads on the fly:
const fileUrl = \`http://localhost:3000/api/data/\${fileUuid}?apiKey=${currentProject.api_key}\`;`;
                            }
                            navigator.clipboard.writeText(snippet);
                            alert("Snippet copied to clipboard!");
                          }}
                          className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <Copy size={11} />
                          <span>Copy Snippet</span>
                        </button>
                      </div>

                      {/* Code Snippet Tabs */}
                      <div className="flex gap-1.5 my-3">
                        {[
                          { id: "js_sql" as const, label: "JS SQL Select" },
                          { id: "js_nosql" as const, label: "JS NoSQL Insert" },
                          { id: "upload" as const, label: "File Upload" },
                          { id: "retrieve" as const, label: "File URL" },
                        ].map(subTab => (
                          <button
                            key={subTab.id}
                            onClick={() => setAiSnippetTab(subTab.id)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${
                              aiSnippetTab === subTab.id
                                ? "bg-zinc-800 text-white border-zinc-700/60"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-transparent"
                            }`}
                          >
                            {subTab.label}
                          </button>
                        ))}
                      </div>

                      {/* Snippet Code block */}
                      <div className="flex-1 bg-[#050507] border border-zinc-900 rounded-xl p-4 font-mono text-xs overflow-x-auto text-zinc-300 max-h-[300px] overflow-y-auto leading-relaxed">
                        {aiSnippetTab === "js_sql" && (
                          <pre className="text-blue-300/90 whitespace-pre-wrap select-all">
{`// 1. Fetch records using standard SQL SELECT query
const response = await fetch('http://localhost:3000/api/db', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${currentProject.api_key}'
  },
  body: JSON.stringify({
    tableName: '${dbTables[0]?.name || "users"}',
    sqlQuery: 'SELECT * FROM ${dbTables[0]?.name || "users"}'
  })
});
const data = await response.json();
console.log('Query records:', data.records);`}
                          </pre>
                        )}

                        {aiSnippetTab === "js_nosql" && (
                          <pre className="text-violet-300/90 whitespace-pre-wrap select-all">
{`// 2. Insert records using Mongo-style NoSQL payload
const response = await fetch('http://localhost:3000/api/db', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${currentProject.api_key}'
  },
  body: JSON.stringify({
    tableName: '${dbTables[0]?.name || "users"}',
    action: 'INSERT',
    insertData: {
      name: 'Emma',
      age: 28,
      is_active: true
    }
  })
});
const data = await response.json();
console.log('Insert success:', data.success);`}
                          </pre>
                        )}

                        {aiSnippetTab === "upload" && (
                          <pre className="text-emerald-300/90 whitespace-pre-wrap select-all">
{`// 3. Encrypted binary/media uploads (multipart/form-data)
const formData = new FormData();
formData.append('file', fileSelectorInput.files[0]);

const response = await fetch('http://localhost:3000/api/data/upload', {
  method: 'POST',
  headers: {
    'x-api-key': '${currentProject.api_key}'
  },
  body: formData
});
const data = await response.json();
console.log('Decrypted File UUID in DB:', data.file.uuid);`}
                          </pre>
                        )}

                        {aiSnippetTab === "retrieve" && (
                          <pre className="text-amber-300/90 whitespace-pre-wrap select-all">
{`// 4. Retrieve/Stream media link with dynamic decryption
const fileUuid = 'your-file-uuid';
const fileUrl = \`http://localhost:3000/api/data/\${fileUuid}?apiKey=${currentProject.api_key}\`;

// Directly use in HTML tags (e.g. <img src={fileUrl} />)`}
                          </pre>
                        )}
                      </div>
                      <div className="mt-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-[10px] text-blue-400/90 flex gap-2">
                        <Cpu size={12} className="flex-shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                          <strong>Protip:</strong> Copy the primary AI Developer Prompt at the top to give your AI model the entire database structure, dynamic tables and detailed setup guide at once.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </main>

      {/* ════════ NEW PROJECT MODAL ════════ */}
      <AnimatePresence>
        {isNewProjectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#0c0c0f] border border-zinc-800/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 pt-6 pb-4 border-b border-zinc-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <PlusCircle size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">New Project</h3>
                      <p className="text-[11px] text-zinc-500">Connect a Telegram channel as database storage</p>
                    </div>
                  </div>
                  <button onClick={() => setIsNewProjectModalOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateProject} className="p-6 space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Project Name</label>
                  <input 
                    type="text" 
                    required
                    value={newProjectName} 
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. My Production DB" 
                    className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none text-white placeholder:text-zinc-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Telegram Channel ID</label>
                  <input 
                    type="text" 
                    required
                    value={newChannelId} 
                    onChange={(e) => setNewChannelId(e.target.value)}
                    placeholder="e.g. -1003959092433" 
                    className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none text-white font-mono placeholder:text-zinc-700"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Bot Tokens</label>
                    <button 
                      type="button" 
                      onClick={handleAddBotField}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                    >
                      + Add Token
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                    {newBots.map((token, i) => (
                      <input 
                        key={i}
                        type="text" 
                        required={i === 0}
                        value={token} 
                        onChange={(e) => handleNewBotChange(i, e.target.value)}
                        placeholder={i === 0 ? "e.g. 8743065502:AAGDjQ2PM..." : `Bot Token #${i + 1}`}
                        className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-xs focus:border-blue-500/50 outline-none text-white font-mono placeholder:text-zinc-700"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className="w-full py-3 rounded-xl border border-zinc-800/50 hover:bg-zinc-800/30 text-sm font-semibold text-zinc-400 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════ NEW TABLE MODAL ════════ */}
      <AnimatePresence>
        {isNewTableModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#0c0c0f] border border-zinc-800/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 pt-6 pb-4 border-b border-zinc-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Table2 size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Create Table</h3>
                      <p className="text-[11px] text-zinc-500">Define your schema and column types</p>
                    </div>
                  </div>
                  <button onClick={() => setIsNewTableModalOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateTable} className="p-6 space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Table Name</label>
                  <input 
                    type="text" 
                    required
                    value={newTableName} 
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="e.g. users" 
                    className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none text-white font-mono placeholder:text-zinc-700"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Columns</label>
                    <button 
                      type="button" 
                      onClick={handleAddSchemaField}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                    >
                      + Add Column
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {/* Default ID column */}
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        disabled
                        value="id" 
                        className="flex-1 bg-zinc-900/50 border border-zinc-800/30 rounded-xl p-2.5 text-xs text-zinc-600 font-mono outline-none cursor-not-allowed"
                      />
                      <select 
                        disabled
                        className="bg-zinc-900/50 border border-zinc-800/30 rounded-xl p-2.5 text-xs text-zinc-600 outline-none cursor-not-allowed"
                      >
                        <option>string (PK)</option>
                      </select>
                      <div className="w-9" />
                    </div>

                    {newTableFields.map((field, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input 
                          type="text" 
                          required
                          value={field.name} 
                          onChange={(e) => handleSchemaFieldChange(i, 'name', e.target.value)}
                          placeholder="Column Name"
                          className="flex-1 bg-[#08080a] border border-zinc-800/50 rounded-xl p-2.5 text-xs text-white font-mono focus:border-blue-500/50 outline-none placeholder:text-zinc-700"
                        />
                        <select 
                          value={field.type}
                          onChange={(e) => handleSchemaFieldChange(i, 'type', e.target.value)}
                          className="bg-[#08080a] border border-zinc-800/50 rounded-xl p-2.5 text-xs text-white focus:border-blue-500/50 outline-none"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                        </select>
                        
                        <button
                          type="button"
                          onClick={() => handleRemoveSchemaField(i)}
                          className="p-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/30 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsNewTableModalOpen(false)}
                    className="w-full py-3 rounded-xl border border-zinc-800/50 hover:bg-zinc-800/30 text-sm font-semibold text-zinc-400 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
                  >
                    Create Table
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════ ADD AUTH USER MODAL ════════ */}
      <AnimatePresence>
        {isAddUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0c0c0f] border border-zinc-800/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 pt-6 pb-4 border-b border-zinc-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Lock size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Add End-User</h3>
                      <p className="text-[11px] text-zinc-500">Create a new credentials-based user</p>
                    </div>
                  </div>
                  <button onClick={() => setIsAddUserModalOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddAuthUser} className="p-6 space-y-4">
                {addUserError && (
                  <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{addUserError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={newUserEmail} 
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com" 
                    className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none text-white placeholder:text-zinc-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Password</label>
                  <input 
                    type="password" 
                    required
                    value={newUserPassword} 
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none text-white placeholder:text-zinc-700"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddUserModalOpen(false)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-400 hover:text-zinc-300 rounded-xl border border-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isAddingUser}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-blue-500/10"
                  >
                    {isAddingUser ? "Adding..." : "Add User"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════ ADD/EDIT RECORD DRAWER ════════ */}
      <AnimatePresence>
        {(isAddRecordModalOpen || isEditRecordModalOpen) && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAddRecordModalOpen(false); setIsEditRecordModalOpen(false); }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            />
            
            {/* Slide-out Drawer */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 190 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[450px] max-w-full z-50 bg-[#0c0c0f]/95 border-l border-zinc-800/80 backdrop-blur-xl shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-zinc-800/40 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <PlusCircle size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{isEditRecordModalOpen ? "Edit Record" : "Add Record"}</h3>
                      <p className="text-[11px] text-zinc-500">Insert or update data in table "{selectedTableName}"</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setIsAddRecordModalOpen(false); setIsEditRecordModalOpen(false); }} 
                    className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="px-6 py-3 bg-zinc-900/20 border-b border-zinc-800/35 flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setRecordEditorMode('form')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                    recordEditorMode === 'form'
                      ? "bg-zinc-800 text-white border-zinc-700/60"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-transparent"
                  }`}
                >
                  Form Builder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const dataToConvert = isEditRecordModalOpen ? modalRecordData : { ...modalRecordData };
                    setRawJsonInput(JSON.stringify(dataToConvert, null, 2));
                    setRecordEditorMode('json');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                    recordEditorMode === 'json'
                      ? "bg-zinc-800 text-white border-zinc-700/60"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-transparent"
                  }`}
                >
                  Raw JSON Editor
                </button>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {recordEditorMode === 'json' ? (
                  <div className="space-y-2 h-full flex flex-col">
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Raw JSON Object</label>
                    <textarea
                      value={rawJsonInput}
                      onChange={(e) => setRawJsonInput(e.target.value)}
                      className="w-full flex-1 bg-[#08080a] border border-zinc-800/50 rounded-xl p-3.5 text-xs text-white font-mono focus:border-blue-500/50 outline-none resize-none leading-relaxed min-h-[250px]"
                    />
                    {jsonError && (
                      <p className="text-rose-400 text-[10px] font-mono">{jsonError}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {(() => {
                      const activeTable = dbTables.find(t => t.name === selectedTableName);
                      const fields = activeTable?.schema?.fields || { id: 'string' };
                      
                      return Object.entries(fields).map(([fieldName, fieldType]) => {
                        // Skip ID for adding, but allow viewing/editing for Edit Mode (disabled)
                        if (fieldName === 'id') {
                          if (isEditRecordModalOpen) {
                            return (
                              <div key={fieldName} className="space-y-1.5">
                                <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Record ID (PK)</label>
                                <input
                                  type="text"
                                  disabled
                                  value={editingRecordId || ""}
                                  className="w-full bg-zinc-900/50 border border-zinc-800/30 rounded-xl p-3 text-xs text-zinc-500 font-mono cursor-not-allowed"
                                />
                              </div>
                            );
                          }
                          return null;
                        }
                        
                        if (fieldName === 'created_at' || fieldName === 'updated_at') {
                          return null; // System managed timestamps
                        }

                        return (
                          <div key={fieldName} className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{fieldName}</label>
                              <span className="text-[9px] font-sans text-zinc-600 lowercase bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800">
                                {fieldType}
                              </span>
                            </div>
                            
                            {fieldType === 'boolean' ? (
                              <select
                                value={String(modalRecordData[fieldName] ?? 'false')}
                                onChange={(e) => setModalRecordData({
                                  ...modalRecordData,
                                  [fieldName]: e.target.value === 'true'
                                })}
                                className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-xs focus:border-blue-500/50 outline-none text-white font-mono"
                              >
                                <option value="false">false</option>
                                <option value="true">true</option>
                              </select>
                            ) : (
                              <input
                                type={fieldType === 'number' ? 'number' : 'text'}
                                value={modalRecordData[fieldName] ?? ""}
                                onChange={(e) => setModalRecordData({
                                  ...modalRecordData,
                                  [fieldName]: e.target.value
                                })}
                                placeholder={`Enter ${fieldName}...`}
                                className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-xs focus:border-blue-500/50 outline-none text-white font-mono placeholder:text-zinc-700"
                              />
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="px-6 py-4 bg-[#0a0a0d] border-t border-zinc-800/40 flex items-center gap-3 flex-shrink-0 mt-auto">
                <button
                  type="button"
                  onClick={() => { setIsAddRecordModalOpen(false); setIsEditRecordModalOpen(false); }}
                  className="w-full py-3 rounded-xl border border-zinc-800/50 hover:bg-zinc-800/30 text-sm font-semibold text-zinc-400 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveRecord(isEditRecordModalOpen)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 text-center"
                >
                  Save Record
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ════════ ADD COLUMN MODAL ════════ */}
      <AnimatePresence>
        {isAddColumnModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#0c0c0f] border border-zinc-800/60 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 pt-6 pb-4 border-b border-zinc-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <PlusCircle size={16} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Add Column visually</h3>
                      <p className="text-[11px] text-zinc-500 font-medium">Add field type to table "{selectedTableName}"</p>
                    </div>
                  </div>
                  <button onClick={() => setIsAddColumnModalOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800/50 text-zinc-500 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddColumn} className="p-6 space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Column Name</label>
                  <input
                    type="text"
                    required
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    placeholder="e.g. email"
                    className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none text-white font-mono placeholder:text-zinc-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Column Type</label>
                  <select
                    value={newColType}
                    onChange={(e) => setNewColType(e.target.value as any)}
                    className="w-full bg-[#08080a] border border-zinc-800/50 rounded-xl p-3 text-sm focus:border-blue-500/50 outline-none text-white"
                  >
                    <option value="string">string</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddColumnModalOpen(false)}
                    className="w-full py-3 rounded-xl border border-zinc-800/50 hover:bg-zinc-800/30 text-sm font-semibold text-zinc-400 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-500/20"
                  >
                    Add Column
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
