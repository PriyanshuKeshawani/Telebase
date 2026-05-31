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
    // Find matching operator. Supported: >=, <=, !=, <>, =, >, <
    const opMatch = part.match(/(.*?)(>=|<=|!=|<>|=|>|<)(.*)/);
    if (opMatch) {
      const key = opMatch[1].trim();
      const op = opMatch[2].trim();
      const rawVal = opMatch[3].trim();
      const cleanedVal = rawVal.replace(/['"]/g, '');
      
      const val = isNaN(Number(cleanedVal)) 
        ? (cleanedVal === 'true' ? true : cleanedVal === 'false' ? false : cleanedVal) 
        : Number(cleanedVal);

      let mongoOp = '$eq';
      if (op === '=') mongoOp = '$eq';
      else if (op === '!=') mongoOp = '$ne';
      else if (op === '<>') mongoOp = '$ne';
      else if (op === '>') mongoOp = '$gt';
      else if (op === '>=') mongoOp = '$gte';
      else if (op === '<') mongoOp = '$lt';
      else if (op === '<=') mongoOp = '$lte';

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
      const vals: string[] = [];
      let current = '';
      let inQuotes: string | null = null;
      for (let i = 0; i < valsStr.length; i++) {
        const char = valsStr[i];
        if (char === "'" || char === '"') {
          if (inQuotes === char) {
            inQuotes = null;
          } else if (inQuotes === null) {
            inQuotes = char;
          } else {
            current += char;
          }
        } else if (char === ',' && !inQuotes) {
          vals.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      vals.push(current.trim());

      keys.forEach((key, idx) => {
        const val = vals[idx];
        if (val !== undefined) {
          insertData[key] = isNaN(Number(val)) 
            ? (val === 'true' ? true : val === 'false' ? false : val) 
            : Number(val);
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
      const sets: string[] = [];
      let current = '';
      let inQuotes: string | null = null;
      for (let i = 0; i < setsStr.length; i++) {
        const char = setsStr[i];
        if (char === "'" || char === '"') {
          if (inQuotes === char) {
            inQuotes = null;
          } else if (inQuotes === null) {
            inQuotes = char;
          } else {
            current += char;
          }
        } else if (char === ',' && !inQuotes) {
          sets.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      sets.push(current.trim());

      sets.forEach(s => {
        const eqIdx = s.indexOf('=');
        if (eqIdx !== -1) {
          const k = s.slice(0, eqIdx).trim();
          const v = s.slice(eqIdx + 1).trim();
          updateSet[k] = isNaN(Number(v)) ? (v === 'true' ? true : v === 'false' ? false : v) : Number(v);
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

    const state = await getDatabaseState();
    
    // Get list of tables matching this project
    const tablePrefix = `table_${project.id}_`;
    const tables = state.files
      .filter(f => f.project_id === project.id && f.filename.startsWith(tablePrefix))
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

      // Initialize table with empty array
      await TelebaseQueryEngine.executeQuery(project, tableName, {
        type: 'INSERT',
        insertData: { id: 'schema_init_anchor', __schema_init: true }, // dummy initial row
        schema
      });

      // Clear the dummy row immediately, committing the empty table page to Telegram/KV
      await TelebaseQueryEngine.executeQuery(project, tableName, {
        type: 'DELETE',
        noSqlQuery: { __schema_init: true }
      });

      // Persist the schema in master index state
      if (!state.schemas) {
        state.schemas = {};
      }
      const schemaKey = `${project.id}_${tableName}`;
      state.schemas[schemaKey] = schema;
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

      await saveDatabaseState(state);
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
      await saveDatabaseState(state);
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

    const state = await getDatabaseState();
    const schemaKey = `${project.id}_${tableName}`;
    const tableSchema = state.schemas?.[schemaKey];

    const result = await TelebaseQueryEngine.executeQuery(project, tableName, {
      ...queryAction,
      schema: tableSchema
    });
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[API Database Error]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
