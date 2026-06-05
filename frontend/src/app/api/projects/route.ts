import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getDatabaseState, saveDatabaseState, Project, formatTelegramChannelId, TelebaseStateError } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Edge-compatible random hex string (replaces crypto.randomBytes)
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || "telebase_secret_token_2026_super_secure_32b_key" });
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    let state;
    try {
      state = await getDatabaseState();
    } catch (error: any) {
      if (error instanceof TelebaseStateError && error.code === 'STATE_NOT_FOUND') {
        state = { projects: [], files: [], users: [] };
      } else {
        throw error;
      }
    }
    const userId = token.id as string;

    // Filter projects:
    // If admin (userId === "1"), return all projects.
    // Otherwise, only return projects belonging to the logged-in userId.
    const userProjects = state.projects.filter(p => {
      if (userId === "1") return true;
      return p.userId === userId;
    });

    // Also filter files to only include files belonging to the filtered projects
    const allowedProjectIds = new Set(userProjects.map(p => p.id));
    const userFiles = state.files.filter(f => allowedProjectIds.has(f.project_id));

    return NextResponse.json({ success: true, projects: userProjects, files: userFiles });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || "telebase_secret_token_2026_super_secure_32b_key" });
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const userId = token.id as string;
    const body = await req.json();
    let { name, channel_id, storage_type, bots } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Project name is required' }, { status: 400 });
    }

    if (!channel_id || channel_id.trim() === '') {
      return NextResponse.json({ success: false, error: 'Telegram Channel ID is required' }, { status: 400 });
    }

    const validBots = Array.isArray(bots) ? bots.filter((b: string) => b.trim() !== '') : [];
    if (validBots.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one active Telegram Bot Token is required' }, { status: 400 });
    }

    // Robust Auto-Formatting for Telegram Channel IDs (e.g. converting -3817953908 -> -1003817953908)
    if (channel_id) {
      channel_id = formatTelegramChannelId(channel_id);
    }

    let state;
    try {
      state = await getDatabaseState(true); // force refresh
    } catch (error: any) {
      if (error instanceof TelebaseStateError && error.code === 'STATE_NOT_FOUND') {
        state = {
          projects: [],
          files: [],
          users: [],
          pendingUsers: [],
          version: 1,
          updatedAt: new Date().toISOString()
        };
      } else {
        throw error;
      }
    }

    const apiKey = `sk_proj_${randomHex(16)}`;
    const newProject: Project = {
      id: globalThis.crypto.randomUUID(),
      userId: userId, // Assign owner to isolate this workspace
      name,
      api_key: apiKey,
      channel_id: channel_id || '',
      storage_type: storage_type || 'TELEGRAM',
      bots: validBots,
      created_at: new Date().toISOString()
    };

    state.projects.push(newProject);
    await saveDatabaseState(state);

    return NextResponse.json({ success: true, project: newProject });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


