import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDatabaseState, saveDatabaseState, Project } from '@/lib/telegramDatabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const state = await getDatabaseState();
    const userId = (session.user as any).id;

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
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const userId = (session.user as any).id;
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
      let cleaned = channel_id.trim();
      if (/^-?\d+$/.test(cleaned)) {
        if (cleaned.startsWith('-')) {
          if (!cleaned.startsWith('-100')) {
            cleaned = '-100' + cleaned.substring(1);
          }
        } else {
          if (cleaned.startsWith('100')) {
            cleaned = '-' + cleaned;
          } else {
            cleaned = '-100' + cleaned;
          }
        }
      }
      channel_id = cleaned;
    }

    const state = await getDatabaseState(true); // force refresh

    const apiKey = `sk_proj_${crypto.randomBytes(16).toString('hex')}`;
    const newProject: Project = {
      id: crypto.randomUUID(),
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


