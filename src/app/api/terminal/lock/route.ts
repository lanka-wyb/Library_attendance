import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Terminal locked successfully',
    });

    // Clear the terminal unlock cookie
    response.cookies.set('terminal_token', '', {
      path: '/',
      maxAge: 0,
    });

    // Clear the terminal operator cookie
    response.cookies.set('terminal_operator', '', {
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    console.error('Terminal lock API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
