import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAssignedLibrary } from '@/lib/library-assignment';

const LIBRARY_SECTIONS: { [library: string]: string[] } = {
  MAIN: ['reading_l1', 'reading_l2', 'reading_l3', 'reading_l4', 'block_a', 'block_b', 'block_c', 'block_d', 'auditorium'],
  MKDL: ['mkdl_reading', 'mkdl_reference', 'mkdl_block_a', 'mkdl_block_b'],
  MEDL: ['medl_reading', 'medl_reference', 'medl_block_a', 'medl_block_b'],
};

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
      // (Using section parameter if provided to track visitor branch, e.g. MAIN, MKDL, MEDL)
      const visitorSection = (section && ['MAIN', 'MKDL', 'MEDL'].includes(section)) ? section : null;
      await query(
        `INSERT INTO attendance_logs (registration_number, section, slot_number, checkin_time) 
         VALUES (?, ?, NULL, NOW())`,
        [regNum, visitorSection]
      );

      return NextResponse.json({
        success: true,
        message: 'Successfully checked in as a visitor!',
      });
    } else {
      // It is a seat reservation
      const assignedLib = getAssignedLibrary(regNum);
      if (assignedLib !== null) {
        const targetLib = Object.keys(LIBRARY_SECTIONS).find(lib => 
          LIBRARY_SECTIONS[lib].includes(section)
        );

        if (!targetLib || targetLib !== assignedLib) {
          return NextResponse.json(
            { error: `You are officially assigned to the ${assignedLib} Library and can only book seats there.` },
            { status: 400 }
          );
        }
      }

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
