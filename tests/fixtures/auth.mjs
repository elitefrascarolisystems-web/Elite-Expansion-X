// Identidade sintética dos testes. Nunca usar fora dos testes.
export async function getCurrentUser(){return globalThis.__eliteTestUser??null;}
export function signOutPath(){return '/api/auth/logout';}
