import { NextRequest, NextResponse } from "next/server";
import { getDatabaseState, saveDatabaseState, UserRecord } from "@/lib/telegramDatabase";

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and OTP code are required" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOTP = otp.trim();

    // Fetch current state
    const state = await getDatabaseState(true);
    if (!state.pendingUsers) state.pendingUsers = [];
    if (!state.users) state.users = [];

    // Find pending user
    const pendingIndex = state.pendingUsers.findIndex(
      (p) => p.email === trimmedEmail
    );

    if (pendingIndex === -1) {
      return NextResponse.json(
        { success: false, error: "No pending registration found. Please register again." },
        { status: 400 }
      );
    }

    const pending = state.pendingUsers[pendingIndex];

    // Check expiry
    if (Date.now() > pending.expiresAt) {
      // Remove expired entry
      state.pendingUsers.splice(pendingIndex, 1);
      await saveDatabaseState(state, { allowShrink: true });

      return NextResponse.json(
        { success: false, error: "OTP expired. Please register again to receive a new code." },
        { status: 400 }
      );
    }

    // Verify OTP
    if (pending.otp !== trimmedOTP) {
      return NextResponse.json(
        { success: false, error: "Invalid verification code. Please check and try again." },
        { status: 400 }
      );
    }

    // OTP correct — move from pending to verified users
    const newUser: UserRecord = {
      id: globalThis.crypto.randomUUID(),
      email: pending.email,
      passwordHash: pending.passwordHash,
      created_at: new Date().toISOString(),
    };

    state.users.push(newUser);

    // Remove from pending
    state.pendingUsers.splice(pendingIndex, 1);

    // Cleanup all expired pending users
    state.pendingUsers = state.pendingUsers.filter(
      (p) => p.expiresAt > Date.now()
    );

    await saveDatabaseState(state, { allowShrink: true });

    return NextResponse.json({
      success: true,
      message: "Email verified successfully! You can now sign in.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
