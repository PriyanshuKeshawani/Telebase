import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectApiKey } from '@/lib/telegramDatabase';
import { TelebaseQueryEngine } from '@/lib/telebaseQueryEngine';
import { hashPassword, generateSalt } from '@/lib/password';
import { signJwt } from '@/lib/jwt';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    // Developers can identify project using API key or header (if using public/anon key later)
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
    }

    const project = await verifyProjectApiKey(apiKey);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const tableName = '_telebase_users';

    // 1. Check if user already exists
    const checkResult = await TelebaseQueryEngine.executeQuery(project, tableName, {
      type: 'SELECT',
      noSqlQuery: { email: { $eq: email } }
    });

    if (checkResult.success && checkResult.records && checkResult.records.length > 0) {
      return NextResponse.json({ success: false, error: 'User already exists' }, { status: 400 });
    }

    // 2. Hash password
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // 3. Insert new user
    const insertData = {
      id: globalThis.crypto.randomUUID(),
      email,
      password_hash: passwordHash,
      salt,
      created_at: new Date().toISOString()
    };

    const insertResult = await TelebaseQueryEngine.executeQuery(project, tableName, {
      type: 'INSERT',
      insertData
    });

    if (!insertResult.success) {
      return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
    }

    // 4. Generate JWT
    const token = await signJwt({ 
      sub: insertData.id, 
      email: insertData.email, 
      project_id: project.id 
    });

    // Return user without sensitive data
    return NextResponse.json({
      success: true,
      user: {
        id: insertData.id,
        email: insertData.email,
        created_at: insertData.created_at
      },
      token
    });
  } catch (error: any) {
    console.error('[Auth Signup Error]', error.message);
    return NextResponse.json({ success: false, error: "An internal error occurred" }, { status: 500 });
  }
}
