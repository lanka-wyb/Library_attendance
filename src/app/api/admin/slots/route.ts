import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    let slots;
    if (section) {
      const validSections = [
        'reading_l1', 'reading_l2', 'reading_l3', 'reading_l4', 'block_a', 'block_b', 'block_c', 'block_d', 'auditorium',
        'mkdl_reading', 'mkdl_reference', 'mkdl_block_a', 'mkdl_block_b',
        'medl_reading', 'medl_reference', 'medl_block_a', 'medl_block_b'
      ];
      if (!validSections.includes(section)) {
        return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
      }

      slots = await query(
        `SELECT s.id, s.section, s.slot_number, s.status, s.occupied_by, s.occupied_at, u.name as occupant_name 
         FROM slots s 
         LEFT JOIN users u ON s.occupied_by = u.registration_number 
         WHERE s.section = ? 
         ORDER BY s.slot_number ASC`,
        [section]
      );
    } else {
      slots = await query(
        `SELECT s.id, s.section, s.slot_number, s.status, s.occupied_by, s.occupied_at, u.name as occupant_name 
         FROM slots s 
         LEFT JOIN users u ON s.occupied_by = u.registration_number 
         ORDER BY s.section ASC, s.slot_number ASC`
      );
    }

    const activeVisitorLogs = await query(
      `SELECT l.id, l.registration_number, l.section, l.checkin_time as occupied_at, u.name as occupant_name 
       FROM attendance_logs l 
       JOIN users u ON l.registration_number = u.registration_number 
       WHERE (l.section IS NULL OR l.section IN ('MAIN', 'MKDL', 'MEDL')) AND l.slot_number IS NULL AND l.checkout_time IS NULL
       ORDER BY l.checkin_time DESC`
    );

    return NextResponse.json({ success: true, slots, activeVisitorLogs });
  } catch (error: any) {
    console.error('Admin slots API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
