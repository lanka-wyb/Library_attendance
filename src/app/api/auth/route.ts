import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { registrationNumber } = await request.json();
    if (!registrationNumber || typeof registrationNumber !== 'string') {
      return NextResponse.json({ error: 'Registration number is required' }, { status: 400 });
    }

    const regNum = registrationNumber.trim().toUpperCase();
    if (!regNum) {
      return NextResponse.json({ error: 'Registration number cannot be empty' }, { status: 400 });
    }

    // 1. Check if user exists
    let users = await query('SELECT * FROM users WHERE registration_number = ?', [regNum]);
    let user;

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Unauthorized Access: Registration number not found in the database.' },
        { status: 401 }
      );
    } else {
      user = users[0];
    }

    // 2. Check if the user has an active seat reservation
    const activeReservations = await query(
      'SELECT * FROM slots WHERE occupied_by = ? AND status = "occupied"',
      [regNum]
    );

    const activeReservation = activeReservations.length > 0 ? activeReservations[0] : null;

    return NextResponse.json({
      success: true,
      user,
      activeReservation,
    });
  } catch (error: any) {
    console.error('Auth API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
