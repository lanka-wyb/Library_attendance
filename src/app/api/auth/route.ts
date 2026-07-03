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

    // 2. Check if the user has an active attendance session
    const activeLogs = await query(
      'SELECT * FROM attendance_logs WHERE registration_number = ? AND checkout_time IS NULL ORDER BY checkin_time DESC LIMIT 1',
      [regNum]
    );

    let activeReservation = null;
    if (activeLogs.length > 0) {
      const log = activeLogs[0];
      if (log.section === null || log.slot_number === null) {
        activeReservation = {
          isVisit: true,
          section: null,
          slot_number: null,
          occupied_at: log.checkin_time,
        };
      } else {
        activeReservation = {
          isVisit: false,
          section: log.section,
          slot_number: log.slot_number,
          occupied_at: log.checkin_time,
        };
      }
    }

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
