import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log('=== LOGIN API CALLED ===');
    console.log('Login attempt:', { email, password: '***' });

    const loginResponse = await fetch(`${BACKEND}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResponse.ok) {
      let error = 'Invalid credentials';
      try {
        const errorData = await loginResponse.json();
        error = errorData.detail || errorData.error || error;
      } catch {}

      return NextResponse.json(
        { error },
        { status: loginResponse.status }
      );
    }

    const tokenData = await loginResponse.json();
    const token = tokenData.access_token;

    const meResponse = await fetch(`${BACKEND}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!meResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to load user profile' },
        { status: 500 }
      );
    }

    const user = await meResponse.json();

    return NextResponse.json({
      success: true,
      user,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
