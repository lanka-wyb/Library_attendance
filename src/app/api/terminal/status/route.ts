import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const terminalToken = cookieStore.get('terminal_token');

    const isUnlocked = terminalToken && terminalToken.value === 'unlocked';

    return NextResponse.json({
      success: true,
      unlocked: !!isUnlocked,
    });
  } catch (error: any) {
    console.error('Terminal status API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
