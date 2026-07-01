import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
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

// DELETE: Remove a user
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

    // Attempt deletion
    try {
      const result = await query('DELETE FROM users WHERE registration_number = ?', [regNum]);
      if (result.affectedRows === 0) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Student removed successfully' });
    } catch (dbError: any) {
      // Catch foreign key constraint failure (e.g. references in logs)
      if (dbError.errno === 1451 || dbError.code === 'ER_ROW_IS_REFERENCED_2') {
        return NextResponse.json(
          { error: 'Cannot delete this student because they have active or past library attendance records. You must clear their logs first.' },
          { status: 409 }
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('DELETE Users API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
