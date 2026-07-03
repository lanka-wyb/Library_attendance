import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { section, slotNumber, registrationNumber } = await request.json();

    if (registrationNumber) {
      const regNum = registrationNumber.trim().toUpperCase();

      // Find if they hold a physical slot
      const occupiedSlots = await query(
        'SELECT * FROM slots WHERE occupied_by = ? AND status = "occupied"',
        [regNum]
      );

      if (occupiedSlots.length > 0) {
        const slot = occupiedSlots[0];
        // Free the physical slot
        await query(
          `UPDATE slots 
           SET status = 'available', occupied_by = NULL, occupied_at = NULL 
           WHERE id = ?`,
          [slot.id]
        );
      }

      // Close the active attendance log
      await query(
        `UPDATE attendance_logs 
         SET checkout_time = NOW() 
         WHERE registration_number = ? AND checkout_time IS NULL`,
        [regNum]
      );

      return NextResponse.json({
        success: true,
        message: `Successfully released student ${regNum}.`,
      });
    }

    if (!section || slotNumber === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const slotNum = parseInt(slotNumber, 10);

    // 1. Find the occupant
    const slots = await query(
      'SELECT occupied_by FROM slots WHERE section = ? AND slot_number = ? AND status = "occupied"',
      [section, slotNum]
    );

    if (slots.length === 0) {
      return NextResponse.json(
        { error: 'No student currently occupies this seat.' },
        { status: 404 }
      );
    }

    const regNum = slots[0].occupied_by;

    // 2. Free the slot
    await query(
      `UPDATE slots 
       SET status = 'available', occupied_by = NULL, occupied_at = NULL 
       WHERE section = ? AND slot_number = ? AND status = 'occupied'`,
      [section, slotNum]
    );

    // 3. Close the active attendance log
    await query(
      `UPDATE attendance_logs 
       SET checkout_time = NOW() 
       WHERE registration_number = ? AND section = ? AND slot_number = ? AND checkout_time IS NULL`,
      [regNum, section, slotNum]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully released Seat #${slotNum} in ${section} (Occupied by ${regNum}).`,
    });
  } catch (error: any) {
    console.error('Admin override API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
