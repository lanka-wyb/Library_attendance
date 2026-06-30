import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { section, slotNumber, action } = await request.json();

    if (!section || slotNumber === undefined || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const slotNum = parseInt(slotNumber, 10);
    if (!['lock', 'unlock'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be lock or unlock.' }, { status: 400 });
    }

    if (action === 'lock') {
      const result = await query(
        `UPDATE slots 
         SET status = 'locked' 
         WHERE section = ? AND slot_number = ? AND status = 'available'`,
        [section, slotNum]
      );

      if (!result || result.affectedRows === 0) {
        return NextResponse.json(
          { error: 'Cannot lock seat. It is either currently occupied, already locked, or does not exist.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully locked Seat #${slotNum} in ${section}.`,
      });
    } else {
      const result = await query(
        `UPDATE slots 
         SET status = 'available' 
         WHERE section = ? AND slot_number = ? AND status = 'locked'`,
        [section, slotNum]
      );

      if (!result || result.affectedRows === 0) {
        return NextResponse.json(
          { error: 'Cannot unlock seat. It is not currently locked.' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Successfully unlocked Seat #${slotNum} in ${section}.`,
      });
    }
  } catch (error: any) {
    console.error('Admin lock API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
