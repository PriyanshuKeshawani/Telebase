import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState } from '@/lib/telegramDatabase';
import { getSession } from '@/lib/session';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const token = await getSession(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await req.json();
    const { bot_token } = body;

    if (!bot_token) {
      return NextResponse.json({ success: false, error: 'bot_token is required' }, { status: 400 });
    }

    const state = await getDatabaseState(true); // force refresh
    const projectIndex = state.projects.findIndex((p) => p.id === id);

    if (projectIndex === -1) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    const project = state.projects[projectIndex];
    
    const owner_telegram_id = (token.owner_telegram_id || token.id || token.sub) as string;
    if (owner_telegram_id !== "1" && project.owner_telegram_id !== owner_telegram_id) {
      return NextResponse.json({ success: false, error: "Forbidden: You do not own this project" }, { status: 403 });
    }

    project.bots = project.bots.filter((t) => t !== bot_token);
    await saveDatabaseState(state, { allowShrink: true });

    const { api_key, ...safeProject } = project;
    return NextResponse.json({ success: true, project: safeProject });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "An internal error occurred" }, { status: 500 });
  }
}
