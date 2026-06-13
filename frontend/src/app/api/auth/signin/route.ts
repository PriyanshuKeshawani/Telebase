export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Re-export from [...nextauth] route
export { POST } from '@/app/api/auth/[...nextauth]/route';
