import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseState, saveDatabaseState, verifyProjectApiKey } from '@/lib/telegramDatabase';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { projectId, storage_options } = await req.json();
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Project ID is required' }, { status: 400 });
    }

    const project = await verifyProjectApiKey(apiKey);
    if (!project || project.id !== projectId) {
      return NextResponse.json({ success: false, error: 'Invalid API key or Project ID' }, { status: 401 });
    }

    const state = await getDatabaseState(true);
    const projectIndex = state.projects.findIndex(p => p.id === projectId);

    if (projectIndex === -1) {
      return NextResponse.json({ success: false, error: 'Project not found in state' }, { status: 404 });
    }

    // Merge new storage options
    state.projects[projectIndex].storage_options = {
      ...(state.projects[projectIndex].storage_options || {}),
      ...storage_options
    };

    // Save state back to KV and trigger background telegram backup
    await saveDatabaseState(state);

    return NextResponse.json({ success: true, project: state.projects[projectIndex] });
  } catch (error: any) {
    console.error('[Project Update Error]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
