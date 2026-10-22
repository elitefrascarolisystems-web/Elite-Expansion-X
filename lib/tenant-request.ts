/**
 * Contexto de organização por aba.
 *
 * Cada página fica fixa na organização da sua própria URL (?org=N). O cliente
 * repete esse valor no header X-Elite-Organization em toda chamada de API, e o
 * servidor valida o vínculo do usuário com essa organização a cada requisição.
 * Não usamos cookie: um cookie é compartilhado entre abas, então trocar de
 * organização numa aba mudaria silenciosamente o destino das escritas das outras.
 */
export const ORGANIZATION_HEADER = 'X-Elite-Organization';

/** Converte o valor recebido em id de organização. Ausente, vazio ou malformado: undefined. */
export function parseOrganizationId(raw: string | null | undefined): number | undefined {
 if (!raw || !/^[1-9][0-9]*$/.test(raw)) return undefined;
 const id = Number(raw);
 return Number.isSafeInteger(id) ? id : undefined;
}

/** Organização da aba atual, lida da URL do navegador. */
export function currentOrganizationId(): number | undefined {
 if (typeof window === 'undefined') return undefined;
 return parseOrganizationId(new URL(window.location.href).searchParams.get('org'));
}

export function tenantFetch(input: string, init: RequestInit = {}) {
 const org = currentOrganizationId();
 const headers = new Headers(init.headers);
 if (org !== undefined) headers.set(ORGANIZATION_HEADER, String(org));
 // Sem sinal, o navegador só diz "Failed to fetch"; as telas mostram a mensagem em português.
 return fetch(input, { ...init, headers, cache: 'no-store' }).catch((error: unknown) => {
  if (error instanceof Error && error.name === 'AbortError') throw error;
  throw new Error('Sem internet agora. Confira a conexão e tente de novo.');
 });
}

/**
 * Organização pedida pela requisição (header, ou ?org= na URL da API).
 * Sem contexto válido devolve -1, que não corresponde a nenhum vínculo:
 * o acesso é negado em vez de cair numa organização escolhida por padrão.
 */
export function organizationFromRequest(request: Request): number {
 const raw = request.headers.get(ORGANIZATION_HEADER) ?? new URL(request.url).searchParams.get('org');
 return parseOrganizationId(raw) ?? -1;
}
