import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { registrationNumber } = await request.json();

    if (!registrationNumber) {
      return NextResponse.json({ error: 'Registration number is required' }, { status: 400 });
    }

    const regNum = registrationNumber.trim().toUpperCase();

    // 1. Find active seat reservation
    const activeReservations = await query(
      'SELECT * FROM slots WHERE occupied_by = ? AND status = "occupied"',
      [regNum]
    );

    if (activeReservations.length === 0) {
      const activeLogs = await query(
        'SELECT * FROM attendance_logs WHERE registration_number = ? AND checkout_time IS NULL',
        [regNum]
      );
      if (activeLogs.length === 0) {
        return NextResponse.json(
          { error: 'No active session found for this registration number.' },
          { status: 404 }
        );
      }

      await query(
        `UPDATE attendance_logs 
         SET checkout_time = NOW() 
         WHERE registration_number = ? AND checkout_time IS NULL`,
        [regNum]
      );

      return NextResponse.json({
        success: true,
        message: 'Successfully checked out from visit!',
        details: { isVisit: true }
      });
    }

    const reservation = activeReservations[0];
    const { section, slot_number } = reservation;

    // 2. Free the slot
    await query(
      `UPDATE slots 
       SET status = 'available', occupied_by = NULL, occupied_at = NULL 
       WHERE occupied_by = ? AND status = 'occupied'`,
      [regNum]
    );

    // 3. Update the attendance log with checkout time
    await query(
      `UPDATE attendance_logs 
       SET checkout_time = NOW() 
       WHERE registration_number = ? AND section = ? AND slot_number = ? AND checkout_time IS NULL`,
      [regNum, section, slot_number]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully checked out from Seat #${slot_number} in ${section}!`,
      details: {
        section,
        slotNumber: slot_number,
      },
    });
  } catch (error: any) {
    console.error('Checkout API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
