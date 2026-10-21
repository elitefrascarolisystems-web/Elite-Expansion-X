import {z} from 'zod';
import {TEMPERATURES} from '@/lib/commercial';
export const PROSPECT_STATUSES=['A contatar','Convidado','Virou lead'] as const;
export const PROSPECT_SOURCES=['Agenda do celular (vCard)','Google Contatos (CSV)','Planilha (CSV)','Cadastro manual'] as const;
export const LEAD_CHANNELS=['Orgânico','Embaixador','Parceiro','Evento','Conteúdo','Mídia paga','Outro'] as const;
export const PROSPECT_BATCH=100,PROSPECT_LIMIT=5000,PROSPECT_PAGE=100;
export const DEFAULT_INVITE='Oi, {nome}! Tudo bem? Aqui é {meu_nome}, da Elite Frascaroli Academy. Posso te enviar algumas informações sobre o nosso trabalho? Se preferir não receber, é só me responder NÃO que eu não envio mais.';
// Brazilian numbers become 55 + DDD + subscriber (mobile always with the leading 9). Other countries keep their E.164 digits.
export function normalizePhone(raw:string,defaultDdd=''):string|null{
 const value=raw.trim().replace(/^tel:/i,''),international=/^(\+|00)/.test(value);let digits=value.replace(/\D/g,'');
 if(international){if(value.startsWith('00'))digits=digits.slice(2);if(!digits.startsWith('55'))return digits.length>=8&&digits.length<=15?digits:null;return brazil(digits.slice(2));}
 const trunk=digits.startsWith('0');digits=digits.replace(/^0+/,'');
 if(digits.startsWith('55')&&(digits.length===12||digits.length===13))return brazil(digits.slice(2));
 if(digits.length===10||digits.length===11)return brazil(digits);
 if(trunk&&(digits.length===12||digits.length===13))return brazil(digits.slice(2));
 if((digits.length===8||digits.length===9)&&/^[1-9]{2}$/.test(defaultDdd))return brazil(defaultDdd+digits);
 return null;
}
function brazil(national:string){
 if(!/^[1-9]{2}\d{8,9}$/.test(national))return null;
 if(national.length===10&&/[6-9]/.test(national[2]))national=national.slice(0,2)+'9'+national.slice(2);
 if(national.length===11&&national[2]!=='9')return null;
 return '55'+national;
}
// Forms elsewhere store whatever digits were typed, so a lead may hold the number with or without the country code.
export function phoneVariants(e164:string){return e164.startsWith('55')?[e164,e164.slice(2)]:[e164];}
export function formatPhone(e164:string){const m=/^55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);return m?`(${m[1]}) ${m[2]}-${m[3]}`:'+'+e164;}
export function whatsappLink(e164:string,text:string){return `https://wa.me/${e164}${text?'?text='+encodeURIComponent(text):''}`;}
const firstName=(v:string)=>v.trim().split(/\s+/)[0]||'';
export function renderInvite(template:string,contactName:string,senderName:string){return template.replaceAll('{nome}',firstName(contactName)).replaceAll('{meu_nome}',firstName(senderName)).trim();}
export function cleanTag(v:string){return v.replaceAll('|','/').replace(/\s+/g,' ').trim().slice(0,40);}
export function joinTags(tags:string[]){const list=[...new Set(tags.map(cleanTag).filter(Boolean))].slice(0,10);return list.length?'|'+list.join('|')+'|':'';}
export function splitTags(stored:string){return stored.split('|').filter(Boolean);}
const tag=z.string().max(80).transform(cleanTag).pipe(z.string().min(1,'Etiqueta vazia.'));
const tags=z.array(tag).max(10,'Use até 10 etiquetas.').default([]);
const optionalCity=z.number().int().positive().nullable().default(null);
export const contactDraftSchema=z.object({name:z.string().trim().max(160).default(''),phones:z.array(z.string().max(60)).max(5).default([]),email:z.string().trim().toLowerCase().max(254).pipe(z.union([z.literal(''),z.string().email()])).catch(''),tags:z.array(z.string().max(200)).max(20).default([]),note:z.string().max(2000).default('').transform(v=>v.trim().slice(0,500))});
export const importSchema=z.object({rows:z.array(contactDraftSchema).min(1).max(PROSPECT_BATCH,`Envie até ${PROSPECT_BATCH} contatos por lote.`),cityId:optionalCity,defaultDdd:z.string().regex(/^(|[1-9]{2})$/,'DDD padrão inválido.').default(''),extraTag:z.string().max(80).default(''),source:z.enum(PROSPECT_SOURCES),confirmed:z.boolean().default(false)});
export const updateSchema=z.object({id:z.string().uuid(),version:z.number().int().positive(),cityId:optionalCity,tags,temperature:z.enum(TEMPERATURES),status:z.enum(['A contatar','Convidado']),note:z.string().trim().max(500).default('')});
export const bulkSchema=z.object({ids:z.array(z.string().uuid()).min(1,'Selecione ao menos um contato.').max(PROSPECT_PAGE),cityId:z.number().int().positive().nullable().optional(),addTag:z.string().max(80).transform(cleanTag).optional()}).refine(v=>v.cityId!==undefined||Boolean(v.addTag),'Escolha a cidade ou a etiqueta a aplicar.');
export const convertSchema=z.object({id:z.string().uuid(),cityId:z.number({required_error:'Selecione a cidade do lead.'}).int().positive(),channel:z.enum(LEAD_CHANNELS),consentSource:z.string().trim().min(3,'Informe como a autorização foi recebida.').max(160),consentPurpose:z.string().trim().min(3,'Informe a finalidade informada à pessoa.').max(160),consentAccepted:z.literal(true,{errorMap:()=>({message:'Confirme que a pessoa autorizou o contato.'})})});
export const removeSchema=z.object({id:z.string().uuid(),optOut:z.boolean()});
export const contactedSchema=z.object({id:z.string().uuid()});
