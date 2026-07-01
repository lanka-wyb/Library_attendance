import { NextResponse } from 'next/server';
import pool, { query } from '@/lib/db';
import { cookies } from 'next/headers';

// Helper to check admin authentication
async function isAuthenticated() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin_token');
  return adminToken && adminToken.value === 'admin-logged-in';
}

// GET: Retrieve all users or search users
export async function GET(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();

    let sql = 'SELECT * FROM users';
    let params: string[] = [];

    if (search) {
      sql += ' WHERE registration_number LIKE ? OR name LIKE ?';
      params = [`%${search}%`, `%${search}%`];
    }

    sql += ' ORDER BY registration_number ASC LIMIT 1000';

    const users = await query(sql, params);
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('GET Users API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// POST: Add a new user
export async function POST(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { registrationNumber, name } = await request.json();

    if (!registrationNumber || !name) {
      return NextResponse.json({ error: 'Registration number and name are required' }, { status: 400 });
    }

    const regNum = registrationNumber.trim().toUpperCase();
    const studentName = name.trim();

    if (!regNum || !studentName) {
      return NextResponse.json({ error: 'Registration number and name cannot be empty' }, { status: 400 });
    }

    // Check duplicate primary key
    const existing = await query('SELECT * FROM users WHERE registration_number = ?', [regNum]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Registration number is already registered.' }, { status: 409 });
    }

    await query('INSERT INTO users (registration_number, name) VALUES (?, ?)', [regNum, studentName]);
    return NextResponse.json({ success: true, message: 'Student added successfully' });
  } catch (error: any) {
    console.error('POST Users API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// PUT: Update an existing user's details
export async function PUT(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { registrationNumber, name } = await request.json();

    if (!registrationNumber || !name) {
      return NextResponse.json({ error: 'Registration number and name are required' }, { status: 400 });
    }

    const regNum = registrationNumber.trim().toUpperCase();
    const studentName = name.trim();

    // Check if user exists
    const existing = await query('SELECT * FROM users WHERE registration_number = ?', [regNum]);
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    await query('UPDATE users SET name = ? WHERE registration_number = ?', [studentName, regNum]);
    return NextResponse.json({ success: true, message: 'Student details updated successfully' });
  } catch (error: any) {
    console.error('PUT Users API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// DELETE: Remove a user (cascade deletes logs/active seats)
export async function DELETE(request: Request) {
  try {
    if (!await isAuthenticated()) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const regNum = searchParams.get('registrationNumber')?.trim().toUpperCase();

    if (!regNum) {
      return NextResponse.json({ error: 'Registration number is required' }, { status: 400 });
    }

    // Check if user exists
    const users = await query('SELECT * FROM users WHERE registration_number = ?', [regNum]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Release active slot
      await conn.execute(
        'UPDATE slots SET occupied_by = NULL, status = "available", occupied_at = NULL WHERE occupied_by = ?',
        [regNum]
      );

      // 2. Delete attendance logs
      await conn.execute(
        'DELETE FROM attendance_logs WHERE registration_number = ?',
        [regNum]
      );

      // 3. Delete user
      await conn.execute(
        'DELETE FROM users WHERE registration_number = ?',
        [regNum]
      );

      await conn.commit();
      return NextResponse.json({ success: true, message: 'Student and their attendance history removed successfully.' });
    } catch (dbError: any) {
      await conn.rollback();
      throw dbError;
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('DELETE Users API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
