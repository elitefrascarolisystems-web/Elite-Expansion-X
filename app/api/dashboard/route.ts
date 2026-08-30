import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  createAmbassador,
  createCity,
  getDashboardData,
  recordAmbassadorUpdate,
  recordCityUpdate,
} from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
  return Response.json({ data: await getDashboardData(user.email) });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Acesso não autorizado." }, { status: 401 });

  try {
    const payload = (await request.json()) as { action?: string; data?: Record<string, unknown> };
    const data = payload.data ?? {};
    if (payload.action === "create_city") {
      if (!String(data.name || "").trim()) throw new Error("Informe o nome da cidade.");
      await createCity(data, user.email);
    } else if (payload.action === "create_ambassador") {
      if (!String(data.name || "").trim() || !String(data.code || "").trim()) {
        throw new Error("Informe o nome e o código do embaixador.");
      }
      await createAmbassador(data, user.email);
    } else if (payload.action === "record_city") {
      if (!data.cityId || !String(data.period || "").trim()) throw new Error("Informe a cidade e o período.");
      await recordCityUpdate(data, user.email);
    } else if (payload.action === "record_ambassador") {
      if (!data.ambassadorId || !String(data.period || "").trim()) throw new Error("Informe o embaixador e o período.");
      await recordAmbassadorUpdate(data, user.email);
    } else {
      return Response.json({ error: "Ação inválida." }, { status: 400 });
    }
    return Response.json({ data: await getDashboardData(user.email) });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Não foi possível salvar.";
    const message = raw.includes("UNIQUE constraint failed")
      ? "Esse nome ou código já está cadastrado."
      : raw;
    return Response.json({ error: message }, { status: 400 });
  }
}
