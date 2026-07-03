import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { registrationNumber, section, slotNumber } = await request.json();

    if (!registrationNumber) {
      return NextResponse.json({ error: 'Missing registration number' }, { status: 400 });
    }

    const regNum = registrationNumber.trim().toUpperCase();

    // 1. Verify user exists
    const users = await query('SELECT * FROM users WHERE registration_number = ?', [regNum]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'User registration not found' }, { status: 404 });
    }

    // 2. Check if user already holds an active session (seat or visit)
    const activeLogs = await query(
      'SELECT * FROM attendance_logs WHERE registration_number = ? AND checkout_time IS NULL',
      [regNum]
    );
    if (activeLogs.length > 0) {
      const activeLog = activeLogs[0];
      if (activeLog.section === null || activeLog.slot_number === null) {
        return NextResponse.json(
          { error: 'You are already checked in as a visitor. Please checkout first.' },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: `You already have an active seat reservation in ${activeLog.section} (Seat #${activeLog.slot_number}). Please checkout first.` },
          { status: 400 }
        );
      }
    }

    const isVisit = !section || slotNumber === undefined || slotNumber === null;

    if (isVisit) {
      // 3. Log visitor check-in in attendance_logs
      await query(
        `INSERT INTO attendance_logs (registration_number, section, slot_number, checkin_time) 
         VALUES (?, NULL, NULL, NOW())`,
        [regNum]
      );

      return NextResponse.json({
        success: true,
        message: 'Successfully checked in as a visitor!',
      });
    } else {
      // It is a seat reservation
      const slotNum = parseInt(slotNumber, 10);

      // 4. Attempt to book the slot (ensuring it is currently available)
      const result = await query(
        `UPDATE slots 
         SET status = 'occupied', occupied_by = ?, occupied_at = NOW() 
         WHERE section = ? AND slot_number = ? AND status = 'available'`,
        [regNum, section, slotNum]
      );

      if (!result || result.affectedRows === 0) {
        return NextResponse.json(
          { error: 'Selected seat is already occupied or does not exist. Please select another seat.' },
          { status: 409 }
        );
      }

      // 5. Log the check-in in attendance_logs
      await query(
        `INSERT INTO attendance_logs (registration_number, section, slot_number, checkin_time) 
         VALUES (?, ?, ?, NOW())`,
        [regNum, section, slotNum]
      );

      return NextResponse.json({
        success: true,
        message: `Successfully booked Seat #${slotNum} in ${section}!`,
      });
    }
  } catch (error: any) {
    console.error('Checkin API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
