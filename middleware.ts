import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Add additional authorization logic here if needed
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Protect all API routes except auth
        if (req.nextUrl.pathname.startsWith("/api") && 
            !req.nextUrl.pathname.includes("/api/auth")) {
          return !!token;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    "/api/products/:path*",
    "/api/config/:path*",
    "/dashboard/:path*",
  ],
};