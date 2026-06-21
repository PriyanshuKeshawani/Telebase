import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectApiKey, getDatabaseState, saveDatabaseState } from '@/lib/telegramDatabase';
import { TelebaseQueryEngine } from '@/lib/telebaseQueryEngine';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * POST /api/db/import
 * Bulk import records into a table (create table + insert all records atomically).
 *
 * Body: {
 *   tableName: string,
 *   schema: { name: string, fields: Record<string, 'string'|'number'|'boolean'>, indexes: string[] },
 *   records: Record<string, any>[],
 *   overwrite?: boolean
 * }
 * Header: x-api-key
 */
export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key') || '';
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const project = await verifyProjectApiKey(apiKey);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const { tableName, schema, records, overwrite } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!tableName || typeof tableName !== 'string') {
      return NextResponse.json({ success: false, error: 'tableName is required.' }, { status: 400 });
    }

    const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!IDENTIFIER_RE.test(tableName.trim())) {
      return NextResponse.json(
        { success: false, error: `Invalid table name: "${tableName}". Only alphanumeric and underscore characters allowed.` },
        { status: 400 }
      );
    }

    if (!schema || !schema.fields || typeof schema.fields !== 'object') {
      return NextResponse.json({ success: false, error: 'Schema with fields is required.' }, { status: 400 });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: false, error: 'Records array is required and must not be empty.' }, { status: 400 });
    }

    // Limit: max 10,000 records per import
    if (records.length > 10000) {
      return NextResponse.json(
        { success: false, error: `Too many records (${records.length}). Maximum 10,000 per import.` },
        { status: 400 }
      );
    }

    const cleanTableName = tableName.trim();
    const filename = `table_${project.id}_${cleanTableName}.json`;
    const schemaKey = `${project.id}_${cleanTableName}`;

    // ── State & Table Registration ────────────────────────────────────────────
    const state = await getDatabaseState(true);

    const existingIndex = state.files.findIndex(
      (f: any) => f.project_id === project.id && f.filename === filename
    );

    if (existingIndex !== -1 && !overwrite) {
      return NextResponse.json(
        { success: false, error: `Table "${cleanTableName}" already exists. Choose a different name or enable overwrite.` },
        { status: 409 }
      );
    }

    // If overwriting, clear old data first
    if (existingIndex !== -1 && overwrite) {
      TelebaseQueryEngine.clearTableCache(project.id, cleanTableName);
      TelebaseQueryEngine.clearTableArtifacts(project.id, cleanTableName);
    }

    // Register table in state if new
    if (existingIndex === -1) {
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
    }

    // Set schema
    if (!state.schemas) state.schemas = {};
    state.schemas[schemaKey] = {
      name: cleanTableName,
      fields: { id: 'string', ...schema.fields },
      indexes: schema.indexes || ['id']
    };

    // Save state (table registration + schema)
    await saveDatabaseState(state);

    // ── Prepare & Insert Records ──────────────────────────────────────────────
    const preparedRecords = records.map((record: any) => {
      const sanitized: Record<string, any> = {
        id: globalThis.crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };

      // Copy only fields that are in the schema (plus allow extra fields)
      for (const [key, value] of Object.entries(record)) {
        if (key === 'id' || key === 'created_at') continue; // Don't allow override of system fields
        // Sanitize string values
        if (typeof value === 'string') {
          sanitized[key] = value
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
            .replace(/<\/?\s*script\s*>/gi, '');
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    });

    // Atomic save — all records at once
    await TelebaseQueryEngine.saveTableRecords(project, cleanTableName, preparedRecords);

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${preparedRecords.length} records into table "${cleanTableName}".`,
      insertedCount: preparedRecords.length,
      tableName: cleanTableName
    });

  } catch (error: any) {
    console.error('[Import API Error]', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'An internal error occurred during import.' },
      { status: 500 }
    );
  }
}
