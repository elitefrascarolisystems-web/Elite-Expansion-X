import "./zod-pt";
import {z} from 'zod';
import {BUSINESS_STATUSES,PLACE_TYPES,SECTORS} from './places';
export const STAGES=['Novo','Contato','Qualificado','Reunião','Proposta','Negociação','Ganho','Perdido'] as const;
/**
 * Na tela, a etapa do atendimento tem 5 passos. As etapas gravadas continuam as mesmas (nada é migrado):
 * Contato, Qualificado, Reunião e Negociação aparecem como "Em conversa"; escolher "Em conversa" grava "Contato"
 * (ou mantém a etapa intermediária que já estava gravada).
 */
export const STAGE_STEPS=['Novo','Em conversa','Proposta','Ganho','Perdido'] as const;
export type StageStep=(typeof STAGE_STEPS)[number];
const IN_TALK=new Set(['Contato','Qualificado','Reunião','Negociação']);
export const stageStep=(stage:string|null|undefined):string=>!stage?'':IN_TALK.has(stage)?'Em conversa':stage;
export const stageFromStep=(step:string,current?:string|null):(typeof STAGES)[number]=>step==='Em conversa'?(current&&IN_TALK.has(current)?current as (typeof STAGES)[number]:'Contato'):(STAGES as readonly string[]).includes(step)?step as (typeof STAGES)[number]:'Novo';
/** Venda: só as 3 situações de hoje. "Em negociação" e "Venda confirmada" ficam nos registros antigos, marcadas "(antiga)". */
export const SALE_STEPS=['Pagamento confirmado','Cancelada','Reembolsada'] as const;
export const OLD_SALE_STATUSES=['Em negociação','Venda confirmada'] as const;
export const saleStatusLabel=(status:string|null|undefined)=>!status?'':(OLD_SALE_STATUSES as readonly string[]).includes(status)?`${status} (antiga)`:status;
export const TEMPERATURES=['Frio','Morno','Quente'] as const;
export const ACTIVITY_KINDS=['Contato','Follow-up','Reunião','Proposta'] as const;
export const daySchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v,'Data inválida.');
const str=(n=200)=>z.string().trim().max(n);
export const businessSchema=z.object({id:z.string().uuid(),version:z.number().int().positive().optional(),cityId:z.number().int().positive(),name:str().min(2),segment:str(80).min(2),district:str().default(''),address:str(400).default(''),source:str().min(3),externalId:str().default(''),ownerEmail:z.string().email(),status:z.enum(BUSINESS_STATUSES),placeType:z.enum(PLACE_TYPES).default('Empresa'),sector:z.union([z.enum(SECTORS),z.literal('')]).default(''),nextAction:str(500).default(''),verified:z.boolean().default(false),publicBusiness:z.literal(true,{errorMap:()=>({message:'Confirme que são dados públicos de um estabelecimento.'})})});
export const opportunitySchema=z.object({id:z.string().uuid(),version:z.number().int().positive().optional(),leadId:z.number().int().positive(),businessId:z.string().uuid().nullable().default(null),ownerEmail:z.string().email(),temperature:z.enum(TEMPERATURES),stage:z.enum(STAGES),nextAction:str(500),dueDate:daySchema,lostReason:str(500).default('')}).refine(v=>v.stage!=='Perdido'||v.lostReason.length>=3,'Informe o motivo da perda.').refine(v=>['Ganho','Perdido'].includes(v.stage)||v.nextAction.length>=3,'Informe a próxima ação.');
export const activityInput=z.object({id:z.string().uuid(),opportunityId:z.string().uuid(),kind:z.enum(ACTIVITY_KINDS),note:str(1000).min(3),day:daySchema});
export const goalInput=z.object({cityId:z.number().int().positive(),ownerEmail:z.string().email(),day:daySchema,cold:z.number().int().min(0).max(10000),hot:z.number().int().min(0).max(10000),contacts:z.number().int().min(0).max(10000)});
export const reportInput=z.object({cityId:z.number().int().positive(),day:daySchema,blockers:str(2000).default(''),nextPlan:str(2000).min(3)});
export function businessIdentity(name:string,address:string){return [name,address].map(v=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')).join('|');}
export function csvCell(value:unknown){const s=String(value??'');return '"'+(/^[\s]*[=+@\-\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';}

export const decisionInput=z.object({id:z.string().uuid(),cityId:z.number().int().positive(),decision:z.enum(["Avançar","Ajustar","Corrigir","Pausar","Sem dados suficientes"]),reason:str(2000).min(10),nextAction:str(1000).min(3),reviewDate:daySchema});
