import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const operator = searchParams.get('operator');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and End date parameters are required.' },
        { status: 400 }
      );
    }

    // Set timestamps to include full days (from 00:00:00 of start to 23:59:59 of end)
    const startTimestamp = `${startDate} 00:00:00`;
    const endTimestamp = `${endDate} 23:59:59`;

    let queryStr = `
      SELECT l.id, l.registration_number, l.section, l.slot_number, l.checkin_time, l.checkout_time, l.operator_username, u.name as student_name 
      FROM attendance_logs l 
      JOIN users u ON l.registration_number = u.registration_number 
      WHERE l.checkin_time >= ? AND l.checkin_time <= ?
    `;
    const queryParams = [startTimestamp, endTimestamp];

    if (operator && operator !== 'all') {
      if (operator === 'none') {
        queryStr += ` AND l.operator_username IS NULL`;
      } else {
        queryStr += ` AND l.operator_username = ?`;
        queryParams.push(operator);
      }
    }

    queryStr += ` ORDER BY l.checkin_time DESC`;

    const logs = await query(queryStr, queryParams);

    // Query distinct operators present in database logs
    const distinctOps = await query(
      `SELECT DISTINCT operator_username FROM attendance_logs WHERE operator_username IS NOT NULL`
    );
    const operatorsList = distinctOps.map((row: any) => row.operator_username);

    return NextResponse.json({ 
      success: true, 
      logs,
      operators: operatorsList
    });
  } catch (error: any) {
    console.error('Report API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
