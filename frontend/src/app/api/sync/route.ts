import { NextResponse } from 'next/server';
import { getDatabaseState } from '@/lib/telegramDatabase';

export async function POST() {
  try {
    const state = await getDatabaseState(true); // force refresh
    return NextResponse.json({
      success: true,
      message: 'State rebuilt successfully from Telegram pinned document!',
      projectsCount: state.projects.length,
      filesCount: state.files.length
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
