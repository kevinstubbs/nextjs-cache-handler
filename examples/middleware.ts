import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Log request information
  console.log('\n🔥 [MIDDLEWARE] Intercepted request:', pathname);
  // console.log('📥 [REQUEST HEADERS]');

  // Log all request headers
  // request.headers.forEach((value, key) => {
  //   console.log(`   ${key}: ${value}`);
  // });

  // Continue with the request and get the response
  const response = NextResponse.next();

  // Log response information
  // console.log('📤 [RESPONSE HEADERS]');

  // Log all response headers
  // response.headers.forEach((value, key) => {
  //   console.log(`   ${key}: ${value}`);
  // });

  // Add a custom header to track middleware execution
  response.headers.set('x-middleware-executed', 'true');
  response.headers.set('x-intercepted-path', pathname);
  // response.headers.set('x-request-timestamp', new Date().toISOString());

  console.log(`✅ [MIDDLEWARE] Completed for: ${pathname}\n`);

  return response;
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (you can add more extensions here if needed)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
};