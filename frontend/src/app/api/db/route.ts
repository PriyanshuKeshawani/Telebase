import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectApiKey, getDatabaseState, saveDatabaseState } from '@/lib/telegramDatabase';
import { TelebaseQueryEngine, WALEntry } from '@/lib/telebaseQueryEngine';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Robust SQL syntax parsing parser
 */
function parseWhereClause(whereStr: string): Record<string, any> {
  const noSqlQuery: Record<string, any> = {};
  if (!whereStr) return noSqlQuery;

  // Split by AND (case-insensitive)
  const parts = whereStr.split(/\s+AND\s+/i);
  parts.forEach(part => {
    // Find matching operator. Supported: >=, <=, !=, <>, =, >, <, LIKE
    const opMatch = part.match(/(.*?)(>=|<=|!=|<>|=|>|<|\s+LIKE\s+)(.*)/i);
    if (opMatch) {
      const key = opMatch[1].trim();
      const op = opMatch[2].trim().toUpperCase();
      const rawVal = opMatch[3].trim();
      
      const isQuoted = (rawVal.startsWith("'") && rawVal.endsWith("'")) || 
                       (rawVal.startsWith('"') && rawVal.endsWith('"'));
      const cleanedVal = isQuoted ? rawVal.slice(1, -1) : rawVal;
      
      let val: any;
      if (isQuoted) {
        val = cleanedVal === 'true' ? true : cleanedVal === 'false' ? false : cleanedVal;
      } else {
        if (cleanedVal.toLowerCase() === 'null') {
          val = null;
        } else if (cleanedVal.toLowerCase() === 'true') {
          val = true;
        } else if (cleanedVal.toLowerCase() === 'false') {
          val = false;
        } else if (!isNaN(Number(cleanedVal)) && cleanedVal !== '') {
          val = Number(cleanedVal);
        } else {
          val = cleanedVal;
        }
      }

      let mongoOp = '$eq';
      if (op === '=') mongoOp = '$eq';
      else if (op === '!=') mongoOp = '$ne';
      else if (op === '<>') mongoOp = '$ne';
      else if (op === '>') mongoOp = '$gt';
      else if (op === '>=') mongoOp = '$gte';
      else if (op === '<') mongoOp = '$lt';
      else if (op === '<=') mongoOp = '$lte';
      else if (op === 'LIKE') {
        mongoOp = '$regex';
        // Convert SQL LIKE pattern (%abc% -> abc, %abc -> abc$, abc% -> ^abc) to RegExp string
        let pattern = cleanedVal;
        // Escape special regex characters except % and _
        pattern = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Convert % to .* and _ to .
        pattern = pattern.replace(/%/g, '.*').replace(/_/g, '.');
        // If it doesn't start with %, match start of string
        if (!cleanedVal.startsWith('%')) {
          pattern = '^' + pattern;
        }
        // If it doesn't end with %, match end of string
        if (!cleanedVal.endsWith('%')) {
          pattern = pattern + '$';
        }
        val = pattern;
      }

      noSqlQuery[key] = { [mongoOp]: val };
    }
  });
  return noSqlQuery;
}

/**
 * Robust SQL syntax parsing parser
 */
function parseSQL(sql: string): {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  noSqlQuery?: any;
  insertData?: any;
  updateSet?: any;
} {
  // Strip single-line comments (-- style)
  let sqlWithoutComments = sql.replace(/--.*$/gm, '');
  // Strip multi-line comments (/* style)
  sqlWithoutComments = sqlWithoutComments.replace(/\/\*[\s\S]*?\*\//g, '');
  
  let cleanSql = sqlWithoutComments.trim();
  // Strip trailing semicolons
  cleanSql = cleanSql.replace(/;+$/, '').trim();
  cleanSql = cleanSql.replace(/\s+/g, ' ');
  
  // Split by WHERE case-insensitively
  const whereMatch = cleanSql.match(/(.*?)\s+WHERE\s+(.+)/i);
  const queryBeforeWhere = whereMatch ? whereMatch[1] : cleanSql;
  const whereClauseStr = whereMatch ? whereMatch[2] : '';
  
  const noSqlQuery = whereClauseStr ? parseWhereClause(whereClauseStr) : {};

  if (cleanSql.toUpperCase().startsWith('SELECT')) {
    return { type: 'SELECT', noSqlQuery };
  }
  
  if (cleanSql.toUpperCase().startsWith('INSERT')) {
    // e.g. INSERT INTO users (name, age, email, is_active) VALUES ('Alice Smith', 30, 'alice@example.com', 'true')
    const match = cleanSql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    const insertData: Record<string, any> = {};
    if (match) {
      const keys = match[1].split(',').map(s => s.trim());
      const valsStr = match[2].trim();
      const vals: { value: string; wasQuoted: boolean }[] = [];
      let current = '';
      let inQuotes: string | null = null;
      let wasQuoted = false;
      for (let i = 0; i < valsStr.length; i++) {
        const char = valsStr[i];
        if (char === "'" || char === '"') {
          if (inQuotes === char) {
            inQuotes = null;
            wasQuoted = true;
          } else if (inQuotes === null) {
            inQuotes = char;
          } else {
            current += char;
          }
        } else if (char === ',' && !inQuotes) {
          vals.push({ value: current.trim(), wasQuoted });
          current = '';
          wasQuoted = false;
        } else {
          current += char;
        }
      }
      vals.push({ value: current.trim(), wasQuoted });

      keys.forEach((key, idx) => {
        const item = vals[idx];
        if (item !== undefined) {
          const { value: val, wasQuoted } = item;
          if (wasQuoted) {
            insertData[key] = val === 'true' ? true : val === 'false' ? false : val;
          } else {
            if (val.toLowerCase() === 'null') {
              insertData[key] = null;
            } else if (val.toLowerCase() === 'true') {
              insertData[key] = true;
            } else if (val.toLowerCase() === 'false') {
              insertData[key] = false;
            } else if (!isNaN(Number(val)) && val !== '') {
              insertData[key] = Number(val);
            } else {
              insertData[key] = val;
            }
          }
        }
      });
    }
    return { type: 'INSERT', insertData };
  }
  
  if (cleanSql.toUpperCase().startsWith('UPDATE')) {
    // e.g. UPDATE users SET age = 31 WHERE name = Alice Smith
    // queryBeforeWhere is UPDATE users SET age = 31
    const match = queryBeforeWhere.match(/UPDATE\s+\w+\s+SET\s+(.+)/i);
    const updateSet: Record<string, any> = {};
    if (match) {
      const setsStr = match[1].trim();
      const sets: { value: string; wasQuoted: boolean }[] = [];
      let current = '';
      let inQuotes: string | null = null;
      let wasQuoted = false;
      for (let i = 0; i < setsStr.length; i++) {
        const char = setsStr[i];
        if (char === "'" || char === '"') {
          if (inQuotes === char) {
            inQuotes = null;
            wasQuoted = true;
          } else if (inQuotes === null) {
            inQuotes = char;
          } else {
            current += char;
          }
        } else if (char === ',' && !inQuotes) {
          sets.push({ value: current.trim(), wasQuoted });
          current = '';
          wasQuoted = false;
        } else {
          current += char;
        }
      }
      sets.push({ value: current.trim(), wasQuoted });

      sets.forEach(item => {
        const s = item.value;
        const eqIdx = s.indexOf('=');
        if (eqIdx !== -1) {
          const k = s.slice(0, eqIdx).trim();
          const v = s.slice(eqIdx + 1).trim();
          if (item.wasQuoted) {
            updateSet[k] = v === 'true' ? true : v === 'false' ? false : v;
          } else {
            if (v.toLowerCase() === 'null') {
              updateSet[k] = null;
            } else if (v.toLowerCase() === 'true') {
              updateSet[k] = true;
            } else if (v.toLowerCase() === 'false') {
              updateSet[k] = false;
            } else if (!isNaN(Number(v)) && v !== '') {
              updateSet[k] = Number(v);
            } else {
              updateSet[k] = v;
            }
          }
        }
      });
    }
    return { type: 'UPDATE', updateSet, noSqlQuery };
  }
  
  if (cleanSql.toUpperCase().startsWith('DELETE')) {
    return { type: 'DELETE', noSqlQuery };
  }
  
  throw new Error('Unsupported SQL statement syntax. Supported: SELECT, INSERT, UPDATE, DELETE.');
}

/**
 * GET Database Metadata: Returns table structures, schema information and Write-Ahead Logs
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const project = await verifyProjectApiKey(apiKey);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    // Always force-refresh to get the absolute latest file index from Telegram/KV
    const state = await getDatabaseState(true);
    
    // Get list of tables matching this project (exclude internal auth tables)
    const tablePrefix = `table_${project.id}_`;
    const tables = state.files
      .filter(f => 
        f.project_id === project.id && 
        f.filename.startsWith(tablePrefix) &&
        !f.filename.includes('_telebase_users') &&
        !f.filename.includes('_telebase_otps')
      )
      .map(f => {
        const tableName = f.filename.replace(tablePrefix, '').replace('.json', '');
        const schemaKey = `${project.id}_${tableName}`;
        return {
          name: tableName,
          uuid: f.uuid,
          sizeBytes: f.size,
          updatedAt: f.created_at,
          version: f.version,
          schema: state.schemas?.[schemaKey] || null
        };
      });

    // Retrieve live WAL Logs
    const walLogs = TelebaseQueryEngine.getWALLogs(project.id);

    return NextResponse.json({
      success: true,
      tables,
      walLogs
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST DB Actions: Handles query execution (SQL / NoSQL), creating tables, crash recovery and WAL operations
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const project = await verifyProjectApiKey(apiKey);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const { action, tableName, sqlQuery, noSqlQuery, insertData, updateSet, schema, forceLockCrash } = body;

    if (!tableName && action !== 'CLEAR_LOGS') {
      return NextResponse.json({ success: false, error: 'tableName parameter is required' }, { status: 400 });
    }

    // A. CLEAR WAL LOGS
    if (action === 'CLEAR_LOGS') {
      TelebaseQueryEngine.clearWALLogs(project.id);
      return NextResponse.json({ success: true, message: 'Write-Ahead Logs cleared successfully.' });
    }

    // B. RECOVER SYSTEM (WAL REPLAY)
    if (action === 'RECOVER') {
      const recoveryResult = await TelebaseQueryEngine.runCrashRecovery(project, tableName);
      return NextResponse.json({ success: true, ...recoveryResult });
    }

    // C. CREATE NEW TABLE SCHEMA
    if (action === 'CREATE_TABLE') {
      const state = await getDatabaseState(true);
      const filename = `table_${project.id}_${tableName}.json`;
      
      // Verify if table already exists in index
      const exists = state.files.some(f => f.project_id === project.id && f.filename === filename);
      if (exists) {
        return NextResponse.json({ success: false, error: `Table "${tableName}" already exists.` }, { status: 400 });
      }

      // ── SYNCHRONOUS table registration ─────────────────────────────────────
      // We directly add the file entry into state.files BEFORE any background
      // sync runs. This guarantees the dashboard sees the table immediately.
      const newFileEntry = {
        uuid: globalThis.crypto.randomUUID(),
        project_id: project.id,
        filename,
        version: 1,
        chunk_count: 1,
        file_hash: '',
        size: 0,
        created_at: new Date().toISOString(),
        chunks: [{ chunk_index: 0, message_id: '', iv: '', auth_tag: '' }]
      };
      state.files.push(newFileEntry);

      // Persist schema in master index state
      if (!state.schemas) state.schemas = {};
      const schemaKey = `${project.id}_${tableName}`;
      state.schemas[schemaKey] = schema;

      // Save state synchronously — this is what makes the table appear in dashboard
      await saveDatabaseState(state);

      return NextResponse.json({ success: true, message: `Table "${tableName}" successfully created!` });
    }

    // D. DROP TABLE
    if (action === 'DROP_TABLE') {
      const state = await getDatabaseState(true);
      const filename = `table_${project.id}_${tableName}.json`;
      
      const fileIndex = state.files.findIndex(f => f.project_id === project.id && f.filename === filename);
      if (fileIndex === -1) {
        return NextResponse.json({ success: false, error: `Table "${tableName}" does not exist.` }, { status: 404 });
      }

      // Remove from state files
      state.files.splice(fileIndex, 1);

      // Remove from schemas
      if (state.schemas) {
        const schemaKey = `${project.id}_${tableName}`;
        delete state.schemas[schemaKey];
      }

      await saveDatabaseState(state, { allowShrink: true });
      return NextResponse.json({ success: true, message: `Table "${tableName}" successfully deleted!` });
    }

    // E. UPDATE TABLE SCHEMA (ADD/DELETE/RENAME COLUMNS)
    if (action === 'UPDATE_SCHEMA') {
      const state = await getDatabaseState(true);
      const schemaKey = `${project.id}_${tableName}`;
      
      if (!state.schemas) {
        state.schemas = {};
      }

      state.schemas[schemaKey] = schema;
      await saveDatabaseState(state, { allowShrink: true });
      return NextResponse.json({ success: true, message: `Table "${tableName}" schema updated successfully!` });
    }

    // D. RUN DATABASE QUERIES (SQL or NoSQL)
    let queryAction: any = {};
    if (sqlQuery) {
      // Parse SQL query string into action specs
      const parsed = parseSQL(sqlQuery);
      queryAction = {
        type: parsed.type,
        noSqlQuery: parsed.noSqlQuery,
        insertData: parsed.insertData,
        updateSet: parsed.updateSet,
        forceLockCrash
      };
    } else {
      // NoSQL Direct Query Execution
      queryAction = {
        type: action, // SELECT, INSERT, UPDATE, DELETE
        noSqlQuery,
        insertData,
        updateSet,
        forceLockCrash
      };
    }

    // Force-refresh state so SQL and NoSQL always see the same committed data
    const state = await getDatabaseState(true);
    const schemaKey = `${project.id}_${tableName}`;
    const tableSchema = state.schemas?.[schemaKey];

    const result = await TelebaseQueryEngine.executeQuery(project, tableName, {
      ...queryAction,
      schema: tableSchema
    });

    // After any write, return the latest full record set so the explorer
    // can immediately reflect the change without an extra round-trip
    if (['INSERT', 'UPDATE', 'DELETE'].includes(queryAction.type) && result.success) {
      const latest = await TelebaseQueryEngine.executeQuery(project, tableName, {
        type: 'SELECT',
        noSqlQuery: {}
      });
      return NextResponse.json({ ...result, latestRecords: latest.records || [] });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[API Database Error]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
