import { auth } from '$lib/server/auth.js';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';

const handler = toSvelteKitHandler(auth);

export const GET = handler;
export const POST = handler;
