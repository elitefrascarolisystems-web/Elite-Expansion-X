import { getCurrentUser } from "@/app/auth";
import { getUserAccess } from "@/db/access";
import { getLogo } from "@/db/identity";

export const dynamic = "force-dynamic";

/** Logo da empresa (?org=). Só para quem tem acesso a ela; o navegador guarda por um dia. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const org = Number(new URL(request.url).searchParams.get("org"));
  if (!Number.isSafeInteger(org) || org < 1) return new Response(null, { status: 400 });
  if (!await getUserAccess(user.email, user.displayName, org)) return new Response(null, { status: 403 });
  const logo = await getLogo(org);
  if (!logo) return new Response(null, { status: 404 });
  return new Response(new Blob([logo.bytes as Uint8Array<ArrayBuffer>], { type: logo.type }), { headers: { "Content-Type": logo.type, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
