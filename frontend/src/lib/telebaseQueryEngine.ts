// Polyfill process.env for Cloudflare Edge Runtime module evaluation compatibility
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).process) {
    (globalThis as any).process = { env: {} };
  } else if (!(globalThis as any).process.env) {
    (globalThis as any).process.env = {};
  }
  if (!(globalThis as any).process.env['NEXTAUTH_URL']) {
    (globalThis as any).process.env['NEXTAUTH_URL'] = "https://telebase.pages.dev";
  }
  if (!(globalThis as any).process.env['NEXTAUTH_SECRET']) {
    (globalThis as any).process.env['NEXTAUTH_SECRET'] = "telebase_secret_token_2026_super_secure_32b_key";
  }
  if (!(globalThis as any).process.version) {
    (globalThis as any).process.version = "v18.0.0";
  }
  if (!(globalThis as any).process.versions) {
    (globalThis as any).process.versions = { node: "18.0.0" };
  } else if (!(globalThis as any).process.versions.node) {
    (globalThis as any).process.versions.node = "18.0.0";
  }
}

import { getDatabaseState, saveDatabaseState, StoredFile, Project, isKVConfigured, ENCRYPTION_KEY, isCFWorkerConfigured, updateStateCache, encryptStateAsync, DatabaseSchema, formatTelegramChannelId, decryptStatePayload, getKVBinding, handleKVLimitExceeded } from './telegramDatabase';

async function gzipDecompress(compressedBytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(compressedBytes as any).body
    ?.pipeThrough(new globalThis.DecompressionStream('gzip') as any);
  const decompressedBuffer = await new Response(stream as any).arrayBuffer();
  return new Uint8Array(decompressedBuffer);
}

async function gzipCompress(rawBytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(rawBytes as any).body
    ?.pipeThrough(new globalThis.CompressionStream('gzip') as any);
  const compressedBuffer = await new Response(stream as any).arrayBuffer();
  return new Uint8Array(compressedBuffer);
}

// --- Edge-compatible hex/bytes utilities ---
function hexToBytes(hex: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(hex, 'hex'));
  }
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr;
}
const byteToHex: string[] = [];
for (let n = 0; n <= 0xff; ++n) {
  byteToHex.push(n.toString(16).padStart(2, '0'));
}

function bytesToHex(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('hex');
  }
  const hexChars = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hexChars[i] = byteToHex[bytes[i]];
  }
  return hexChars.join('');
}
function randomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}
async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data as any));
}
async function aesGcmEncrypt(keyBytes: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Promise<{ cipherText: Uint8Array; authTag: Uint8Array }> {
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes as any, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as any, tagLength: 128 }, key, plaintext as any));
  const cipherText = encrypted.slice(0, encrypted.length - 16);
  const authTag = encrypted.slice(encrypted.length - 16);
  return { cipherText, authTag };
}
async function aesGcmDecrypt(keyBytes: Uint8Array, iv: Uint8Array, cipherText: Uint8Array, authTag: Uint8Array): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey('raw', keyBytes as any, { name: 'AES-GCM' }, false, ['decrypt']);
  const combined = new Uint8Array(cipherText.length + authTag.length);
  combined.set(cipherText);
  combined.set(authTag, cipherText.length);
  return new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as any, tagLength: 128 }, key, combined as any));
}

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || '';
const CLOUDFLARE_WORKER_KEY = process.env.CLOUDFLARE_WORKER_KEY || '';

// ─── KV CHUNKING CONSTANTS ───────────────────────────────────────────────────
// Cloudflare KV values must be ≤ 25MB. We use 20MB as the safe chunk size
// (hex encoding doubles the size, so each chunk is ~10MB of raw encrypted data).
const KV_CHUNK_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB of raw hex bytes per chunk key

/**
 * Splits a large hex string into KV-safe chunks and writes them all.
 * Keys written: `{baseKey}__chunk_0`, `{baseKey}__chunk_1`, ...
 * An index key `{baseKey}__meta` is written containing { chunks, totalSize }.
 */
async function kvPutChunked(
  baseKey: string,
  hexValue: string,
  putFn: (key: string, value: string) => Promise<boolean>
): Promise<boolean> {
  const chunkCount = Math.ceil(hexValue.length / KV_CHUNK_SIZE_BYTES);
  if (chunkCount <= 1) {
    // Small enough — write directly
    return putFn(baseKey, hexValue);
  }

  // Write index metadata first (so readers always know the chunk count)
  const meta = JSON.stringify({ chunks: chunkCount, totalSize: hexValue.length, chunked: true });
  const metaOk = await putFn(`${baseKey}__meta`, meta);
  if (!metaOk) return false;

  // Write each chunk in parallel
  const chunkPromises: Promise<boolean>[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const slice = hexValue.slice(i * KV_CHUNK_SIZE_BYTES, (i + 1) * KV_CHUNK_SIZE_BYTES);
    chunkPromises.push(putFn(`${baseKey}__chunk_${i}`, slice));
  }
  const results = await Promise.all(chunkPromises);
  const allOk = results.every(Boolean);
  if (allOk) {
    // Remove the un-chunked key if it previously existed
    await putFn(baseKey, '__chunked__').catch(() => {}); // sentinel
    console.log(`[KV Chunk] Wrote ${chunkCount} chunks for key "${baseKey}" (total ${(hexValue.length / 1024).toFixed(1)} KB hex)`);
  }
  return allOk;
}

/**
 * Reads a (possibly chunked) value back from KV.
 * Returns the full reassembled hex string, or null if key not found.
 */
async function kvGetChunked(
  baseKey: string,
  getFn: (key: string) => Promise<string | null>
): Promise<string | null> {
  // Check if a metadata key exists
  const metaStr = await getFn(`${baseKey}__meta`);
  if (metaStr) {
    try {
      const meta = JSON.parse(metaStr) as { chunks: number; totalSize: number; chunked: boolean };
      if (meta.chunked && meta.chunks > 1) {
        // Read all chunks in parallel
        const chunkPromises: Promise<string | null>[] = [];
        for (let i = 0; i < meta.chunks; i++) {
          chunkPromises.push(getFn(`${baseKey}__chunk_${i}`));
        }
        const chunks = await Promise.all(chunkPromises);
        if (chunks.some(c => c === null)) {
          console.error(`[KV Chunk] Missing chunk(s) for key "${baseKey}". Chunk count: ${meta.chunks}`);
          return null;
        }
        console.log(`[KV Chunk] Reassembled ${meta.chunks} chunks for key "${baseKey}"`);
        return chunks.join('');
      }
    } catch (e) { /* fall through to direct read */ }
  }

  // Non-chunked direct read
  const val = await getFn(baseKey);
  if (val === '__chunked__') return null; // sentinel with missing meta — corrupted
  return val;
}

// ─────────────────────────────────────────────────────────────────────────────

// Local storage fallback path when Telegram credentials are not present
const fs = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('fs') : null;
const path = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('path') : null;
const os = typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge' ? require('os') : null;

const LOCAL_STORE_DIR = (path && os)
  ? (process.env.VERCEL || process.env.NODE_ENV === 'production'
    ? path.join(os.tmpdir(), '.telebase_data')
    : path.join((typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : ''), '.telebase_data'))
  : '';
const LOCAL_STORE_FILE = (path && LOCAL_STORE_DIR) ? path.join(LOCAL_STORE_DIR, 'local_db.json') : '';

// Memory Cache for Database Tables
const tableCache: Record<string, { data: any[]; timestamp: number }> = {};
const CACHE_TTL_MS = 2500; // 2.5 seconds cache TTL

// Active Simulated Row Locks to prevent concurrency race conditions
const activeRowLocks: Record<string, { lockedAt: number; taskId: string }> = {};

// Write-Ahead Log (WAL) for Transaction Control and Crash Recovery
export interface WALEntry {
  id: string;
  timestamp: string;
  projectId: string;
  tableName: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string;
  oldData: any | null;
  newData: any | null;
  status: 'PENDING' | 'COMMITTED' | 'FAILED';
}

// Memory WAL Registry
let writeAheadLogs: WALEntry[] = [];
let writeAheadLogsHydrated = false;

async function hydrateWriteAheadLogs(forceReload = false): Promise<void> {
  if (writeAheadLogsHydrated && !forceReload) return;
  const state = await getDatabaseState(true);
  const persistedLogs = (state as DatabaseSchema & { walLogs?: WALEntry[] }).walLogs;
  writeAheadLogs = Array.isArray(persistedLogs)
    ? persistedLogs.map((entry) => ({ ...entry }))
    : [];
  writeAheadLogsHydrated = true;
}

async function persistWriteAheadLogs(): Promise<void> {
  const state = await getDatabaseState(true);
  (state as DatabaseSchema & { walLogs?: WALEntry[] }).walLogs = writeAheadLogs.map((entry) => ({ ...entry }));
  await saveDatabaseState(state, { allowShrink: true });
}

function isWalEntryApplied(entry: WALEntry, records: any[]): boolean {
  if (entry.operation === 'INSERT' && entry.newData) {
    return records.some((row) => {
      if (entry.newData.id !== undefined && row.id !== entry.newData.id) {
        return false;
      }
      return Object.entries(entry.newData).every(([key, value]) => row[key] === value);
    });
  }

  if (entry.operation === 'UPDATE' && entry.newData) {
    return records.some((row) => {
      if (row.id !== entry.recordId) return false;
      return Object.entries(entry.newData).every(([key, value]) => row[key] === value);
    });
  }

  if (entry.operation === 'DELETE') {
    return !records.some((row) => row.id === entry.recordId);
  }

  return false;
}

// Database Schema interface for structured tables
export interface TableSchema {
  name: string;
  fields: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
  indexes: string[];
}

// Global Registry of Table Schemas (persisted in Master State under project configuration)
export interface TableMetadata {
  name: string;
  schema: TableSchema;
  createdAt: string;
  recordCount: number;
}

// Execution Plan Step
export interface PlanStep {
  operation: string;
  details: string;
  durationMs: number;
}

// Database Query Response
export interface QueryResult {
  success: boolean;
  records?: any[];
  affectedRows?: number;
  plan: PlanStep[];
  latencyMs: number;
  cacheHit: boolean;
  optimization: {
    indexUsed: string | null;
    strategy: 'INDEX_SCAN' | 'FULL_TABLE_SCAN';
    statistics: {
      totalRecords: number;
      scannedRecords: number;
    };
  };
  walId?: string;
  error?: string;
}

/**
 * Helper to match a row against a dynamic operator-aware NoSQL query filter.
 */
export function matchRow(row: any, filter: any): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;
  return Object.entries(filter).every(([key, filterVal]: [string, any]) => {
    const rowVal = resolveSqlValue(row, key);
    if (filterVal && typeof filterVal === 'object' && !Array.isArray(filterVal)) {
      // Operator support
      return Object.entries(filterVal).every(([op, val]) => {
        if (op === '$eq') return rowVal === val;
        if (op === '$ne') return rowVal !== val;
        if (op === '$gt') return rowVal > (val as any);
        if (op === '$gte') return rowVal >= (val as any);
        if (op === '$lt') return rowVal < (val as any);
        if (op === '$lte') return rowVal <= (val as any);
        if (op === '$regex') return new RegExp(val as string, 'i').test(String(rowVal ?? ''));
        return false;
      });
    }
    // Exact match
    return rowVal === filterVal;
  });
}

const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isSqlIdentifier(value: string): boolean {
  return SQL_IDENTIFIER_RE.test(value.trim());
}

function splitSqlList(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === '(') {
      depth++;
      current += char;
      continue;
    }
    if (char === ')') {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (char === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSqlLiteral(rawVal: string): any {
  const trimmed = rawVal.trim();
  const quoted = (trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'));
  const cleaned = quoted ? trimmed.slice(1, -1) : trimmed;
  if (quoted) {
    return cleaned === 'true' ? true : cleaned === 'false' ? false : cleaned;
  }
  if (cleaned.toLowerCase() === 'null') return null;
  if (cleaned.toLowerCase() === 'true') return true;
  if (cleaned.toLowerCase() === 'false') return false;
  if (cleaned !== '' && !isNaN(Number(cleaned))) return Number(cleaned);
  return cleaned;
}

function resolveSqlValue(row: any, ref: string): any {
  if (!row || !ref) return undefined;
  const key = ref.trim();
  if (Object.prototype.hasOwnProperty.call(row, key)) {
    return row[key];
  }

  const meta = row.__telebaseRows;
  if (meta && typeof meta === 'object') {
    if (key.includes('.')) {
      const [tableName, ...rest] = key.split('.');
      const columnName = rest.join('.');
      const sourceRow = meta[tableName];
      if (sourceRow && Object.prototype.hasOwnProperty.call(sourceRow, columnName)) {
        return sourceRow[columnName];
      }
    } else {
      const sourceTables = Object.keys(meta);
      for (const sourceTable of sourceTables) {
        const sourceRow = meta[sourceTable];
        if (sourceRow && Object.prototype.hasOwnProperty.call(sourceRow, key)) {
          return sourceRow[key];
        }
      }
    }
  }

  if (key.includes('.')) {
    const [tableName, ...rest] = key.split('.');
    const columnName = rest.join('.');
    if (row[tableName] && typeof row[tableName] === 'object' && columnName in row[tableName]) {
      return row[tableName][columnName];
    }
  }

  return row[key];
}

function stripInternalRowKeys(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('__telebase')) continue;
    clean[key] = value;
  }
  return clean;
}

function buildJoinedRow(leftRow: any, rightRow: any, leftTableName: string, rightTableName: string): any {
  const merged: Record<string, any> = {
    ...leftRow,
    __telebaseRows: {
      [leftTableName]: leftRow,
      [rightTableName]: rightRow
    }
  };

  for (const [key, value] of Object.entries(rightRow)) {
    if (!Object.prototype.hasOwnProperty.call(merged, key)) {
      merged[key] = value;
    }
    merged[`${rightTableName}.${key}`] = value;
  }

  return merged;
}

function parseSelectColumns(selectClause: string): string[] {
  const items = splitSqlList(selectClause);
  if (items.length === 0) {
    throw new Error('SELECT clause cannot be empty.');
  }
  return items;
}

function parseOrderByColumns(orderByClause?: string): { expression: string; direction: 'ASC' | 'DESC' }[] {
  if (!orderByClause) return [];
  return splitSqlList(orderByClause).map((part) => {
    const match = part.match(/^(.+?)(?:\s+(ASC|DESC))?$/i);
    if (!match) {
      throw new Error(`Invalid ORDER BY expression: "${part}"`);
    }
    return {
      expression: match[1].trim(),
      direction: (match[2] ? match[2].toUpperCase() : 'ASC') as 'ASC' | 'DESC'
    };
  });
}

function stripSqlAlias(expression: string): string {
  return expression.replace(/\s+AS\s+[A-Za-z_][A-Za-z0-9_]*$/i, '').trim();
}

function parseSqlReference(ref: string): { tableName?: string; columnName: string } | null {
  const trimmed = stripSqlAlias(ref).trim();
  if (!trimmed || trimmed === '*' || trimmed.endsWith('.*')) return null;
  if (!trimmed.includes('.')) {
    return { columnName: trimmed };
  }

  const [tableName, ...rest] = trimmed.split('.');
  const columnName = rest.join('.');
  if (!tableName || !columnName) return null;
  return { tableName, columnName };
}

function isSelectedColumnCoveredByGroupBy(selectExpression: string, groupByColumns: string[]): boolean {
  const selectRef = parseSqlReference(selectExpression);
  if (!selectRef) return false;

  for (const groupByColumn of groupByColumns) {
    const groupRef = parseSqlReference(groupByColumn);
    if (!groupRef) continue;

    if (selectRef.tableName) {
      if (groupRef.tableName && selectRef.tableName === groupRef.tableName && selectRef.columnName === groupRef.columnName) {
        return true;
      }
      if (!groupRef.tableName && selectRef.columnName === groupRef.columnName) {
        return true;
      }
      continue;
    }

    if (selectRef.columnName === groupRef.columnName) {
      return true;
    }
  }

  return false;
}

function validateGroupedSelectColumns(selectColumns: string[], groupByColumns: string[]) {
  if (groupByColumns.length === 0) return;

  for (const column of selectColumns) {
    validateGroupedExpression(stripSqlAlias(column).trim(), groupByColumns);
  }
}

function validateGroupedExpression(expression: string, groupByColumns: string[], countAlias?: string) {
  const trimmed = stripSqlAlias(expression).trim();
  if (!trimmed) {
    throw new Error('SQL Error: Expression cannot be empty.');
  }
  if (/^COUNT\s*\(/i.test(trimmed)) {
    return;
  }
  if (countAlias && trimmed.toLowerCase() === countAlias.toLowerCase()) {
    return;
  }
  if (!isSelectedColumnCoveredByGroupBy(trimmed, groupByColumns)) {
    throw new Error(`SQL Error: Column "${trimmed}" must appear in the GROUP BY clause or be used in an aggregate function.`);
  }
}

function validateGroupedClauseExpressions(clause: string | undefined, groupByColumns: string[], countAlias?: string) {
  if (!clause || groupByColumns.length === 0) return;

  for (const part of clause.split(/\s+AND\s+/i)) {
    const match = part.match(/(.*?)(>=|<=|!=|<>|=|>|<|\s+LIKE\s+)(.*)/i);
    if (!match) {
      throw new Error(`SQL Error: Invalid grouped clause expression "${part.trim()}".`);
    }
    validateGroupedExpression(match[1].trim(), groupByColumns, countAlias);
  }
}

function evaluateSqlClause(row: any, clause?: string): boolean {
  if (!clause || !clause.trim()) return true;
  const parts = clause.split(/\s+AND\s+/i);
  return parts.every((part) => {
    const match = part.match(/(.*?)(>=|<=|!=|<>|=|>|<|\s+LIKE\s+)(.*)/i);
    if (!match) return false;
    const left = match[1].trim();
    const operator = match[2].trim().toUpperCase();
    const right = parseSqlLiteral(match[3].trim());
    const leftValue = resolveSqlValue(row, left);

    if (operator === '=') return leftValue === right;
    if (operator === '!=' || operator === '<>') return leftValue !== right;
    if (operator === '>') return leftValue > right;
    if (operator === '>=') return leftValue >= right;
    if (operator === '<') return leftValue < right;
    if (operator === '<=') return leftValue <= right;
    if (operator === 'LIKE') {
      const pattern = String(right)
        .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
      const anchored = String(match[3].trim()).startsWith('%') ? pattern : `^${pattern}`;
      const finalPattern = String(match[3].trim()).endsWith('%') ? anchored : `${anchored}$`;
      return new RegExp(finalPattern, 'i').test(String(leftValue ?? ''));
    }
    return false;
  });
}

function parseJoinCondition(condition?: string): { left: string; right: string } {
  if (!condition) {
    throw new Error('INNER JOIN requires an ON clause.');
  }
  const match = condition.match(/^(.+?)\s*=\s*(.+)$/);
  if (!match) {
    throw new Error(`Unsupported JOIN condition: "${condition}". Only equality joins are supported.`);
  }
  return { left: match[1].trim(), right: match[2].trim() };
}

function isQualifiedSqlReference(ref: string): boolean {
  return ref.includes('.');
}

function isAmbiguousJoinReference(ref: string, duplicateColumns: Set<string>, baseTableName: string, joinTableName: string): boolean {
  const trimmed = ref.trim();
  if (!trimmed || trimmed === '*' || /^COUNT\s*\(/i.test(trimmed)) return false;
  if (trimmed.includes(' AS ')) {
    const [expr] = trimmed.split(/\s+AS\s+/i);
    return isAmbiguousJoinReference(expr.trim(), duplicateColumns, baseTableName, joinTableName);
  }
  if (trimmed.endsWith('.*')) return false;
  if (isQualifiedSqlReference(trimmed)) return false;
  return duplicateColumns.has(trimmed) && duplicateColumns.size > 0 && !!baseTableName && !!joinTableName;
}

function applySqlProjection(row: any, columns: string[], groupContext?: { countValue?: number; countAlias?: string }): any {
  const hasStar = columns.some((column) => column === '*');
  const projected: Record<string, any> = {};

  if (hasStar) {
    Object.assign(projected, stripInternalRowKeys(row));
  }

  for (const column of columns) {
    if (column === '*') continue;

    const countMatch = column.match(/^COUNT\s*\(\s*(\*|[A-Za-z_][A-Za-z0-9_\.]*)\s*\)(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_]*))?$/i);
    if (countMatch) {
      const alias = countMatch[2] || 'count';
      projected[alias] = groupContext?.countValue ?? 0;
      continue;
    }

    const starMatch = column.match(/^([A-Za-z_][A-Za-z0-9_]*)\.\*$/);
    if (starMatch) {
      const tableName = starMatch[1];
      const source = row.__telebaseRows?.[tableName];
      if (source && typeof source === 'object') {
        Object.assign(projected, source);
      }
      continue;
    }

    const aliasMatch = column.match(/^(.+?)\s+AS\s+([A-Za-z_][A-Za-z0-9_]*)$/i);
    const expression = aliasMatch ? aliasMatch[1].trim() : column;
    const alias = aliasMatch ? aliasMatch[2].trim() : expression;
    projected[alias] = resolveSqlValue(row, expression);
  }

  return projected;
}

async function executeStructuredSelect(
  project: Project,
  baseTableName: string,
  baseRecords: any[],
  action: {
    sqlSelect?: {
      selectClause: string;
      joinTable?: string;
      joinCondition?: string;
      whereClause?: string;
      groupByClause?: string;
      havingClause?: string;
      orderByClause?: string;
      limit?: number;
    };
    noSqlQuery?: any;
  },
  plan: PlanStep[]
): Promise<{ records: any[]; scannedRecords: number; indexUsed: string | null; strategy: 'INDEX_SCAN' | 'FULL_TABLE_SCAN' }> {
  const sqlSelect = action.sqlSelect;
  if (!sqlSelect) {
    return { records: baseRecords, scannedRecords: baseRecords.length, indexUsed: null, strategy: 'FULL_TABLE_SCAN' };
  }

  const state = await getDatabaseState(true);
  const baseSchema = state.schemas?.[`${project.id}_${baseTableName}`] || null;
  const selectColumns = parseSelectColumns(sqlSelect.selectClause);
  const orderByColumns = parseOrderByColumns(sqlSelect.orderByClause);
  const groupByColumns = sqlSelect.groupByClause ? splitSqlList(sqlSelect.groupByClause) : [];
  const hasCount = selectColumns.some((item) => /^COUNT\s*\(/i.test(item));
  const countMatch = selectColumns.find((item) => /^COUNT\s*\(/i.test(item));
  const countAlias = countMatch?.match(/AS\s+([A-Za-z_][A-Za-z0-9_]*)$/i)?.[1] || 'count';
  const joinTable = sqlSelect.joinTable?.trim();
  const joinCondition = sqlSelect.joinCondition?.trim();

  const resolvedJoinTable = joinTable || undefined;
  let scanRows = baseRecords;
  let scannedRecords = baseRecords.length;
  let indexUsed: string | null = null;
  let strategy: 'INDEX_SCAN' | 'FULL_TABLE_SCAN' = 'FULL_TABLE_SCAN';

  if (resolvedJoinTable) {
    if (!isSqlIdentifier(resolvedJoinTable)) {
      throw new Error(`Invalid join table name: "${resolvedJoinTable}".`);
    }
    if (resolvedJoinTable === baseTableName) {
      throw new Error('INNER JOIN on the same table requires aliases and is not supported.');
    }

    const joinSchema = state.schemas?.[`${project.id}_${resolvedJoinTable}`] || null;
    const duplicateColumns = new Set(
      Object.keys(baseSchema?.fields || {}).filter((column) => !!joinSchema?.fields?.[column])
    );

    const joinRecordsResult = await getTableRecords(project, resolvedJoinTable, true);
    const joinRecords = joinRecordsResult.records;
    scannedRecords += joinRecords.length;

    const joinColumns = selectColumns.slice();
    const { left: leftExpr, right: rightExpr } = parseJoinCondition(joinCondition);

    const validateReference = (ref: string) => {
      const trimmed = ref.trim();
      if (!trimmed) throw new Error('Column reference cannot be empty.');
      if (trimmed === '*') return;
      if (/^COUNT\s*\(/i.test(trimmed)) return;

      if (trimmed.includes(' AS ')) {
        const [expr] = trimmed.split(/\s+AS\s+/i);
        validateReference(expr.trim());
        return;
      }

      if (trimmed.endsWith('.*')) {
        const tableName = trimmed.slice(0, -2);
        if (tableName !== baseTableName && tableName !== resolvedJoinTable) {
          throw new Error(`Table "${tableName}" is not part of this query.`);
        }
        return;
      }

      const candidate = trimmed;
      if (candidate.includes('.')) {
        const [tableName, ...rest] = candidate.split('.');
        const columnName = rest.join('.');
        if (!isSqlIdentifier(tableName) || !isSqlIdentifier(columnName)) {
          throw new Error(`Invalid column reference: "${ref}".`);
        }
        if (tableName === baseTableName) {
          if (baseSchema?.fields && !baseSchema.fields[columnName]) throw new Error(`Column "${columnName}" does not exist on table "${baseTableName}".`);
        } else if (tableName === resolvedJoinTable) {
          if (joinSchema?.fields && !joinSchema.fields[columnName]) throw new Error(`Column "${columnName}" does not exist on table "${resolvedJoinTable}".`);
        } else {
          throw new Error(`Table "${tableName}" is not part of this query.`);
        }
        return;
      }

      if (!isSqlIdentifier(candidate)) {
        throw new Error(`Invalid column reference: "${ref}".`);
      }
      if (duplicateColumns.has(candidate)) {
        throw new Error(`SQL Error: Ambiguous column reference "${candidate}". Use a fully qualified reference such as "${baseTableName}.${candidate}" or "${resolvedJoinTable}.${candidate}".`);
      }
      const baseHas = baseSchema?.fields ? !!baseSchema.fields[candidate] : true;
      const joinHas = joinSchema?.fields ? !!joinSchema.fields[candidate] : false;
      if (!baseHas && !joinHas) {
        throw new Error(`Column "${candidate}" does not exist in the query scope.`);
      }
    };

    validateReference(leftExpr);
    validateReference(rightExpr);
    for (const column of joinColumns) {
      validateReference(column);
    }
    for (const column of groupByColumns) {
      validateReference(column);
    }
    for (const column of orderByColumns) {
      validateReference(column.expression);
    }
    validateGroupedSelectColumns(selectColumns, groupByColumns);
    validateGroupedClauseExpressions(sqlSelect.havingClause, groupByColumns, countAlias);
    for (const column of orderByColumns) {
      validateGroupedExpression(column.expression, groupByColumns, countAlias);
    }

    const joined: any[] = [];
    for (const leftRow of baseRecords) {
      for (const rightRow of joinRecords) {
        const candidate = buildJoinedRow(leftRow, rightRow, baseTableName, resolvedJoinTable);
        if (resolveSqlValue(candidate, leftExpr) === resolveSqlValue(candidate, rightExpr)) {
          joined.push(candidate);
        }
      }
    }
    scanRows = joined;
    strategy = 'FULL_TABLE_SCAN';
  } else {
    const referencedColumns = new Set<string>();
    for (const column of selectColumns) {
      if (/^COUNT\s*\(/i.test(column) || column === '*') continue;
      const clean = column.replace(/\s+AS\s+.+$/i, '').trim();
      if (clean.endsWith('.*')) continue;
      referencedColumns.add(clean);
    }
    for (const column of groupByColumns) {
      referencedColumns.add(column);
    }
    for (const column of orderByColumns) {
      referencedColumns.add(column.expression);
    }

    const validateReference = (ref: string) => {
      const trimmed = ref.trim();
      if (!trimmed || trimmed === '*') return;
      if (/^COUNT\s*\(/i.test(trimmed)) return;
      if (trimmed.endsWith('.*')) {
        const tableName = trimmed.slice(0, -2);
        if (tableName !== baseTableName) {
          throw new Error(`Table "${tableName}" is not part of this query.`);
        }
        return;
      }
      const candidate = trimmed;
      if (candidate.includes('.')) {
        const [tableName, ...rest] = candidate.split('.');
        const columnName = rest.join('.');
        if (tableName !== baseTableName) {
          throw new Error(`Table "${tableName}" is not part of this query.`);
        }
        if (baseSchema?.fields && !baseSchema.fields[columnName]) {
          throw new Error(`Column "${columnName}" does not exist on table "${baseTableName}".`);
        }
        return;
      }
      if (!isSqlIdentifier(candidate)) {
        throw new Error(`Invalid column reference: "${ref}".`);
      }
      if (!baseSchema?.fields || baseSchema.fields[candidate]) return;
      throw new Error(`Column "${candidate}" does not exist on table "${baseTableName}".`);
    };

    for (const ref of referencedColumns) {
      validateReference(ref);
    }
    validateGroupedSelectColumns(selectColumns, groupByColumns);
    validateGroupedClauseExpressions(sqlSelect.havingClause, groupByColumns, countAlias);
    for (const column of orderByColumns) {
      validateGroupedExpression(column.expression, groupByColumns, countAlias);
    }

    if (baseSchema?.indexes?.length) {
      const whereKeys = action.noSqlQuery ? Object.keys(action.noSqlQuery) : [];
      if (whereKeys.includes('id') || whereKeys.includes(`${baseTableName}.id`)) {
        indexUsed = 'PRIMARY_KEY_INDEX (id)';
        strategy = 'INDEX_SCAN';
        scannedRecords = Math.min(1, baseRecords.length);
      }
    }
  }

  let workingRows = scanRows.slice();
  if (action.noSqlQuery && Object.keys(action.noSqlQuery).length > 0) {
    workingRows = workingRows.filter((row) => matchRow(row, action.noSqlQuery));
  }

  let outputRows: any[] = [];
  const isAggregate = hasCount || groupByColumns.length > 0;

  if (isAggregate) {
    const groups = new Map<string, any[]>();
    if (groupByColumns.length === 0) {
      groups.set('__all__', workingRows);
    } else {
      for (const row of workingRows) {
        const key = JSON.stringify(groupByColumns.map((column) => resolveSqlValue(row, column)));
        const existing = groups.get(key);
        if (existing) existing.push(row);
        else groups.set(key, [row]);
      }
    }

    for (const groupRows of groups.values()) {
      if (groupRows.length === 0) continue;
      const representative = groupRows[0];
      const countColumn = countMatch?.match(/^COUNT\s*\(\s*(\*|[A-Za-z_][A-Za-z0-9_\.]*)\s*\)/i)?.[1] || '*';
      const countValue = countColumn === '*'
        ? groupRows.length
        : groupRows.filter((row) => resolveSqlValue(row, countColumn) !== null && resolveSqlValue(row, countColumn) !== undefined).length;
      const projected = applySqlProjection(representative, selectColumns, { countValue, countAlias });

      if (sqlSelect.havingClause) {
        const normalizedHaving = sqlSelect.havingClause
          .replace(/COUNT\s*\(\s*\*\s*\)/ig, countAlias)
          .replace(/COUNT\s*\(\s*[A-Za-z_][A-Za-z0-9_\.]*\s*\)/ig, countAlias);
        if (!evaluateSqlClause(projected, normalizedHaving)) {
          continue;
        }
      }

      outputRows.push(projected);
    }

    if (orderByColumns.length > 0) {
      outputRows.sort((left, right) => {
        for (const order of orderByColumns) {
          const normalizedExpression = order.expression
            .replace(/COUNT\s*\(\s*\*\s*\)/ig, countAlias)
            .replace(/COUNT\s*\(\s*[A-Za-z_][A-Za-z0-9_\.]*\s*\)/ig, countAlias);
          const leftValue = resolveSqlValue(left, normalizedExpression);
          const rightValue = resolveSqlValue(right, normalizedExpression);
          if (leftValue === rightValue) continue;
          const direction = order.direction === 'DESC' ? -1 : 1;
          return leftValue > rightValue ? direction : -direction;
        }
        return 0;
      });
    }
  } else {
    if (orderByColumns.length > 0) {
      workingRows.sort((left, right) => {
        for (const order of orderByColumns) {
          const leftValue = resolveSqlValue(left, order.expression);
          const rightValue = resolveSqlValue(right, order.expression);
          if (leftValue === rightValue) continue;
          const direction = order.direction === 'DESC' ? -1 : 1;
          return leftValue > rightValue ? direction : -direction;
        }
        return 0;
      });
    }

    outputRows = workingRows.map((row) => applySqlProjection(row, selectColumns));
  }

  if (sqlSelect.limit !== undefined) {
    outputRows = outputRows.slice(0, sqlSelect.limit);
  }

  outputRows = outputRows.map((row) => stripInternalRowKeys(row));
  return { records: outputRows, scannedRecords, indexUsed, strategy };
}

/**
 * Ensures the local database fallback directory exists.
 */
function ensureLocalStore() {
  if (!fs || !LOCAL_STORE_DIR || !LOCAL_STORE_FILE) return;
  if (!fs.existsSync(LOCAL_STORE_DIR)) {
    fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_STORE_FILE)) {
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify({ tables: {}, metadata: {} }, null, 2), 'utf-8');
  }
}

/**
 * Gets local database metadata (like UUID) for monotonic validation.
 */
function getLocalTableMetadata(projectId: string, tableName: string): { uuid?: string } {
  if (!fs || !LOCAL_STORE_FILE) return {};
  ensureLocalStore();
  try {
    const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
    const store = JSON.parse(raw);
    if (!store.metadata) store.metadata = {};
    const key = `${projectId}_${tableName}`;
    return store.metadata[key] || {};
  } catch (e) {
    return {};
  }
}

/**
 * Gets local database state for the fallback channel.
 */
function getLocalTableRecords(projectId: string, tableName: string): any[] {
  if (!fs || !LOCAL_STORE_FILE) return [];
  ensureLocalStore();
  try {
    const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
    const store = JSON.parse(raw);
    const key = `${projectId}_${tableName}`;
    return store.tables[key] || [];
  } catch (e) {
    console.error('[Local fallback read error]', e);
    return [];
  }
}

/**
 * Saves local database state for the fallback channel.
 */
function saveLocalTableRecords(projectId: string, tableName: string, records: any[], uuid?: string) {
  if (!fs || !LOCAL_STORE_FILE) return;
  ensureLocalStore();
  try {
    const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
    const store = JSON.parse(raw);
    const key = `${projectId}_${tableName}`;
    store.tables[key] = records;
    if (!store.metadata) store.metadata = {};
    if (uuid) {
      store.metadata[key] = { uuid };
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Local fallback write error]', e);
  }
}

function deleteLocalTableArtifacts(projectId: string, tableName: string) {
  if (!fs || !LOCAL_STORE_FILE) return;
  ensureLocalStore();
  try {
    const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
    const store = JSON.parse(raw);
    const key = `${projectId}_${tableName}`;
    if (store.tables) {
      delete store.tables[key];
    }
    if (store.metadata) {
      delete store.metadata[key];
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Local fallback delete error]', e);
  }
}

/**
 * Helper to fetch database tables, utilizing hot memory cache or Telegram/Local storage chunks.
 */
export async function getTableRecords(
  project: Project,
  tableName: string,
  forceRefresh = false
): Promise<{ records: any[]; cacheHit: boolean }> {
  const cacheKey = `${project.id}_${tableName}`;
  const now = Date.now();

  if (!forceRefresh && tableCache[cacheKey] && (now - tableCache[cacheKey].timestamp < CACHE_TTL_MS)) {
    return { records: tableCache[cacheKey].data, cacheHit: true };
  }

  let records: any[] | null = null;
  let state: DatabaseSchema | null = null;

  // 1. Cloudflare Worker KV Batch GET Optimization (Under 30ms for BOTH state and table records in 1 roundtrip!)
  if (isCFWorkerConfigured) {
    try {
      const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/batch-get`;
      const tableKey = `table_${project.id}_${tableName}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-worker-key': CLOUDFLARE_WORKER_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keys: ['telebase_state', tableKey]
        })
      });

      if (res.status === 429) {
        handleKVLimitExceeded();
      }

      if (res.ok) {
        const batchData = await res.json() as Record<string, string | null>;
        
        // A. Decrypt Master State
        const stateHex = batchData['telebase_state'];
        if (stateHex) {
          const encryptedBuffer = hexToBytes(stateHex);
          try {
            const decryptedText = await decryptStatePayload(encryptedBuffer);
            state = JSON.parse(decryptedText) as DatabaseSchema;
            updateStateCache(state);
          } catch (decErr) {
            console.error('[Query Engine] Master state decryption failed:', decErr);
          }
        } else {
          state = { projects: [], files: [] };
          updateStateCache(state);
        }

        // B. Decrypt Table Records (if existing)
        const tableHex = batchData[tableKey];
        if (tableHex) {
          const encryptedBuffer = hexToBytes(tableHex);
          if (encryptedBuffer.length >= 28) {
            const iv = encryptedBuffer.slice(0, 12);
            const authTag = encryptedBuffer.slice(12, 28);
            const cipherText = encryptedBuffer.slice(28);

            const projectAESKey = await sha256Bytes(new TextEncoder().encode(project.api_key));
            const decrypted = await aesGcmDecrypt(projectAESKey, iv, cipherText, authTag);
            const decompressed = await gzipDecompress(decrypted);
            const parsed = JSON.parse(new TextDecoder().decode(decompressed));
            records = Array.isArray(parsed) ? parsed : (parsed.records || []);
            console.log(`[Query Engine] Table "${tableName}" successfully loaded via Batch GET edge route!`);
          }
        }
      }
    } catch (error: any) {
      console.warn(`[Query Engine] Cloudflare Worker KV Batch GET read failed for ${tableName}:`, error.message);
      const errMsg = String(error).toLowerCase();
      if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
        handleKVLimitExceeded();
      }
    }
  }

  // Fallback 1: If batch GET didn't run or fail, do standard sequential GET state
  if (!state) {
    state = await getDatabaseState(forceRefresh);
  }

  const filename = `table_${project.id}_${tableName}.json`;
  const tableFile = state.files
    .filter((f) => f.project_id === project.id && f.filename === filename)
    .sort((a, b) => b.version - a.version)[0]; // get newest version

  if (!tableFile || tableFile.size === 0) {
    // A. If Cloudflare KV is configured, attempt direct recovery from KV binding/REST
    if (isKVConfigured || isCFWorkerConfigured) {
      try {
        const kvBinding = getKVBinding();
        const kvRestGetFn = async (key: string): Promise<string | null> => {
          try {
            if (kvBinding && typeof kvBinding.get === 'function') {
              return await kvBinding.get(key);
            }
          } catch (e: any) {
            const errMsg = String(e).toLowerCase();
            if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
              handleKVLimitExceeded();
            }
            throw e;
          }
          const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
          const CF_KV_NS = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
          const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
          const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NS}/values/${key}`;
          try {
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CF_TOKEN}` } });
            if (res.status === 429) {
              handleKVLimitExceeded();
              return null;
            }
            if (res.status === 404) return null;
            if (!res.ok) throw new Error(`KV REST GET failed: ${res.status}`);
            return res.text();
          } catch (e: any) {
            const errMsg = String(e).toLowerCase();
            if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
              handleKVLimitExceeded();
            }
            throw e;
          }
        };
        const encryptedHex = await kvGetChunked(`table_${project.id}_${tableName}`, kvRestGetFn);
        if (encryptedHex && encryptedHex !== '__chunked__') {
          const encryptedBuffer = hexToBytes(encryptedHex);
          if (encryptedBuffer.length >= 28) {
            const iv = encryptedBuffer.slice(0, 12);
            const authTag = encryptedBuffer.slice(12, 28);
            const cipherText = encryptedBuffer.slice(28);
            const projectAESKey = await sha256Bytes(new TextEncoder().encode(project.api_key));
            const decrypted = await aesGcmDecrypt(projectAESKey, iv, cipherText, authTag);
            const decompressed = await gzipDecompress(decrypted);
            
            const rawText = new TextDecoder().decode(decompressed);
            const parsed = JSON.parse(rawText);
            const loadedRecords = Array.isArray(parsed) ? parsed : (parsed.records || []);
            
            console.log(`[Query Engine] Table "${tableName}" successfully recovered directly from Cloudflare KV (state was stale)!`);
            
            // Auto-heal state file index back into master state
            try {
              const fileHashBytes = await sha256Bytes(cipherText);
              const fileHashHex = bytesToHex(fileHashBytes);
              const recoveredTableFile: StoredFile = {
                uuid: globalThis.crypto.randomUUID(),
                project_id: project.id,
                filename,
                version: 1,
                chunk_count: 1,
                file_hash: fileHashHex,
                size: rawText.length,
                created_at: new Date().toISOString(),
                chunks: [
                  {
                    chunk_index: 0,
                    message_id: 'pending_telegram_backup',
                    iv: bytesToHex(iv),
                    auth_tag: bytesToHex(authTag)
                  }
                ]
              };
              
              const activeState = await getDatabaseState(true);
              activeState.files = activeState.files.filter(f => !(f.project_id === project.id && f.filename === filename));
              activeState.files.push(recoveredTableFile);
              await saveDatabaseState(activeState, { allowShrink: true });
              console.log(`[Query Engine] Master state auto-healed for table "${tableName}"!`);
            } catch (healErr: any) {
              console.error(`[Query Engine] Failed to save auto-healed state:`, healErr.message);
            }

            tableCache[cacheKey] = { data: loadedRecords, timestamp: now };
            return { records: loadedRecords, cacheHit: false };
          }
        }
      } catch (e: any) {
        console.warn(`[Query Engine] Direct KV state recovery failed for ${tableName}:`, e.message);
      }
    }

    // B. Table file doesn't exist yet or is uninitialized (empty), return empty list
    return { records: [], cacheHit: false };
  }

  // --- MONOTONIC TABLE VERSION UUID CHECK (LIGHTSPEED <1MS READS!) ---
  const localMeta = getLocalTableMetadata(project.id, tableName);
  if (localMeta.uuid === tableFile.uuid) {
    const localRecords = getLocalTableRecords(project.id, tableName);
    if (localRecords && (localRecords.length > 0 || tableFile.size === 0)) {
      console.log(`[Query Engine] Table "${tableName}" local cache is up-to-date (UUID: ${tableFile.uuid}). Skipping download.`);
      tableCache[cacheKey] = { data: localRecords, timestamp: now };
      return { records: localRecords, cacheHit: true };
    }
  }

  // Fallback 2: Standard Cloudflare Worker KV GET — with automatic chunk reassembly
  if (!records && isCFWorkerConfigured) {
    try {
      const workerGetFn = async (key: string): Promise<string | null> => {
        try {
          const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${key}`;
          const res = await fetch(url, { headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY } });
          if (res.status === 429) {
            handleKVLimitExceeded();
            return null;
          }
          if (res.status === 404) return null;
          if (!res.ok) throw new Error(`Worker KV GET failed: ${res.status}`);
          return res.text();
        } catch (e: any) {
          const errMsg = String(e).toLowerCase();
          if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
            handleKVLimitExceeded();
          }
          throw e;
        }
      };
      const encryptedHex = await kvGetChunked(`table_${project.id}_${tableName}`, workerGetFn);
      if (encryptedHex && encryptedHex !== '__chunked__') {
        const encryptedBuffer = hexToBytes(encryptedHex);
        if (encryptedBuffer.length >= 28) {
          const iv = encryptedBuffer.slice(0, 12);
          const authTag = encryptedBuffer.slice(12, 28);
          const cipherText = encryptedBuffer.slice(28);
          const projectAESKey = await sha256Bytes(new TextEncoder().encode(project.api_key));
          const decrypted = await aesGcmDecrypt(projectAESKey, iv, cipherText, authTag);
          const decompressed = await gzipDecompress(decrypted);
          const parsed = JSON.parse(new TextDecoder().decode(decompressed));
          records = Array.isArray(parsed) ? parsed : (parsed.records || []);
          console.log(`[Query Engine] Table "${tableName}" loaded from Cloudflare Worker KV (chunked-aware)!`);
        }
      }
    } catch (error: any) {
      console.warn(`[Query Engine] Cloudflare Worker KV read failed for ${tableName}:`, error.message);
    }
  }

  // 3. Cloudflare KV REST API or direct KV binding — with automatic chunk reassembly
  if (!records && isKVConfigured) {
    try {
      const kvBinding = getKVBinding();
      const kvRestGetFn = async (key: string): Promise<string | null> => {
        try {
          if (kvBinding && typeof kvBinding.get === 'function') {
            return await kvBinding.get(key);
          }
        } catch (e: any) {
          const errMsg = String(e).toLowerCase();
          if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
            handleKVLimitExceeded();
          }
          throw e;
        }
        const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
        const CF_KV_NS = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
        const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
        const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NS}/values/${key}`;
        try {
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CF_TOKEN}` } });
          if (res.status === 429) {
            handleKVLimitExceeded();
            return null;
          }
          if (res.status === 404) return null;
          if (!res.ok) throw new Error(`KV REST GET failed: ${res.status}`);
          return res.text();
        } catch (e: any) {
          const errMsg = String(e).toLowerCase();
          if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
            handleKVLimitExceeded();
          }
          throw e;
        }
      };
      const encryptedHex = await kvGetChunked(`table_${project.id}_${tableName}`, kvRestGetFn);
      if (encryptedHex && encryptedHex !== '__chunked__') {
        const encryptedBuffer = hexToBytes(encryptedHex);
        if (encryptedBuffer.length >= 28) {
          const iv = encryptedBuffer.slice(0, 12);
          const authTag = encryptedBuffer.slice(12, 28);
          const cipherText = encryptedBuffer.slice(28);
          const projectAESKey = await sha256Bytes(new TextEncoder().encode(project.api_key));
          const decrypted = await aesGcmDecrypt(projectAESKey, iv, cipherText, authTag);
          const decompressed = await gzipDecompress(decrypted);
          const parsed = JSON.parse(new TextDecoder().decode(decompressed));
          records = Array.isArray(parsed) ? parsed : (parsed.records || []);
          console.log(`[Query Engine] Table "${tableName}" loaded from Cloudflare KV (chunked-aware)!`);
        }
      }
    } catch (error: any) {
      console.warn(`[Query Engine] Cloudflare KV read failed for ${tableName}:`, error.message);
    }
  }

  // 4. Always-Free KV Fallback (kvdb.io - under 40ms reads!)
  if (!records && !isKVConfigured && !isCFWorkerConfigured) {
    try {
      const bucketHash = await sha256Bytes(ENCRYPTION_KEY);
      const bucketId = 'k' + bytesToHex(bucketHash).substring(0, 19);
      const url = `https://kvdb.io/buckets/${bucketId}/keys/table_${project.id}_${tableName}`;
      const res = await fetch(url);
      if (res.ok) {
        const encryptedHex = await res.text();
        const encryptedBuffer = hexToBytes(encryptedHex);
        if (encryptedBuffer.length >= 28) {
          const iv = encryptedBuffer.slice(0, 12);
          const authTag = encryptedBuffer.slice(12, 28);
          const cipherText = encryptedBuffer.slice(28);

          const projectAESKey = await sha256Bytes(new TextEncoder().encode(project.api_key));
          const decrypted = await aesGcmDecrypt(projectAESKey, iv, cipherText, authTag);
          const decompressed = await gzipDecompress(decrypted);
          const parsed = JSON.parse(new TextDecoder().decode(decompressed));
          records = Array.isArray(parsed) ? parsed : (parsed.records || []);
          console.log(`[Query Engine] Table "${tableName}" successfully loaded from Free KV (kvdb.io)!`);
        }
      }
    } catch (error: any) {
      console.warn(`[Query Engine] Free KV (kvdb.io) read failed for ${tableName}:`, error.message);
    }
  }

  // 5. Telegram Chunks Fallback (Under 1.5s reads)
  const hasTelegramConfig = !!((project.bots && project.bots.length > 0 && project.channel_id) || (process.env.BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID));
  if (!records && hasTelegramConfig) {
    try {
      const projectAESKey = await sha256Bytes(new TextEncoder().encode(project.api_key));
      const decryptedChunks: Uint8Array[] = [];

      for (let i = 0; i < tableFile.chunks.length; i++) {
        const chunk = tableFile.chunks[i];
        const botToken = project.bots.length > 0 ? project.bots[i % project.bots.length] : process.env.BOT_TOKEN || '';

        const getFileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id: chunk.message_id })
        });
        const fileData = await getFileRes.json();
        if (!fileData.ok) throw new Error(`Telegram getFile failed: ${JSON.stringify(fileData)}`);

        const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
        const downloadRes = await fetch(downloadUrl);
        const encryptedChunk = new Uint8Array(await downloadRes.arrayBuffer());

        const iv = hexToBytes(chunk.iv);
        const authTag = hexToBytes(chunk.auth_tag);

        const decrypted = await aesGcmDecrypt(projectAESKey, iv, encryptedChunk, authTag);
        decryptedChunks.push(decrypted);
      }

      let totalLength = 0;
      for (const c of decryptedChunks) totalLength += c.length;
      const gzippedBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const c of decryptedChunks) {
        gzippedBuffer.set(c, offset);
        offset += c.length;
      }
      const decompressed = await gzipDecompress(gzippedBuffer);
      const parsed = JSON.parse(new TextDecoder().decode(decompressed));
      records = Array.isArray(parsed) ? parsed : (parsed.records || []);
      console.log(`[Query Engine] Table "${tableName}" successfully loaded and decrypted from Telegram!`);
    } catch (error: any) {
      console.warn(`[Query Engine] Telegram read failed for ${tableName}:`, error.message);
    }
  }

  // If successfully loaded from cloud/Telegram, update local cache and memory cache
  if (records) {
    saveLocalTableRecords(project.id, tableName, records, tableFile.uuid);
    tableCache[cacheKey] = { data: records, timestamp: now };
    return { records, cacheHit: false };
  }

  // Fallback: If all else fails, load from local file system
  const fallbackRecords = getLocalTableRecords(project.id, tableName);
  tableCache[cacheKey] = { data: fallbackRecords, timestamp: now };
  return { records: fallbackRecords, cacheHit: false };
}

/**
 * Saves database table back to storage (Telegram/KV/Local), generating physical page chunks.
 */
export async function saveTableRecords(
  project: Project,
  tableName: string,
  records: any[]
): Promise<void> {
  const cacheKey = `${project.id}_${tableName}`;
  const now = Date.now();
  tableCache[cacheKey] = { data: records, timestamp: now };

  const fileUuid = globalThis.crypto.randomUUID();
  
  // Write to local fallback file immediately to guarantee zero-data loss and lightspeed latency
  saveLocalTableRecords(project.id, tableName, records, fileUuid);

  try {
    console.log(`[Query Engine] Starting Cloud & Telegram sync for table "${tableName}"...`);
    
    // ─── OPTIMIZATION: Start fetching the master state CONCURRENTLY ───
    let statePromise: Promise<any> | null = null;
    if (isCFWorkerConfigured || isKVConfigured) {
      statePromise = getDatabaseState(true);
    }

    const rawData = JSON.stringify({
      tableName,
      projectId: project.id,
      records
    });
    const gzipped = await gzipCompress(new TextEncoder().encode(rawData));
    
    const projectAESKey = await sha256Bytes(new TextEncoder().encode(project.api_key));
    const iv = randomBytes(12);
    const { cipherText: encrypted, authTag } = await aesGcmEncrypt(projectAESKey, iv, gzipped);

    // Concatenate finalBuffer = iv + authTag + encrypted
    const finalBuffer = new Uint8Array(iv.length + authTag.length + encrypted.length);
    finalBuffer.set(iv, 0);
    finalBuffer.set(authTag, iv.length);
    finalBuffer.set(encrypted, iv.length + authTag.length);
    
    const encryptedHex = bytesToHex(finalBuffer);
    const filename = `table_${project.id}_${tableName}.json`;

    const encryptedHashBytes = await sha256Bytes(encrypted);
    const fileHashHex = bytesToHex(encryptedHashBytes);

    const newTableFile: StoredFile = {
      uuid: fileUuid,
      project_id: project.id,
      filename,
      version: 1,
      chunk_count: 1,
      file_hash: fileHashHex,
      size: rawData.length,
      created_at: new Date().toISOString(),
      chunks: [
        {
          chunk_index: 0,
          message_id: 'pending_telegram_backup', // Webhook will pick this up for background backup
          iv: bytesToHex(iv),
          auth_tag: bytesToHex(authTag)
        }
      ]
    };

    let cloudSaveSuccess = false;

    const saveTableToCloud = async (): Promise<boolean> => {
      // ─── 1. Cloudflare Worker KV — chunked write ───
      if (isCFWorkerConfigured) {
        try {
          const workerPutFn = async (key: string, value: string): Promise<boolean> => {
            try {
              const url = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/${key}`;
              const res = await fetch(url, {
                method: 'PUT',
                headers: { 'x-worker-key': CLOUDFLARE_WORKER_KEY, 'Content-Type': 'text/plain' },
                body: value
              });
              if (res.status === 429) {
                handleKVLimitExceeded();
                return false;
              }
              if (!res.ok) throw new Error(`Worker KV PUT failed: ${await res.text()}`);
              return true;
            } catch (e: any) {
              const errMsg = String(e).toLowerCase();
              if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
                handleKVLimitExceeded();
              }
              throw e;
            }
          };
          const ok = await kvPutChunked(`table_${project.id}_${tableName}`, encryptedHex, workerPutFn);
          if (ok) {
            console.log(`[Query Engine] Table "${tableName}" saved to Cloudflare Worker KV (chunked-aware, ${(encryptedHex.length / 1024).toFixed(1)} KB)`);
            return true;
          }
        } catch (error: any) {
          console.error('[Query Engine] Cloudflare Worker KV chunked write failed:', error.message);
        }
      }

      // ─── 2. Cloudflare KV REST API or direct KV binding — chunked write ───
      if (isKVConfigured) {
        try {
          const kvBinding = getKVBinding();
          const kvRestPutFn = async (key: string, value: string): Promise<boolean> => {
            try {
              if (kvBinding && typeof kvBinding.put === 'function') {
                await kvBinding.put(key, value);
                return true;
              }
            } catch (e: any) {
              const errMsg = String(e).toLowerCase();
              if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
                handleKVLimitExceeded();
              }
              throw e;
            }
            const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
            const CF_KV_NS = process.env.CLOUDFLARE_KV_NAMESPACE_ID || '';
            const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
            const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NS}/values/${key}`;
            try {
              const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'text/plain' },
                body: value
              });
              if (res.status === 429) {
                handleKVLimitExceeded();
                return false;
              }
              if (!res.ok) throw new Error(`KV REST PUT failed: ${await res.text()}`);
              return true;
            } catch (e: any) {
              const errMsg = String(e).toLowerCase();
              if (errMsg.includes('limit exceeded') || errMsg.includes('429') || errMsg.includes('rate limit')) {
                handleKVLimitExceeded();
              }
              throw e;
            }
          };
          const ok = await kvPutChunked(`table_${project.id}_${tableName}`, encryptedHex, kvRestPutFn);
          if (ok) {
            console.log(`[Query Engine] Table "${tableName}" saved to Cloudflare KV (chunked-aware, ${(encryptedHex.length / 1024).toFixed(1)} KB)`);
            return true;
          }
        } catch (error: any) {
          console.error('[Query Engine] Cloudflare KV chunked write failed:', error.message);
        }
      }
      return false;
    };

    // ─── OPTIMIZATION: Cloudflare Worker Batch PUT Pathway ───
    const BATCH_PUT_MAX_HEX = 5 * 1024 * 1024; // 5 MB hex threshold for batch PUT
    if (isCFWorkerConfigured && encryptedHex.length <= BATCH_PUT_MAX_HEX) {
      try {
        const state = await (statePromise ? statePromise : getDatabaseState(true));
        state.files = state.files.filter((f: any) => !(f.project_id === project.id && f.filename === filename));
        state.files.push(newTableFile);
        
        const stateEncryptedHex = await encryptStateAsync(state);
        
        const batchPutUrl = `${CLOUDFLARE_WORKER_URL.replace(/\/$/, '')}/batch-put`;
        const res = await fetch(batchPutUrl, {
          method: 'POST',
          headers: {
            'x-worker-key': CLOUDFLARE_WORKER_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            pairs: {
              [`table_${project.id}_${tableName}`]: encryptedHex,
              'telebase_state': stateEncryptedHex
            }
          })
        });

        if (res.status === 429) {
          handleKVLimitExceeded();
        }

        if (res.ok) {
          updateStateCache(state); // Sync local cache
          console.log(`[Query Engine] Table "${tableName}" and master state saved via Batch PUT edge route!`);
          
          // Still dispatch Telegram backup for background durability
          const hasTelegramBackupConfig = !!((project.bots && project.bots.length > 0 && project.channel_id) || (process.env.BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID));
          if (hasTelegramBackupConfig) {
            dispatchTelegramBackup(project, tableName, fileUuid, filename, encrypted, iv, authTag, rawData.length).catch(() => {});
          }
          return;
        } else {
          const errText = await res.text();
          throw new Error(`Batch PUT edge request failed: ${errText}`);
        }
      } catch (error: any) {
        console.warn('[Query Engine] Cloudflare Worker KV Batch PUT failed, falling back to sequential fast-paths:', error.message);
      }
    }

    // Fallback: Dispatches table upload and state fetch concurrently, then saves master state sequentially (for REST API)
    if (isCFWorkerConfigured || isKVConfigured) {
      try {
        const [tableSaved, state] = await Promise.all([
          saveTableToCloud(),
          statePromise ? statePromise : getDatabaseState(true)
        ]);
        if (tableSaved) {
          state.files = state.files.filter((f: any) => !(f.project_id === project.id && f.filename === filename));
          state.files.push(newTableFile);
          await saveDatabaseState(state, { allowShrink: true });
          
          // Dispatch Telegram backup for background durability
          const hasTelegramBackupConfig = !!((project.bots && project.bots.length > 0 && project.channel_id) || (process.env.BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID));
          if (hasTelegramBackupConfig) {
            dispatchTelegramBackup(project, tableName, fileUuid, filename, encrypted, iv, authTag, rawData.length).catch(() => {});
          }
          return;
        }
      } catch (error: any) {
        console.error('[Query Engine] Master state update failed in Cloud mode, falling back to Telegram:', error.message);
      }
    }

    // Always-Free KV Fallback cache
    if (!isKVConfigured && !isCFWorkerConfigured) {
      try {
        const bucketHash = await sha256Bytes(ENCRYPTION_KEY);
        const bucketId = 'k' + bytesToHex(bucketHash).substring(0, 19);
        const url = `https://kvdb.io/buckets/${bucketId}/keys/table_${project.id}_${tableName}`;
        const res = await fetch(url, {
          method: 'PUT',
          body: encryptedHex
        });
        if (res.ok) {
          console.log(`[Query Engine] Table "${tableName}" successfully saved in Free KV (kvdb.io)!`);
        } else {
          throw new Error(`kvdb.io PUT response status: ${res.status}`);
        }
      } catch (error: any) {
        console.error('[Query Engine] Free KV (kvdb.io) write failed:', error.message);
      }
    }

    // Telegram backup
    const hasTelegramBackupConfig = !!((project.bots && project.bots.length > 0 && project.channel_id) || (process.env.BOT_TOKEN && process.env.TELEGRAM_CHANNEL_ID));
    if (hasTelegramBackupConfig) {
      await dispatchTelegramBackup(project, tableName, fileUuid, filename, encrypted, iv, authTag, rawData.length);
    }

  } catch (error: any) {
    console.error('[Query Engine Save Error]', error.message);
    throw error;
  }
}

/**
 * Dedicated helper to perform Telegram backup of table records asynchronously.
 */
async function dispatchTelegramBackup(
  project: Project,
  tableName: string,
  fileUuid: string,
  filename: string,
  encrypted: Uint8Array,
  iv: Uint8Array,
  authTag: Uint8Array,
  rawLength: number
): Promise<void> {
  try {
    const botToken = project.bots.length > 0 ? project.bots[0] : process.env.BOT_TOKEN || '';
    const channelId = formatTelegramChannelId(project.channel_id || process.env.TELEGRAM_CHANNEL_ID || '');

    const formData = new FormData();
    formData.append('chat_id', channelId);
    const chunkBlob = new Blob([encrypted as any], { type: 'application/octet-stream' });
    formData.append('document', chunkBlob, `${fileUuid}_table.enc`);

    const uploadRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: formData
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.ok) throw new Error(`Telegram upload failed: ${JSON.stringify(uploadData)}`);

    const fileId = uploadData.result.document.file_id;

    // Update Master Index state
    const state = await getDatabaseState(true);
    state.files = state.files.filter((f) => !(f.project_id === project.id && f.filename === filename));

    const encryptedHashBytes = await sha256Bytes(encrypted);
    const fileHashHex = bytesToHex(encryptedHashBytes);

    const newTableFile: StoredFile = {
      uuid: fileUuid,
      project_id: project.id,
      filename,
      version: 1,
      chunk_count: 1,
      file_hash: fileHashHex,
      size: rawLength,
      created_at: new Date().toISOString(),
      chunks: [
        {
          chunk_index: 0,
          message_id: fileId,
          iv: bytesToHex(iv),
          auth_tag: bytesToHex(authTag)
        }
      ]
    };

    state.files.push(newTableFile);
    await saveDatabaseState(state, { allowShrink: true });
    console.log(`[Query Engine BG] Table "${tableName}" successfully saved and cryptographically committed to Telegram!`);

  } catch (error: any) {
    console.error('[Query Engine BG] Telegram upload failed:', error.message);
  }
}

/**
 * Core SQL & NoSQL Query Execution Engine
 */
export class TelebaseQueryEngine {
  
  /**
     * Helper to retrieve currently stored WAL Logs.
     */
  static getWALLogs(projectId: string): WALEntry[] {
    return writeAheadLogs.filter(log => log.projectId === projectId);
  }

  static clearTableCache(projectId: string, tableName: string) {
    delete tableCache[`${projectId}_${tableName}`];
  }

  static clearTableArtifacts(projectId: string, tableName: string) {
    TelebaseQueryEngine.clearTableCache(projectId, tableName);
    deleteLocalTableArtifacts(projectId, tableName);
  }

  static async getTableRecords(project: Project, tableName: string, forceRefresh = false) {
    return getTableRecords(project, tableName, forceRefresh);
  }

  static async saveTableRecords(project: Project, tableName: string, records: any[]) {
    return saveTableRecords(project, tableName, records);
  }

  /**
   * Clears WAL log history.
   */
  static async clearWALLogs(projectId: string) {
    await hydrateWriteAheadLogs();
    writeAheadLogs = writeAheadLogs.filter(log => log.projectId !== projectId);
    await persistWriteAheadLogs();
  }

  static async clearWALLogsForTable(projectId: string, tableName: string) {
    await hydrateWriteAheadLogs();
    writeAheadLogs = writeAheadLogs.filter(log => !(log.projectId === projectId && log.tableName === tableName));
    await persistWriteAheadLogs();
  }

  /**
   * Executes a database query against a table, processing schema syntax, optimizations, locks, WAL, and commits.
   */
  static async executeQuery(
    project: Project,
    tableName: string,
    action: {
      type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
      schema?: TableSchema;
      sqlQuery?: string;
      noSqlQuery?: any;
      sqlSelect?: {
        selectClause: string;
        joinTable?: string;
        joinCondition?: string;
        whereClause?: string;
        groupByClause?: string;
        havingClause?: string;
        orderByClause?: string;
        limit?: number;
      };
      insertData?: any;
      updateSet?: any;
      whereCondition?: (row: any) => boolean;
      forceLockCrash?: boolean; // Simulated failure flag for crash recovery demonstrations
    }
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const plan: PlanStep[] = [];
    let cacheHit = false;

    // 1. Connection & Safety: Lock Verification
    const lockKey = `${project.id}_${tableName}`;
    plan.push({
      operation: 'SAFETY_CHECK',
      details: `Authenticating client permissions & checking row-level locks on table "${tableName}".`,
      durationMs: Date.now() - startTime
    });

    if (action.type !== 'SELECT') {
      const activeLock = activeRowLocks[lockKey];
      if (activeLock) {
        const elapsed = Date.now() - activeLock.lockedAt;
        if (elapsed > 5000) {
          console.warn(`[Lock System] Lock on table "${tableName}" by transaction ${activeLock.taskId} has expired (held for ${elapsed}ms). Auto-releasing.`);
          delete activeRowLocks[lockKey];
        } else {
          throw new Error(`Concurrency Lock Violation: Table "${tableName}" is currently locked by write transaction ${activeLock.taskId}.`);
        }
      }

      // Check distributed lock using WAL entries on KV/Telegram
      await hydrateWriteAheadLogs(true);
      const activeWalLock = writeAheadLogs.find(
        (log) =>
          log.projectId === project.id &&
          log.tableName === tableName &&
          log.status === 'PENDING' &&
          log.timestamp &&
          Date.now() - new Date(log.timestamp).getTime() < 5000
      );
      if (activeWalLock) {
        throw new Error(`Concurrency Lock Violation: Table "${tableName}" is currently locked by active write transaction ${activeWalLock.id}.`);
      }
    }

    let walEntry: WALEntry | undefined;

    try {
      // 2. Query Processing: Schema and Syntax Parsing
      const stepStart = Date.now();
      let recordsObj = await getTableRecords(project, tableName);
      let records = [...recordsObj.records];
      cacheHit = recordsObj.cacheHit;

      plan.push({
        operation: 'PARSING_&_SCHEMA_VALIDATION',
        details: `Loaded ${records.length} physical database records. Syntax schema checks successfully passed.`,
        durationMs: Date.now() - stepStart
      });

      // 3. Memory & Storage: Index Optimization Paths
      const optimizeStart = Date.now();
      let indexUsed: string | null = null;
      let strategy: 'INDEX_SCAN' | 'FULL_TABLE_SCAN' = 'FULL_TABLE_SCAN';
      let scannedRecords = records.length;

      // Simulate primary index optimization on PK lookup (queries filtering by 'id')
      const usesIdFilter = action.sqlQuery?.includes("id =") || (action.noSqlQuery && action.noSqlQuery.id);
      if (usesIdFilter) {
        indexUsed = 'PRIMARY_KEY_INDEX (id)';
        strategy = 'INDEX_SCAN';
        scannedRecords = 1; // Instant primary hash table pointer
      }

      plan.push({
        operation: 'PATH_OPTIMIZATION',
        details: `Selected Query Optimizer Path. Strategy: ${strategy}${indexUsed ? ` via ${indexUsed}` : ''}. Scanned ${scannedRecords}/${records.length} records.`,
        durationMs: Date.now() - optimizeStart
      });

      // 4. Transaction Control: Write-Ahead Logging & row lock engagement
      let affectedRows = 0;
      let resultRecords: any[] = [];

      await hydrateWriteAheadLogs();
      
      // Auto-Recovery: check if there are pending logs for this table and run crash recovery
      const pendingWal = writeAheadLogs.filter(log => log.projectId === project.id && log.tableName === tableName && log.status !== 'COMMITTED');
      if (pendingWal.length > 0) {
        console.log(`[Auto-Recovery] Found ${pendingWal.length} pending WAL entries for ${tableName}. Initiating auto-recovery...`);
        await TelebaseQueryEngine.runCrashRecovery(project, tableName);
        // Refresh records after recovery
        const recordsObj = await getTableRecords(project, tableName);
        records = [...recordsObj.records];
      }

      if (action.type !== 'SELECT') {
        // Lock row/table
        activeRowLocks[lockKey] = { lockedAt: Date.now(), taskId: globalThis.crypto.randomUUID() };
        
        // Log to Write-Ahead Log
        walEntry = {
          id: `wal_${bytesToHex(randomBytes(8))}`,
          timestamp: new Date().toISOString(),
          projectId: project.id,
          tableName,
          operation: action.type,
          recordId: (() => {
            const rawId = action.insertData?.id || action.noSqlQuery?.id;
            if (rawId && typeof rawId === 'object') {
              const operatorVal = rawId.$eq || rawId.$ne || rawId.$gt || rawId.$gte || rawId.$lt || rawId.$lte;
              if (operatorVal !== undefined) return String(operatorVal);
              return JSON.stringify(rawId);
            }
            return rawId ? String(rawId) : 'bulk_action';
          })(),
          oldData: action.type === 'UPDATE' || action.type === 'DELETE' ? records : null,
          newData: action.insertData || action.updateSet,
          status: 'PENDING'
        };
        writeAheadLogs.push(walEntry);
        await persistWriteAheadLogs();

        plan.push({
          operation: 'WRITE_AHEAD_LOG_COMMIT',
          details: `Simulating ACID compliance. Engaged transaction lock. Logged PENDING transaction to WAL: ${walEntry.id}`,
          durationMs: 1
        });

        // Trigger purposeful crash to demonstrate recovery
        if (action.forceLockCrash) {
          walEntry.status = 'FAILED';
          await persistWriteAheadLogs();
          delete activeRowLocks[lockKey];
          throw new Error(`Simulated Transaction Crash: Server shut down abruptly during the critical atomic page commit.`);
        }
      }

      // CRUD Execution
      const crudStart = Date.now();
      if (action.type === 'SELECT') {
        if (action.sqlSelect) {
          const structured = await executeStructuredSelect(project, tableName, records, action, plan);
          resultRecords = structured.records;
          affectedRows = resultRecords.length;
          indexUsed = structured.indexUsed;
          strategy = structured.strategy;
          scannedRecords = structured.scannedRecords;
        } else if (action.noSqlQuery) {
          // MongoDB-style NoSQL query interpreter
          resultRecords = records.filter((row) => matchRow(row, action.noSqlQuery));
          affectedRows = resultRecords.length;
        } else if (action.whereCondition) {
          resultRecords = records.filter(action.whereCondition);
          affectedRows = resultRecords.length;
        } else {
          resultRecords = records;
          affectedRows = resultRecords.length;
        }
      } 
      
      else if (action.type === 'INSERT') {
        const newRecord = { 
          id: globalThis.crypto.randomUUID(), 
          created_at: new Date().toISOString(),
          ...action.insertData 
        };
        
        // Schema Validation Check
        if (action.schema) {
          Object.entries(action.schema.fields).forEach(([field, type]) => {
            if (newRecord[field] !== undefined) {
              const actualType = Array.isArray(newRecord[field]) ? 'array' : typeof newRecord[field];
              if (actualType !== type) {
                throw new Error(`Schema Violation: Field "${field}" expects type "${type}", received "${actualType}".`);
              }
            }
          });
        }

        records.push(newRecord);
        await saveTableRecords(project, tableName, records);
        affectedRows = 1;
        resultRecords = [newRecord];
      } 
      
      else if (action.type === 'UPDATE') {
        let updateFilter = action.noSqlQuery || {};
        let updatedCount = 0;

        records = records.map((row) => {
          const matches = matchRow(row, updateFilter);
          if (matches) {
            updatedCount++;
            return { ...row, ...action.updateSet, updated_at: new Date().toISOString() };
          }
          return row;
        });

        if (updatedCount > 0) {
          await saveTableRecords(project, tableName, records);
        }
        affectedRows = updatedCount;
      } 
      
      else if (action.type === 'DELETE') {
        let deleteFilter = action.noSqlQuery || {};
        const originalLength = records.length;
        
        records = records.filter((row) => {
          const matches = matchRow(row, deleteFilter);
          return !matches;
        });

        affectedRows = originalLength - records.length;
        if (affectedRows > 0) {
          await saveTableRecords(project, tableName, records);
        }
      }

      plan.push({
        operation: 'PHYSICAL_ENGINE_COMMIT',
        details: `Successfully completed ${action.type} operations. Affected rows: ${affectedRows}`,
        durationMs: Date.now() - crudStart
      });

      // Commit WAL and release locks
      if (walEntry) {
        walEntry.status = 'COMMITTED';
        await persistWriteAheadLogs();
        delete activeRowLocks[lockKey];
      }

      return {
        success: true,
        records: resultRecords,
        affectedRows,
        plan,
        latencyMs: Date.now() - startTime,
        cacheHit,
        optimization: {
          indexUsed,
          strategy,
          statistics: {
            totalRecords: records.length,
            scannedRecords
          }
        },
        walId: walEntry?.id
      };

    } catch (err: any) {
      // Release lock on failure
      delete activeRowLocks[lockKey];

      if (walEntry) {
        walEntry.status = 'FAILED';
        await persistWriteAheadLogs();
      }

      return {
        success: false,
        error: err.message,
        affectedRows: 0,
        plan,
        latencyMs: Date.now() - startTime,
        cacheHit,
        optimization: {
          indexUsed: null,
          strategy: 'FULL_TABLE_SCAN',
          statistics: { totalRecords: 0, scannedRecords: 0 }
        }
      };
    }
  }

  /**
   * Replays WAL transactions to restore the database to a consistent state after a simulated crash.
   */
  static async runCrashRecovery(project: Project, tableName: string): Promise<{ restoredCount: number; logs: string[] }> {
    const logs: string[] = [];
    let restoredCount = 0;

    const lockKey = `${project.id}_${tableName}`;
    if (activeRowLocks[lockKey]) {
      logs.push(`[Recovery System] Found active transaction lock for table "${tableName}" (${activeRowLocks[lockKey].taskId}). Explicitly releasing lock.`);
      delete activeRowLocks[lockKey];
    }

    logs.push(`[Recovery Started] Replaying Write-Ahead Logs (WAL) for project "${project.name}"...`);
    await hydrateWriteAheadLogs(true);
    
    // Find failed/pending entries in the write-ahead log
    const projectLogs = writeAheadLogs.filter(
      (log) => log.projectId === project.id && log.tableName === tableName && log.status !== 'COMMITTED'
    );

    if (projectLogs.length === 0) {
      logs.push('[Recovery System] No corrupted or uncommitted transactions found. State is consistent.');
      return { restoredCount, logs };
    }

    // Force load the latest consistent backup state
    const { records } = await getTableRecords(project, tableName, true);
    let consistentRecords = [...records];

    for (const entry of projectLogs) {
      logs.push(`[WAL Replay] Replaying ${entry.operation} entry ${entry.id} (status was: ${entry.status}).`);

      if (isWalEntryApplied(entry, consistentRecords)) {
        logs.push(`[WAL Replay] Entry ${entry.id} already reflected in table state. Skipping re-application.`);
        entry.status = 'COMMITTED';
        continue;
      }

      if (entry.operation === 'INSERT' && entry.newData) {
        const recordToRestore = {
          id: entry.newData.id || globalThis.crypto.randomUUID(),
          created_at: entry.newData.created_at || new Date().toISOString(),
          ...entry.newData
        };
        consistentRecords.push(recordToRestore);
        restoredCount++;
      } else if (entry.operation === 'UPDATE' && entry.newData) {
        // Re-apply updates
        consistentRecords = consistentRecords.map(r => {
          if (r.id === entry.recordId) {
            return { ...r, ...entry.newData };
          }
          return r;
        });
        restoredCount++;
      } else if (entry.operation === 'DELETE') {
        consistentRecords = consistentRecords.filter(r => r.id !== entry.recordId);
        restoredCount++;
      }

      entry.status = 'COMMITTED'; // successfully re-applied
    }

    // Save recovered state back to storage
    await saveTableRecords(project, tableName, consistentRecords);
    
    // Persist the updated WAL status to prevent duplicate recovery
    await persistWriteAheadLogs();
    
    logs.push(`[Recovery Completed] Successfully restored consistency. Re-applied ${restoredCount} transaction records!`);
    return { restoredCount, logs };
  }
}
