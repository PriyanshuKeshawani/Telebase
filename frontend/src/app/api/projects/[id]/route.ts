import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getDatabaseState, saveDatabaseState } from "@/lib/telegramDatabase";

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = (session.user as any).id;

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
    if (userId !== "1" && project.userId !== userId) {
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
    await saveDatabaseState(state);

    return NextResponse.json({
      success: true,
      message: "Project and all associated database records deleted successfully"
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
