import "@/lib/zod-pt";
import { asNullableNumber, asNumber, brazilTimestamp, database } from "@/db/runtime";
import { createOrganization, OrganizationError } from "@/db/organizations";
import type { AccessView } from "@/lib/expansion-types";
import { newSubscriberSchema, statusSchema, subscriptionSchema, type SubscriptionInput, type SubscriptionsData } from "@/lib/subscriptions";

/**
 * Gestão das empresas assinantes, só para os donos da plataforma: plano, valor,
 * vencimento, limites e suspensão. A cobrança em si acontece fora da plataforma.
 * A Elite (organização 1) nunca aparece aqui e nunca é suspensa.
 */
function requireOwner(access: AccessView) {
  if (!access.active || !access.isPlatformOwner) throw new OrganizationError("Somente os donos da plataforma gerenciam assinaturas.", 403);
}

const today = () => brazilTimestamp().slice(0, 10);

export async function getSubscriptions(access: AccessView): Promise<SubscriptionsData> {
  requireOwner(access);
  const db = database();
  const rows = (await db.prepare(`
    SELECT o.id,o.name,o.owner_email,o.active,o.created_at,
      s.plan,s.price_cents,s.paid_until,s.notes,
      e.user_limit,e.city_limit,e.imports,e.exports,e.external_maps,
      (SELECT name FROM app_users WHERE organization_id=o.id AND lower(email)=lower(o.owner_email)) AS owner_name,
      (SELECT count(*) FROM app_users WHERE organization_id=o.id AND active=1 AND role<>'Mentorado') AS users,
      (SELECT count(*) FROM app_users WHERE organization_id=o.id AND active=1 AND role='Mentorado') AS mentorados,
      (SELECT count(*) FROM cities WHERE organization_id=o.id AND status='Ativa') AS cities,
      (SELECT count(*) FROM territory_people p JOIN cities c ON c.id=p.city_id WHERE c.organization_id=o.id) AS people,
      (SELECT count(*) FROM leads l JOIN cities c ON c.id=l.city_id WHERE c.organization_id=o.id) AS leads,
      (SELECT max(created_at) FROM audit_logs WHERE organization_id=o.id) AS last_activity,
      (SELECT max(k.last_login_at) FROM user_credentials k JOIN app_users u ON lower(u.email)=lower(k.email) WHERE u.organization_id=o.id AND u.active=1) AS last_login,
      EXISTS(SELECT 1 FROM user_credentials k WHERE lower(k.email)=lower(o.owner_email)) AS owner_joined
    FROM organizations o
    LEFT JOIN organization_subscriptions s ON s.organization_id=o.id
    LEFT JOIN organization_entitlements e ON e.organization_id=o.id
    WHERE o.id<>1 ORDER BY o.active DESC, o.name LIMIT 500`).all()).results;
  const on = (value: unknown) => value == null || Number(value) === 1;
  const audit = (await db.prepare(`
    SELECT organization_id,actor_email,action,reason,created_at FROM platform_audit
    WHERE organization_id<>1 AND action IN ('create','subscription','suspend','reactivate') ORDER BY id DESC LIMIT 50`).all()).results;
  return {
    today: today(),
    subscribers: rows.map((r) => ({
      id: asNumber(r.id), name: String(r.name), ownerEmail: String(r.owner_email), ownerName: String(r.owner_name ?? ""),
      active: Number(r.active) === 1, createdAt: String(r.created_at),
      plan: String(r.plan ?? ""), priceCents: asNumber(r.price_cents), paidUntil: r.paid_until ? String(r.paid_until) : null, notes: String(r.notes ?? ""),
      userLimit: asNullableNumber(r.user_limit), cityLimit: asNullableNumber(r.city_limit),
      imports: on(r.imports), exports: on(r.exports), externalMaps: on(r.external_maps),
      users: asNumber(r.users), mentorados: asNumber(r.mentorados), cities: asNumber(r.cities), people: asNumber(r.people), leads: asNumber(r.leads),
      lastActivity: r.last_activity ? String(r.last_activity) : null, lastLogin: r.last_login ? String(r.last_login) : null,
      ownerJoined: Number(r.owner_joined) === 1,
    })),
    audit: audit.map((r) => ({ organizationId: asNumber(r.organization_id), actor: String(r.actor_email), action: String(r.action), reason: String(r.reason), at: String(r.created_at) })),
  };
}

async function clientOrganization(id: number) {
  if (id === 1) throw new OrganizationError("A organização da Elite não tem assinatura.");
  const row = (await database().prepare("SELECT id,name FROM organizations WHERE id=?").bind(id).all()).results[0];
  if (!row) throw new OrganizationError("Empresa não encontrada.", 404);
  return String(row.name);
}

function summary(v: SubscriptionInput) {
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v.priceCents / 100);
  const off = [!v.imports && "sem importação", !v.exports && "sem exportação", !v.externalMaps && "sem mapas externos"].filter(Boolean);
  return [v.plan || "Plano sem nome", money, v.paidUntil ? `pago até ${v.paidUntil.split("-").reverse().join("/")}` : "sem data de pagamento",
    `usuários: ${v.userLimit ?? "sem limite"}`, `cidades ativas: ${v.cityLimit ?? "sem limite"}`, ...off].join(" · ");
}

function saveStatements(actor: string, v: SubscriptionInput) {
  const db = database(), now = brazilTimestamp();
  return [
    db.prepare(`INSERT INTO organization_subscriptions(organization_id,plan,price_cents,paid_until,notes,updated_by,updated_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(organization_id) DO UPDATE SET plan=excluded.plan,price_cents=excluded.price_cents,paid_until=excluded.paid_until,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=excluded.updated_at`)
      .bind(v.organizationId, v.plan, v.priceCents, v.paidUntil, v.notes, actor, now),
    // Mapas e relatórios fazem parte de toda assinatura; o espaço para a logo continua como estava.
    db.prepare(`INSERT INTO organization_entitlements(organization_id,user_limit,city_limit,imports,exports,maps,external_maps,reports,updated_at) VALUES(?,?,?,?,?,1,?,1,?)
      ON CONFLICT(organization_id) DO UPDATE SET user_limit=excluded.user_limit,city_limit=excluded.city_limit,imports=excluded.imports,exports=excluded.exports,maps=1,external_maps=excluded.external_maps,reports=1,updated_at=excluded.updated_at`)
      .bind(v.organizationId, v.userLimit, v.cityLimit, Number(v.imports), Number(v.exports), Number(v.externalMaps), now),
    db.prepare("INSERT INTO platform_audit(organization_id,actor_email,action,reason,created_at) VALUES(?,?,'subscription',?,?)").bind(v.organizationId, actor, summary(v), now),
  ];
}

export async function saveSubscription(access: AccessView, input: unknown) {
  requireOwner(access);
  const v = subscriptionSchema.parse(input);
  await clientOrganization(v.organizationId);
  await database().batch(saveStatements(access.email.toLowerCase(), v));
  return { organizationId: v.organizationId };
}

/** Suspender corta o acesso de toda a empresa (equipe e assessoria); os dados ficam guardados. */
export async function setSubscriptionStatus(access: AccessView, input: unknown) {
  requireOwner(access);
  const v = statusSchema.parse(input);
  await clientOrganization(v.organizationId);
  const db = database(), now = brazilTimestamp();
  await db.batch([
    db.prepare("UPDATE organizations SET active=? WHERE id=?").bind(Number(v.active), v.organizationId),
    db.prepare("INSERT INTO platform_audit(organization_id,actor_email,action,reason,created_at) VALUES(?,?,?,?,?)").bind(v.organizationId, access.email.toLowerCase(), v.active ? "reactivate" : "suspend", v.reason, now),
  ]);
  return { organizationId: v.organizationId, active: v.active };
}

/** Nova empresa assinante: o ambiente vazio e o plano dela, de uma vez. */
export async function createSubscriber(access: AccessView, input: unknown) {
  requireOwner(access);
  const v = newSubscriberSchema.parse(input);
  const organizationId = await createOrganization(access, { name: v.name, ownerName: v.ownerName, ownerEmail: v.ownerEmail, requestId: v.requestId });
  await database().batch(saveStatements(access.email.toLowerCase(), { ...v, organizationId }));
  return { organizationId };
}
