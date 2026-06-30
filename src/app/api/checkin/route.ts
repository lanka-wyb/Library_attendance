import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { registrationNumber, section, slotNumber } = await request.json();

    if (!registrationNumber || !section || slotNumber === undefined) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const regNum = registrationNumber.trim().toUpperCase();
    const slotNum = parseInt(slotNumber, 10);

    // 1. Verify user exists
    const users = await query('SELECT * FROM users WHERE registration_number = ?', [regNum]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'User registration not found' }, { status: 404 });
    }

    // 2. Check if user already holds a seat
    const activeReservations = await query(
      'SELECT * FROM slots WHERE occupied_by = ? AND status = "occupied"',
      [regNum]
    );
    if (activeReservations.length > 0) {
      const res = activeReservations[0];
      return NextResponse.json(
        { error: `You already have an active seat reservation in ${res.section} (Seat #${res.slot_number})` },
        { status: 400 }
      );
    }

    // 3. Attempt to book the slot (ensuring it is currently available)
    const result = await query(
      `UPDATE slots 
       SET status = 'occupied', occupied_by = ?, occupied_at = NOW() 
       WHERE section = ? AND slot_number = ? AND status = 'available'`,
      [regNum, section, slotNum]
    );

    // in mysql2 pool.execute returns a ResultSetHeader for UPDATE statements.
    // We check result.affectedRows
    if (!result || result.affectedRows === 0) {
      return NextResponse.json(
        { error: 'Selected seat is already occupied or does not exist. Please select another seat.' },
        { status: 409 }
      );
    }

    // 4. Log the check-in in attendance_logs
    await query(
      `INSERT INTO attendance_logs (registration_number, section, slot_number, checkin_time) 
       VALUES (?, ?, ?, NOW())`,
      [regNum, section, slotNum]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully booked Seat #${slotNum} in ${section}!`,
    });
  } catch (error: any) {
    console.error('Checkin API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
