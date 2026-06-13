import { NextRequest, NextResponse } from 'next/server';
import { verifyProjectApiKey } from '@/lib/telegramDatabase';
import { TelebaseQueryEngine } from '@/lib/telebaseQueryEngine';
import { hashPassword } from '@/lib/password';
import { signJwt } from '@/lib/jwt';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
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

    // 1. Find user
    const checkResult = await TelebaseQueryEngine.executeQuery(project, tableName, {
      type: 'SELECT',
      noSqlQuery: { email: { $eq: email } }
    });

    if (!checkResult.success || !checkResult.records || checkResult.records.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    const user = checkResult.records[0];

    // 2. Verify password
    const passwordHash = await hashPassword(password, user.salt);
    if (passwordHash !== user.password_hash) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    // 3. Generate JWT
    const token = await signJwt({ 
      sub: user.id, 
      email: user.email, 
      project_id: project.id 
    });

    // Return user without sensitive data
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      token
    });
  } catch (error: any) {
    console.error('[Auth Login Error]', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
