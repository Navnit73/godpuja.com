import { NextResponse } from "next/server";

// Unknown /api paths get the same JSON envelope as every other API error (not an HTML 404).
const notFound = () => NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown API endpoint" } }, { status: 404 });
export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
