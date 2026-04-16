import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create client with service key (even though it's anon key, we'll try regular auth)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = 'KYC-';
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== CREATE USER API CALLED ===');
    
    const body = await request.json();
    console.log('Request body:', body);
    
    const { fullName, email, role, district, registrationNumber, registrationType } = body;

    // MOCK MODE FOR TESTING - Skip Supabase to avoid rate limits
    if (process.env.NODE_ENV === 'development') {
      console.log('Using MOCK MODE for testing (avoiding Supabase rate limits)');
      
      const tempPassword = generateTempPassword();
      const mockUserId = 'mock-user-' + Date.now();
      
      console.log('Mock user created:', { fullName, email, role, tempPassword });
      
      return NextResponse.json({
        success: true,
        tempPassword: tempPassword,
        userId: mockUserId,
        fullName: fullName.trim(),
        email: email.toLowerCase(),
        role: role,
        mockMode: true
      });
    }

    // Validate required fields
    if (!fullName || !email || !role) {
      console.log('Validation failed: missing required fields');
      return NextResponse.json(
        { error: 'Full name, email, and role are required' },
        { status: 400 }
      );
    }

    // Validate role-specific fields
    if ((role === 'miner' || role === 'compliance_officer') && !district) {
      return NextResponse.json(
        { error: 'District is required for miners and compliance officers' },
        { status: 400 }
      );
    }

    if (role === 'miner' && (!registrationNumber || !registrationType)) {
      return NextResponse.json(
        { error: 'Registration number and type are required for miners' },
        { status: 400 }
      );
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();
    console.log('Generated temp password:', tempPassword);

    console.log('Creating Supabase user...');
    // Create user in Supabase Auth using signup method
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password: tempPassword,
      options: {
        data: { 
          full_name: fullName.trim(),
          role: role 
        },
        emailRedirectTo: undefined // Skip email confirmation for testing
      }
    });

    console.log('Auth response:', { authData, authError });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Failed to create user account: ' + authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // Insert into profiles table
    console.log('Creating profile for user:', authData.user.id);
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email.toLowerCase(),
        full_name: fullName.trim(),
        role: role,
        district: district || null,
        must_change_password: true,
        kyc_profile_complete: false,
        created_at: new Date().toISOString()
      });

    console.log('Profile creation response:', { profileError });

    if (profileError) {
      console.error('Profile error:', profileError);
      // Note: We can't delete the user with regular auth, but we can log the error
      console.log('Warning: User created but profile creation failed. Manual cleanup may be needed.');
      return NextResponse.json(
        { error: 'Failed to create user profile: ' + profileError.message },
        { status: 500 }
      );
    }

    // If role is miner, insert into miners table
    if (role === 'miner') {
      const { error: minerError } = await supabase
        .from('miners')
        .insert({
          user_id: authData.user.id,
          registration_number: registrationNumber,
          registration_type: registrationType,
          district: district,
          kyc_status: 'pending',
          compliance_score: 0,
          created_at: new Date().toISOString()
        });

      if (minerError) {
        console.error('Miner error:', minerError);
        // Note: We can't delete the user with regular auth, but we can log the error
        console.log('Warning: User and profile created but miner creation failed. Manual cleanup may be needed.');
        return NextResponse.json(
          { error: 'Failed to create miner record: ' + minerError.message },
          { status: 500 }
        );
      }
    }

    // Return success response
    const response = {
      success: true,
      tempPassword: tempPassword,
      userId: authData.user.id,
      fullName: fullName.trim(),
      email: email.toLowerCase(),
      role: role
    };
    
    console.log('User created successfully:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
