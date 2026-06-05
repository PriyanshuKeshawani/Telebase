import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState } from '@/lib/telegramDatabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    project.bots = project.bots.filter((t) => t !== bot_token);
    await saveDatabaseState(state, { allowShrink: true });

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
