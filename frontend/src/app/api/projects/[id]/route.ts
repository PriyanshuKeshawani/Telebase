import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDatabaseState, saveDatabaseState } from "@/lib/telegramDatabase";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = await getSession(req);
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const owner_telegram_id = (token.owner_telegram_id || token.id) as string;

    const state = await getDatabaseState(true); // force refresh

    const projectIndex = state.projects.findIndex((p) => p.id === id);
    if (projectIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    const project = state.projects[projectIndex];

    // Enforce isolation ownership: non-admins can only delete their own projects
    if (owner_telegram_id !== "1" && project.owner_telegram_id !== owner_telegram_id) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You do not own this project" },
        { status: 403 }
      );
    }

    // Remove project
    state.projects.splice(projectIndex, 1);

    // Remove associated backup file metadata indices
    state.files = state.files.filter((f) => f.project_id !== id);

    // Save updated index to Telegram & KV
    await saveDatabaseState(state, { allowShrink: true });

    return NextResponse.json({
      success: true,
      message: "Project and all associated database records deleted successfully"
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "An internal error occurred" },
      { status: 500 }
    );
  }
}
