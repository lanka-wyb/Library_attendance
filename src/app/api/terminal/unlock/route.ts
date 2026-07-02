import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const trimmedUser = username.trim().toLowerCase();

    // 1. Check operators table
    const operators = await query(
      'SELECT * FROM operators WHERE username = ? AND password = ?',
      [trimmedUser, password]
    );

    let isAuthorized = operators.length > 0;
    let displayName = isAuthorized ? operators[0].name : '';

    // 2. Check admins table if not an operator
    if (!isAuthorized) {
      const admins = await query(
        'SELECT * FROM admins WHERE username = ? AND password = ?',
        [trimmedUser, password]
      );
      isAuthorized = admins.length > 0;
      displayName = isAuthorized ? 'Administrator' : '';
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Invalid operator or administrator credentials' }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Terminal unlocked successfully',
      name: displayName,
    });

    // Set secure HTTP-only terminal unlock cookie (expires in 12 hours)
    response.cookies.set('terminal_token', 'unlocked', {
      path: '/',
      httpOnly: true,
      secure: false, // Must be false as the server runs over HTTP
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 hours
    });

    return response;
  } catch (error: any) {
    console.error('Terminal unlock API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
