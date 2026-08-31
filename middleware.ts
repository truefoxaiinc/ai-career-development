import {NextRequest,NextResponse} from 'next/server';
export function middleware(req:NextRequest){const protectedRoute=req.nextUrl.pathname.startsWith('/dashboard')||req.nextUrl.pathname.startsWith('/admin');if(protectedRoute&&!req.cookies.has('cp_access')&&!req.cookies.has('cp_refresh')){const url=new URL('/login',req.url);url.searchParams.set('next',req.nextUrl.pathname+req.nextUrl.search);return NextResponse.redirect(url)}return NextResponse.next()}
export const config={matcher:['/dashboard/:path*','/admin/:path*']};
