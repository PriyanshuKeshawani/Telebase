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

const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function validateSqlIdentifier(value: string, label: string): string {
  const trimmed = value.trim();
  if (!SQL_IDENTIFIER_RE.test(trimmed)) {
    throw new Error(`Invalid ${label}: "${value}". Only alphanumeric and underscore identifiers are supported.`);
  }
  return trimmed;
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
      if (char === quote) {
        quote = null;
      }
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

function peelTrailingClause(source: string, keyword: string): { source: string; value: string | null } {
  const upperSource = source.toUpperCase();
  const upperKeyword = keyword.toUpperCase();
  const keywordPos = upperSource.lastIndexOf(` ${upperKeyword} `);
  if (keywordPos === -1) {
    if (upperSource.startsWith(`${upperKeyword} `)) {
      return { source: '', value: source.slice(upperKeyword.length).trim() };
    }
    return { source, value: null };
  }

  return {
    source: source.slice(0, keywordPos).trim(),
    value: source.slice(keywordPos + upperKeyword.length + 2).trim()
  };
}

function parseOrderByClause(orderClause: string | null | undefined): { column: string; direction: 'ASC' | 'DESC' }[] {
  if (!orderClause) return [];
  return splitSqlList(orderClause).map((part) => {
    const match = part.match(/^(.+?)(?:\s+(ASC|DESC))?$/i);
    if (!match) {
      throw new Error(`Invalid ORDER BY expression: "${part}"`);
    }
    return {
      column: match[1].trim(),
      direction: (match[2] ? match[2].toUpperCase() : 'ASC') as 'ASC' | 'DESC'
    };
  });
}

function parseSelectList(selectClause: string): string[] {
  const items = splitSqlList(selectClause);
  if (items.length === 0) {
    throw new Error('SELECT clause cannot be empty.');
  }
  return items;
}

/**
 * Robust SQL syntax parsing parser
 */
function parseSQL(sql: string): {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE_TABLE' | 'SHOW_TABLES' | 'DESCRIBE' | 'ALTER_TABLE_ADD' | 'DROP_TABLE' | 'ALTER_TABLE_DROP' | 'CREATE_INDEX' | 'DROP_INDEX';
  noSqlQuery?: any;
  insertData?: any;
  updateSet?: any;
  tableName?: string;
  schema?: any;
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
} {
  // Strip single-line comments (-- style)
  let sqlWithoutComments = sql.replace(/--.*$/gm, '');
  // Strip multi-line comments (/* style)
  sqlWithoutComments = sqlWithoutComments.replace(/\/\*[\s\S]*?\*\//g, '');
  
  let cleanSql = sqlWithoutComments.trim();
  // Strip trailing semicolons
  cleanSql = cleanSql.replace(/;+$/, '').trim();
  cleanSql = cleanSql.replace(/\s+/g, ' ');
  const simpleWhereMatch = cleanSql.match(/(.*?)\s+WHERE\s+(.+)/i);
  const queryBeforeWhere = simpleWhereMatch ? simpleWhereMatch[1] : cleanSql;
  const whereClauseStr = simpleWhereMatch ? simpleWhereMatch[2] : '';
  const noSqlQuery = whereClauseStr ? parseWhereClause(whereClauseStr) : {};

  if (cleanSql.toUpperCase().startsWith('SELECT')) {
    const selectMatch = cleanSql.match(/^SELECT\s+(.+?)\s+FROM\s+(.+)$/i);
    if (!selectMatch) {
      throw new Error('Invalid SELECT syntax.');
    }

    const selectClause = selectMatch[1].trim();
    let fromClause = selectMatch[2].trim();

    let limit: number | undefined;
    let orderByClause: string | undefined;
    let havingClause: string | undefined;
    let groupByClause: string | undefined;
    let selectWhereClause: string | undefined;

    let result = peelTrailingClause(fromClause, 'LIMIT');
    if (result.value !== null && result.value !== '') {
      const parsedLimit = Number(result.value);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 0) {
        throw new Error(`Invalid LIMIT value: "${result.value}"`);
      }
      limit = parsedLimit;
      fromClause = result.source;
    }

    result = peelTrailingClause(fromClause, 'ORDER BY');
    if (result.value !== null) {
      orderByClause = result.value;
      fromClause = result.source;
    }

    result = peelTrailingClause(fromClause, 'HAVING');
    if (result.value !== null) {
      havingClause = result.value;
      fromClause = result.source;
    }

    result = peelTrailingClause(fromClause, 'GROUP BY');
    if (result.value !== null) {
      groupByClause = result.value;
      fromClause = result.source;
    }

    result = peelTrailingClause(fromClause, 'WHERE');
    if (result.value !== null) {
      selectWhereClause = result.value;
      fromClause = result.source;
    }

    let baseFromClause = fromClause;
    let joinTable: string | undefined;
    let joinCondition: string | undefined;

    const joinMatch = baseFromClause.match(/^(.+?)\s+INNER\s+JOIN\s+(.+?)\s+ON\s+(.+)$/i);
    if (joinMatch) {
      baseFromClause = joinMatch[1].trim();
      joinTable = validateSqlIdentifier(joinMatch[2], 'join table name');
      joinCondition = joinMatch[3].trim();
    }

    const baseTable = validateSqlIdentifier(baseFromClause, 'table name');
    const selectNoSqlQuery = selectWhereClause ? parseWhereClause(selectWhereClause) : {};

    return {
      type: 'SELECT',
      tableName: baseTable,
      noSqlQuery: selectNoSqlQuery,
      sqlSelect: {
        selectClause,
        joinTable,
        joinCondition,
        whereClause: selectWhereClause,
        groupByClause,
        havingClause,
        orderByClause,
        limit
      }
    };
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
  
  if (cleanSql.toUpperCase().startsWith('CREATE TABLE')) {
    const match = cleanSql.match(/CREATE\s+TABLE\s+(\w+)\s*\((.+)\)/i);
    if (match) {
      const tName = validateSqlIdentifier(match[1], 'table name');
      const fields: Record<string, 'string' | 'number' | 'boolean'> = {};
      match[2].split(',').forEach(col => {
        const parts = col.trim().split(/\s+/);
        if (parts.length >= 2) {
          const colName = validateSqlIdentifier(parts[0], 'column name');
          const colTypeStr = parts[1].toUpperCase();
          fields[colName] = (colTypeStr.includes('INT') || colTypeStr.includes('NUM') || colTypeStr.includes('REAL')) ? 'number' : (colTypeStr.includes('BOOL') ? 'boolean' : 'string');
        }
      });
      return { type: 'CREATE_TABLE', tableName: tName, schema: { name: tName, fields, indexes: [] } };
    }
  }

  if (cleanSql.toUpperCase().startsWith('DROP TABLE')) {
    const match = cleanSql.match(/DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+(\w+)/i);
    if (match) {
      return { type: 'DROP_TABLE', tableName: validateSqlIdentifier(match[1], 'table name') };
    }
  }

  if (cleanSql.toUpperCase().startsWith('ALTER TABLE') && /DROP\s+COLUMN/i.test(cleanSql)) {
    const match = cleanSql.match(/ALTER\s+TABLE\s+(\w+)\s+DROP\s+COLUMN\s+(\w+)/i);
    if (match) {
      return {
        type: 'ALTER_TABLE_DROP',
        tableName: validateSqlIdentifier(match[1], 'table name'),
        schema: { colName: validateSqlIdentifier(match[2], 'column name') }
      };
    }
  }

  if (cleanSql.toUpperCase().startsWith('CREATE INDEX')) {
    const match = cleanSql.match(/CREATE\s+INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(\s*(\w+)\s*\)/i);
    if (match) {
      return {
        type: 'CREATE_INDEX',
        tableName: validateSqlIdentifier(match[2], 'table name'),
        schema: {
          indexName: validateSqlIdentifier(match[1], 'index name'),
          columnName: validateSqlIdentifier(match[3], 'column name')
        }
      };
    }
  }

  if (cleanSql.toUpperCase().startsWith('DROP INDEX')) {
    const match = cleanSql.match(/DROP\s+INDEX\s+(\w+)(?:\s+ON\s+(\w+))?/i);
    if (match) {
      return {
        type: 'DROP_INDEX',
        tableName: match[2] ? validateSqlIdentifier(match[2], 'table name') : undefined,
        schema: {
          indexName: validateSqlIdentifier(match[1], 'index name')
        }
      };
    }
  }

  if (cleanSql.toUpperCase() === 'SHOW TABLES' || cleanSql.toUpperCase().startsWith('SHOW TABLES')) {
    return { type: 'SHOW_TABLES' as any };
  }

  if (cleanSql.toUpperCase().startsWith('DESCRIBE ') || cleanSql.toUpperCase().startsWith('DESC ')) {
    const parts = cleanSql.trim().split(/\s+/);
    const tName = parts[1];
    if (tName) return { type: 'DESCRIBE' as any, tableName: tName };
  }

  // ALTER TABLE users ADD COLUMN email TEXT
  const alterMatch = cleanSql.match(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\s+(\w+)/i);
  if (alterMatch) {
    const tName = validateSqlIdentifier(alterMatch[1], 'table name');
    const colName = validateSqlIdentifier(alterMatch[2], 'column name');
    const colTypeStr = alterMatch[3].toUpperCase();
    const colType: 'string' | 'number' | 'boolean' = (colTypeStr.includes('INT') || colTypeStr.includes('NUM') || colTypeStr.includes('REAL')) ? 'number' : (colTypeStr.includes('BOOL') ? 'boolean' : 'string');
    return { type: 'ALTER_TABLE_ADD' as any, tableName: tName, schema: { colName, colType } };
  }

  throw new Error('Unsupported SQL statement syntax. Supported: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, DROP TABLE, SHOW TABLES, DESCRIBE, ALTER TABLE ADD/DROP COLUMN, CREATE INDEX, DROP INDEX.');
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
    return NextResponse.json({ success: false, error: "An internal error occurred" }, { status: 500 });
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

    const isShowTables = sqlQuery && sqlQuery.trim().toUpperCase().startsWith('SHOW TABLES');
    const isSqlRequest = !!sqlQuery;

    if (!tableName && action !== 'CLEAR_LOGS' && !isShowTables && !isSqlRequest) {
      return NextResponse.json({ success: false, error: 'tableName parameter is required' }, { status: 400 });
    }

    let queryAction: any = {};

    // A. CLEAR WAL LOGS
    if (action === 'CLEAR_LOGS') {
      await TelebaseQueryEngine.clearWALLogs(project.id);
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

    if (action === 'DROP_TABLE') {
      const state = await getDatabaseState(true);
      const filename = `table_${project.id}_${tableName}.json`;

      const fileIndex = state.files.findIndex(f => f.project_id === project.id && f.filename === filename);
      if (fileIndex === -1) {
        return NextResponse.json({ success: false, error: `Table "${tableName}" does not exist.` }, { status: 404 });
      }

      state.files.splice(fileIndex, 1);
      if (state.schemas) {
        delete state.schemas[`${project.id}_${tableName}`];
      }

      await TelebaseQueryEngine.clearWALLogsForTable(project.id, tableName);
      TelebaseQueryEngine.clearTableCache(project.id, tableName);
      TelebaseQueryEngine.clearTableArtifacts(project.id, tableName);

      await saveDatabaseState(state, { allowShrink: true });
      return NextResponse.json({ success: true, message: `Table "${tableName}" successfully deleted!` });
    }

    // D. DROP TABLE
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
    if (isSqlRequest) {
      const parsed = parseSQL(sqlQuery);

      if (!tableName && parsed.tableName) {
        body.tableName = parsed.tableName;
      }

      if (parsed.type === 'SHOW_TABLES') {
        const state = await getDatabaseState(true);
        const tablePrefix = `table_${project.id}_`;
        const tables = state.files
          .filter(f => 
            f.project_id === project.id && 
            f.filename.startsWith(tablePrefix) &&
            !f.filename.includes('_telebase_users') &&
            !f.filename.includes('_telebase_otps')
          )
          .map(f => {
            const tName = f.filename.replace(tablePrefix, '').replace('.json', '');
            const schemaKey = `${project.id}_${tName}`;
            return {
              name: tName,
              uuid: f.uuid,
              sizeBytes: f.size,
              updatedAt: f.created_at,
              version: f.version,
              schema: state.schemas?.[schemaKey] || null
            };
          });
        return NextResponse.json({ success: true, tables });
      }

      if (parsed.type === 'DESCRIBE') {
        const state = await getDatabaseState(true);
        const resolvedTableName = parsed.tableName || tableName;
        const schemaKey = `${project.id}_${resolvedTableName}`;
        const tableSchema = state.schemas?.[schemaKey];
        if (!tableSchema) return NextResponse.json({ success: false, error: `Table "${resolvedTableName}" not found or has no schema.` }, { status: 404 });
        const columns = Object.entries(tableSchema.fields || {}).map(([name, type]) => ({ name, type }));
        return NextResponse.json({ success: true, table: resolvedTableName, columns });
      }

      if (parsed.type === 'ALTER_TABLE_ADD') {
        const state = await getDatabaseState(true);
        const resolvedTableName = parsed.tableName || tableName;
        const schemaKey = `${project.id}_${resolvedTableName}`;
        if (!state.schemas?.[schemaKey]) return NextResponse.json({ success: false, error: `Table "${resolvedTableName}" not found or has no schema.` }, { status: 404 });
        const { colName, colType } = parsed.schema;
        state.schemas[schemaKey].fields[colName] = colType;
        await saveDatabaseState(state, { allowShrink: true });
        return NextResponse.json({ success: true, message: `Column "${colName}" (${colType}) added to table "${resolvedTableName}".` });
      }

      if (parsed.type === 'CREATE_TABLE') {
        const state = await getDatabaseState(true);
        const resolvedTableName = parsed.tableName || tableName;
        const filename = `table_${project.id}_${resolvedTableName}.json`;
        const exists = state.files.some(f => f.project_id === project.id && f.filename === filename);
        if (exists) {
          return NextResponse.json({ success: false, error: `Table "${resolvedTableName}" already exists.` }, { status: 400 });
        }

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

        if (!state.schemas) state.schemas = {};
        const schemaKey = `${project.id}_${resolvedTableName}`;
        state.schemas[schemaKey] = parsed.schema || schema;
        TelebaseQueryEngine.clearTableCache(project.id, resolvedTableName);
        TelebaseQueryEngine.clearTableArtifacts(project.id, resolvedTableName);
        await saveDatabaseState(state);
        return NextResponse.json({ success: true, message: `Table "${resolvedTableName}" successfully created!` });
      }

      if (parsed.type === 'DROP_TABLE') {
        const state = await getDatabaseState(true);
        const resolvedTableName = parsed.tableName || tableName;
        const filename = `table_${project.id}_${resolvedTableName}.json`;
        const fileIndex = state.files.findIndex(f => f.project_id === project.id && f.filename === filename);
        if (fileIndex === -1) {
          return NextResponse.json({ success: false, error: `Table "${resolvedTableName}" does not exist.` }, { status: 404 });
        }
        state.files.splice(fileIndex, 1);
        if (state.schemas) {
          delete state.schemas[`${project.id}_${resolvedTableName}`];
        }
        await TelebaseQueryEngine.clearWALLogsForTable(project.id, resolvedTableName);
        TelebaseQueryEngine.clearTableCache(project.id, resolvedTableName);
        TelebaseQueryEngine.clearTableArtifacts(project.id, resolvedTableName);
        await saveDatabaseState(state, { allowShrink: true });
        return NextResponse.json({ success: true, message: `Table "${resolvedTableName}" successfully deleted!` });
      }

      if (parsed.type === 'ALTER_TABLE_DROP') {
        const state = await getDatabaseState(true);
        const resolvedTableName = parsed.tableName || tableName;
        const schemaKey = `${project.id}_${resolvedTableName}`;
        const tableSchema = state.schemas?.[schemaKey];
        if (!tableSchema) {
          return NextResponse.json({ success: false, error: `Table "${resolvedTableName}" not found or has no schema.` }, { status: 404 });
        }

        const colName = parsed.schema?.colName;
        if (!colName) {
          return NextResponse.json({ success: false, error: 'Column name is required.' }, { status: 400 });
        }
        if (colName === 'id' || colName === 'created_at') {
          return NextResponse.json({ success: false, error: `Column "${colName}" cannot be dropped.` }, { status: 400 });
        }
        if (!tableSchema.fields?.[colName]) {
          return NextResponse.json({ success: false, error: `Column "${colName}" does not exist on table "${resolvedTableName}".` }, { status: 404 });
        }

        const originalSchema = JSON.parse(JSON.stringify(tableSchema));
        const { records } = await TelebaseQueryEngine.getTableRecords(project, resolvedTableName, true);
        const originalRecords = records.map((record: any) => ({ ...record }));
        const updatedRecords = records.map((record: any) => {
          const next = { ...record };
          delete next[colName];
          return next;
        });

        const { [colName]: _removed, ...remainingFields } = tableSchema.fields;
        tableSchema.fields = remainingFields;
        if (Array.isArray(tableSchema.indexes)) {
          tableSchema.indexes = tableSchema.indexes.filter((entry: string) => {
            const normalized = String(entry);
            return normalized !== colName && !normalized.endsWith(`:${colName}`) && !normalized.includes(`(${colName})`);
          });
        }

        try {
          TelebaseQueryEngine.clearTableCache(project.id, resolvedTableName);
          await TelebaseQueryEngine.saveTableRecords(project, resolvedTableName, updatedRecords);
          await saveDatabaseState(state, { allowShrink: true });
          return NextResponse.json({ success: true, message: `Column "${colName}" dropped from table "${resolvedTableName}".` });
        } catch (error: any) {
          if (!state.schemas) state.schemas = {};
          state.schemas[schemaKey] = originalSchema;
          try {
            TelebaseQueryEngine.clearTableCache(project.id, resolvedTableName);
            await TelebaseQueryEngine.saveTableRecords(project, resolvedTableName, originalRecords);
          } catch (_) {}
          try {
            await saveDatabaseState(state, { allowShrink: true });
          } catch (_) {}
          throw error;
        }
      }

      if (parsed.type === 'CREATE_INDEX' || parsed.type === 'DROP_INDEX') {
        const state = await getDatabaseState(true);
        const resolvedTableName = parsed.tableName || tableName;
        const schemaKey = `${project.id}_${resolvedTableName}`;
        const tableSchema = state.schemas?.[schemaKey];

        if (!tableSchema) {
          return NextResponse.json({ success: false, error: `Table "${resolvedTableName}" not found or has no schema.` }, { status: 404 });
        }

        const indexName = parsed.schema?.indexName;
        const columnName = parsed.schema?.columnName;
        if (parsed.type === 'CREATE_INDEX') {
          if (!columnName || !tableSchema.fields?.[columnName]) {
            return NextResponse.json({ success: false, error: `Column "${columnName}" does not exist on table "${resolvedTableName}".` }, { status: 404 });
          }
          const entry = indexName && columnName !== indexName ? `${indexName}:${columnName}` : columnName;
          tableSchema.indexes = Array.isArray(tableSchema.indexes) ? tableSchema.indexes : [];
          if (!tableSchema.indexes.includes(entry)) {
            tableSchema.indexes.push(entry);
          }
          await saveDatabaseState(state, { allowShrink: true });
          return NextResponse.json({ success: true, message: `Index "${indexName}" created on table "${resolvedTableName}".` });
        }

        const indexes = Array.isArray(tableSchema.indexes) ? tableSchema.indexes : [];
        const nextIndexes = indexes.filter((entry: string) => {
          const normalized = String(entry);
          const entryName = normalized.includes(':') ? normalized.split(':', 1)[0] : normalized;
          return entryName !== indexName;
        });

        if (nextIndexes.length === indexes.length) {
          return NextResponse.json({ success: false, error: `Index "${indexName}" not found on table "${resolvedTableName}".` }, { status: 404 });
        }

        tableSchema.indexes = nextIndexes;
        await saveDatabaseState(state, { allowShrink: true });
        return NextResponse.json({ success: true, message: `Index "${indexName}" dropped from table "${resolvedTableName}".` });
      }

      if (parsed.type === 'SELECT' || parsed.type === 'INSERT' || parsed.type === 'UPDATE' || parsed.type === 'DELETE') {
        queryAction = {
          type: parsed.type,
          noSqlQuery: parsed.noSqlQuery,
          insertData: parsed.insertData,
          updateSet: parsed.updateSet,
          sqlSelect: parsed.sqlSelect,
          forceLockCrash
        };
      } else {
        queryAction = {
          type: action,
          noSqlQuery,
          insertData,
          updateSet,
          forceLockCrash
        };
      }
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
    return NextResponse.json({ success: false, error: "An internal error occurred" }, { status: 500 });
  }
}
