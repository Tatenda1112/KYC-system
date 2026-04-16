import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'http://localhost:8000';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; docType: string }> }
) {
  try {
    const resolved = await params;
    const response = await fetch(
      `${BACKEND}/miners/registrations/${resolved.id}/documents/${resolved.docType}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: text || 'Document not found' },
        { status: response.status }
      );
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream',
        'Content-Disposition':
          response.headers.get('Content-Disposition') ?? 'attachment; filename="document"',
      },
    });
  } catch (error) {
    console.error('Admin document download error:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}
