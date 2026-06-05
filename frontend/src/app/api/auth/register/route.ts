import { NextRequest, NextResponse } from "next/server";
import { getDatabaseState, saveDatabaseState, UserRecord, PendingUser, TelebaseStateError } from "@/lib/telegramDatabase";
import { sendOTPEmail, generateOTP } from "@/lib/emailService";

export const runtime = 'edge';

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data as any);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Fetch current state
    let state;
    try {
      state = await getDatabaseState(true);
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
    if (!state.users) state.users = [];
    if (!state.pendingUsers) state.pendingUsers = [];

    // Check if already registered
    const exists = state.users.some(
      (u) => u.email.toLowerCase() === trimmedEmail
    );
    if (exists || trimmedEmail === "admin" || trimmedEmail === "admin@telebase.io") {
      return NextResponse.json(
        { success: false, error: "User already exists with this email" },
        { status: 400 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const passwordHash = await sha256Hex(password);

    // Remove any existing pending entry for this email (allow re-register)
    state.pendingUsers = state.pendingUsers.filter(
      (p) => p.email !== trimmedEmail
    );

    // Store pending user with OTP
    const pendingUser: PendingUser = {
      email: trimmedEmail,
      passwordHash,
      otp,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      created_at: new Date().toISOString(),
    };
    state.pendingUsers.push(pendingUser);

    // Cleanup expired pending users
    state.pendingUsers = state.pendingUsers.filter(
      (p) => p.expiresAt > Date.now()
    );

    await saveDatabaseState(state);

    // Send OTP email
    const emailResult = await sendOTPEmail(trimmedEmail, otp);
    if (!emailResult.success) {
      console.warn("[Register] Email send failed, but OTP is stored. Error:", emailResult.error);
      // Still return success — in dev mode OTP is logged to console
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email! Please check your inbox.",
      requiresOTP: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
