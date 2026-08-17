import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.redirect(new URL('/sign-in', 'https://shortlinks.fun'))
}
