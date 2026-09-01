import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    public_key_exists: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    private_key_exists: !!process.env.VAPID_PRIVATE_KEY,
    public_key_length: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.length : 0,
    private_key_length: process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PRIVATE_KEY.length : 0,
  })
}
