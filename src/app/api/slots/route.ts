import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    if (section) {
      // Validate section
      const validSections = [
        'reading_l1', 'reading_l2', 'reading_l3', 'reading_l4', 'block_a', 'block_b', 'block_c', 'block_d', 'auditorium',
        'mkdl_reading', 'mkdl_reference', 'mkdl_block_a', 'mkdl_block_b',
        'medl_reading', 'medl_reference', 'medl_block_a', 'medl_block_b'
      ];
      if (!validSections.includes(section)) {
        return NextResponse.json({ error: 'Invalid section' }, { status: 400 });
      }

      // Fetch all slots in this section
      const slots = await query(
        'SELECT id, section, slot_number, status, occupied_by, occupied_at FROM slots WHERE section = ? ORDER BY slot_number ASC',
        [section]
      );
      return NextResponse.json({ success: true, slots });
    } else {
      // Return summary counts for all sections
      const summaries = await query(
        'SELECT section, COUNT(*) as total, SUM(CASE WHEN status = "occupied" THEN 1 ELSE 0 END) as occupied FROM slots GROUP BY section'
      );
      // Fetch status of all slots for graphical preview
      const slots = await query(
        'SELECT section, slot_number, status FROM slots ORDER BY section, slot_number ASC'
      );
      return NextResponse.json({ success: true, summaries, slots });
    }
  } catch (error: any) {
    console.error('Slots API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
