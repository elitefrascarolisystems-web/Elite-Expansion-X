// Identidade sintética dos testes. Nunca usar fora dos testes.
export async function getCurrentUser(){return globalThis.__eliteTestUser??null;}
export function isAuthConfigured(){return true;}
export function signOutPath(){return '/cdn-cgi/access/logout';}
