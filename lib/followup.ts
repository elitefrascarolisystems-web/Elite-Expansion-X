import "./zod-pt";
import {z} from 'zod';
export const FECHA_LABELS={pending:'Pagamento pendente',blocker:'Trava identificada',resolved:'Trava resolvida',link:'Link reenviado',future:'Retomada futura',paid:'Pago'};
export const BLOCKERS=['Dinheiro','Limite / cartão','Dúvida','Medo / insegurança','Prioridade'] as const;
export const AFTERCARE=['Boas-vindas','Acompanhamento','Indicação convidada','Concluído'] as const;
export type Followup={dueAt?:string;channel?:string;aftercare?:string;fecha?:{status:keyof typeof FECHA_LABELS;startedAt:string;deadlineAt:string;evidence:string;blocker?:string;resolution?:string;agreedAt?:string}};
export type FollowupRow={temperature?:string;business_id?:string|null;lost_reason?:string;id:string;lead_id:number;person_id:string;lead_name:string;city_id:number;city_name:string;owner_email:string;owner_name:string;stage:string;next_action:string;due_date:string;version:number;channel:string;source_label:string;payment_status:string|null;paid_at:string|null;amount_cents:number|null;followup:Followup;fechaStatus:keyof typeof FECHA_LABELS|null;dueAt:string|null;last_contact:string|null;};
export const commandSchema=z.object({requestId:z.string().uuid(),opportunityId:z.string().uuid(),version:z.number().int().positive(),action:z.enum(['contact','start','identify','resolve','link','date','wait','future','resume','aftercare']),note:z.string().trim().min(3).max(1500),channel:z.enum(['WhatsApp','Ligação','E-mail','Reunião','Visita','Outro']).default('WhatsApp'),dueAt:z.string().datetime({offset:true}).optional(),nextAction:z.string().trim().max(500).default(''),blocker:z.enum(BLOCKERS).optional(),aftercare:z.enum(AFTERCARE).optional(),unpaid:z.boolean().optional()});
export function fechaStatus(f:Followup,paid:boolean,now=Date.now()) {if(!f.fecha)return null;if(paid)return 'paid';if(f.fecha.status==='future')return 'future';return !f.fecha.agreedAt&&Date.parse(f.fecha.deadlineAt)<=now?'future':f.fecha.status;}
export function transition(previous:Followup,v:z.infer<typeof commandSchema>,paid:boolean,stage:string,now=Date.now()):Followup {
 const f:Followup=structuredClone(previous),current=fechaStatus(f,paid,now);const need=(ok:unknown,m:string)=>{if(!ok)throw Error(m);};
 need(stage!=='Perdido','Oportunidade encerrada como perdida.');
 if(v.action==='aftercare'){need(paid,'Pós-venda exige pagamento confirmado no cadastro de vendas.');need(v.aftercare,'Selecione a etapa do pós-venda.');f.aftercare=v.aftercare;if(v.aftercare==='Concluído'){delete f.dueAt;return f;}}
 else if(v.action==='start'){need(!f.fecha,'O FECHA já foi iniciado.');need(!paid&&v.unpaid,'Confirme que houve decisão de entrada e o pagamento está pendente.');f.fecha={status:'pending',startedAt:new Date(now).toISOString(),deadlineAt:new Date(now+72*3600000).toISOString(),evidence:v.note};}
 else if(v.action!=='contact'){
  need(f.fecha&&!paid,'O FECHA exige pagamento pendente e rodada iniciada.');const c=f.fecha!;
  if(v.action==='future'){c.status='future';delete c.agreedAt;delete f.dueAt;return f;}
  if(v.action==='resume'){need(current==='future','Esta rodada ainda está em andamento.');c.status=c.resolution?'resolved':c.blocker?'blocker':'pending';c.agreedAt=v.dueAt;}
  else {need(current!=='future','A rodada terminou. Use Retomar com data combinada.');
   if(v.action==='identify'){need(v.blocker,'Registre a trava confirmada pela pessoa.');c.blocker=v.blocker;c.status='blocker';delete c.resolution;}
   if(v.action==='resolve'){need(c.status==='blocker','Identifique a trava antes de registrar a solução.');c.resolution=v.note;c.status='resolved';}
   if(v.action==='link'){need(['resolved','link'].includes(c.status),'Resolva a trava antes de reenviar o link.');c.status='link';}
   if(v.action==='date')c.agreedAt=v.dueAt;
  }
 }else if(f.fecha&&!paid){need(false,'Atualize esta oportunidade pelas ações do método FECHA.');}
 if(v.action==='contact'&&paid&&(!f.aftercare||f.aftercare==='Concluído'))f.aftercare='Acompanhamento';
 need(v.dueAt&&Date.parse(v.dueAt)>now,'Informe uma data e um horário futuros.');need(v.nextAction.length>=3,'Defina a próxima ação.');
 if(f.fecha&&!paid){if(f.fecha.agreedAt)need(v.dueAt===f.fecha.agreedAt,'Use Marcar data combinada para alterar o compromisso.');else need(Date.parse(v.dueAt!)<=Date.parse(f.fecha.deadlineAt),'Agende dentro das 72 horas ou use Marcar data combinada.');}
 f.dueAt=v.dueAt;f.channel=v.channel;return f;
}
/**
 * A mesma regra de rowDue, em SQL, para contadores agregados (ex.: atrasos da equipe):
 * fica fora do retorno ativo quem já pagou sem pós-venda, quem concluiu o pós-venda e a
 * rodada F.E.C.H.A. encerrada ou vencida sem data combinada. Recebe 1 parâmetro: agora (ISO).
 */
export function followupInactiveSql(o:string,s:string){
 const f=(path:string)=>`json_extract(${o}.followup_json,'$.${path}')`;
 return `COALESCE(((${s}.status='Pagamento confirmado' AND ${s}.paid_at IS NOT NULL AND ${f('aftercare')} IS NULL) OR COALESCE(${f('aftercare')},'')='Concluído' OR ${f('fecha.status')}='future' OR (${f('fecha.status')} IS NOT NULL AND ${f('fecha.status')}<>'paid' AND ${f('fecha.agreedAt')} IS NULL AND ${f('fecha.deadlineAt')}<=?)),0)`;
}
export function rowDue(row:{followup:Followup;due_date:string;stage:string;payment_status:string|null;paid_at:string|null},now=Date.now()){
 const paid=row.payment_status==='Pagamento confirmado'&&!!row.paid_at;
 if(row.stage==='Perdido'||fechaStatus(row.followup,paid,now)==='future'||row.followup.aftercare==='Concluído')return null;
 if(paid&&!row.followup.aftercare)return null;
 return row.followup.dueAt||(!['Ganho','Perdido'].includes(row.stage)?row.due_date+'T23:59:59-03:00':null);
}
