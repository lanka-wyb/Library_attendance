import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    let role = 'admin';
    const admins = await query(
      'SELECT * FROM admins WHERE username = ? AND password = ?',
      [username.trim(), password]
    );

    if (admins.length === 0) {
      // Check if it's an operator
      const operators = await query(
        'SELECT * FROM operators WHERE username = ? AND password = ?',
        [username.trim(), password]
      );
      if (operators.length === 0) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }
      role = 'operator';
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      role: role,
    });

    // Set secure HTTP-only cookie for login status
    response.cookies.set('admin_token', 'admin-logged-in', {
      path: '/',
      httpOnly: true,
      secure: false, // Must be false as the server runs over HTTP
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
    });

    // Set secure HTTP-only cookie for role
    response.cookies.set('admin_role', role, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error: any) {
    console.error('Admin login API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

    // Clear cookies
    response.cookies.set('admin_token', '', {
      path: '/',
      maxAge: 0,
    });
    response.cookies.set('admin_role', '', {
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    console.error('Admin logout API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
