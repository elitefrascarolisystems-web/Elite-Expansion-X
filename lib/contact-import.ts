import {parseCsv} from '@/lib/commercial-import';
import {PROSPECT_LIMIT,type PROSPECT_SOURCES} from '@/lib/prospects';
export type ContactDraft={name:string;phones:string[];email:string;tags:string[];note:string};
export type ParsedContacts={source:(typeof PROSPECT_SOURCES)[number];contacts:ContactDraft[];skipped:number};
const MOBILE=/cell|mobile|celular|iphone|whatsapp|principal|main/i;
// Address-book bookkeeping labels, not groups the person created.
const SYSTEM_TAGS=/^\*?\s*(mycontacts|my contacts|starred|meus contatos|com estrela)$/i;
function decodeQuotedPrintable(value:string,charset:string){
 const bytes:number[]=[],encoder=new TextEncoder();for(let i=0;i<value.length;i++){const c=value[i];if(c==='='&&/^[0-9A-F]{2}$/i.test(value.slice(i+1,i+3))){bytes.push(parseInt(value.slice(i+1,i+3),16));i+=2;}else bytes.push(...encoder.encode(c));}
 try{return new TextDecoder(charset||'utf-8').decode(new Uint8Array(bytes));}catch{return new TextDecoder().decode(new Uint8Array(bytes));}
}
const unescape=(v:string)=>v.replace(/\\([\\,;nN])/g,(_,c:string)=>c.toLowerCase()==='n'?' ':c);
function splitUnescaped(v:string,sep:string){const parts:string[]=[];let current='';for(let i=0;i<v.length;i++){if(v[i]==='\\'&&i+1<v.length){current+=v[i]+v[i+1];i++;}else if(v[i]===sep){parts.push(current);current='';}else current+=v[i];}parts.push(current);return parts.map(unescape);}
function finish(card:{name:string;org:string;phones:{value:string;mobile:boolean}[];emails:string[];tags:string[];note:string}):ContactDraft|null{
 const phones=[...card.phones.filter(p=>p.mobile),...card.phones.filter(p=>!p.mobile)].map(p=>p.value.trim()).filter(Boolean);
 if(!phones.length)return null;
 return {name:(card.name||card.org).replace(/\s+/g,' ').trim().slice(0,160),phones:[...new Set(phones)].slice(0,5),email:card.emails[0]||'',tags:card.tags.map(t=>t.trim()).filter(t=>t&&!SYSTEM_TAGS.test(t)),note:card.note.slice(0,500)};
}
// vCard 2.1 (Android, with quoted-printable), 3.0 (iPhone/iCloud) and 4.0. Photos are ignored.
export function parseVcf(text:string):{contacts:ContactDraft[];skipped:number}{
 const raw=text.replace(/\r\n?/g,'\n').replace(/\n[ \t]/g,'').split('\n'),contacts:ContactDraft[]=[];let skipped=0;
 let card:Parameters<typeof finish>[0]|null=null;
 for(let i=0;i<raw.length;i++){
  let line=raw[i];const colon=line.indexOf(':');if(colon<0)continue;
  const head=line.slice(0,colon),params=head.split(';'),prop=params[0].replace(/^[^.]*\./,'').toUpperCase();
  const qp=params.some(p=>/^(ENCODING=)?QUOTED-PRINTABLE$/i.test(p));
  if(qp)while(line.endsWith('=')&&i+1<raw.length)line=line.slice(0,-1)+raw[++i];
  let value=line.slice(colon+1);
  if(prop==='BEGIN'&&/^VCARD$/i.test(value.trim())){card={name:'',org:'',phones:[],emails:[],tags:[],note:''};continue;}
  if(!card)continue;
  if(prop==='END'){const done=finish(card);if(done)contacts.push(done);else skipped++;card=null;if(contacts.length>PROSPECT_LIMIT)throw new Error(`O arquivo tem mais de ${PROSPECT_LIMIT} contatos. Divida-o antes de importar.`);continue;}
  if(params.some(p=>/^ENCODING=(B|BASE64)$/i.test(p)))continue;
  if(qp)value=decodeQuotedPrintable(value,params.find(p=>/^CHARSET=/i.test(p))?.split('=')[1]??'utf-8');
  const types=params.slice(1).join(';');
  if(prop==='FN')card.name=unescape(value).trim();
  else if(prop==='N'&&!card.name){const [family='',given='',middle='']=splitUnescaped(value,';');card.name=[given,middle,family].join(' ').trim();}
  else if(prop==='ORG')card.org=splitUnescaped(value,';')[0].trim();
  else if(prop==='TEL')card.phones.push({value:value.replace(/^tel:/i,''),mobile:MOBILE.test(types)});
  else if(prop==='EMAIL')card.emails.push(value.trim().toLowerCase());
  else if(prop==='CATEGORIES')card.tags.push(...splitUnescaped(value,','));
  else if(prop==='NOTE')card.note=unescape(value).trim();
 }
 return {contacts,skipped};
}
const header=(h:string)=>h.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
// Google Contatos (new and legacy exports), Outlook and hand-made sheets with Nome/Telefone columns.
export function parseContactCsv(text:string):{contacts:ContactDraft[];skipped:number;google:boolean}{
 const grid=parseCsv(text,{rows:PROSPECT_LIMIT,columns:300,bytes:5_000_000}),heads=grid[0].map(header);
 const find=(re:RegExp)=>heads.findIndex(h=>re.test(h));
 const full=find(/^(name|nome|nome completo|full name|display name)$/),first=find(/^(first name|given name|primeiro nome)$/),middle=find(/^(middle name|additional name|nome do meio)$/),last=find(/^(last name|family name|sobrenome|ultimo nome)$/),org=find(/^(organization name|organization 1 - name|company|empresa)$/);
 const phones=heads.map((h,i)=>({h,i})).filter(({h})=>/(phone|telefone|celular|whatsapp|mobile|fone)/.test(h)&&!/(label|type|tipo|rotulo)/.test(h));
 const emails=heads.map((h,i)=>({h,i})).filter(({h})=>/e-?mail/.test(h)&&!/(label|type|tipo|rotulo)/.test(h));
 const tagCol=find(/^(labels|group membership|categories|categorias|etiquetas|tags|marcadores|grupos?)$/),note=find(/^(notes|notas|observacoes|observacao|obs)$/);
 if(!phones.length)throw new Error('Nenhuma coluna de telefone encontrada. Use uma coluna chamada Telefone, Celular ou WhatsApp.');
 if(full<0&&first<0&&last<0&&org<0)throw new Error('Nenhuma coluna de nome encontrada. Use uma coluna chamada Nome.');
 // Localized Outlook exports call the first name "Nome" next to a "Sobrenome" column.
 const fullIsFirst=full>=0&&heads[full]==='nome'&&last>=0&&first<0,fullCol=fullIsFirst?-1:full,firstCol=fullIsFirst?full:first;
 const contacts:ContactDraft[]=[];let skipped=0;
 for(const row of grid.slice(1)){
  const cell=(i:number)=>i<0?'':row[i]??'';
  const name=cell(fullCol)||[cell(firstCol),cell(middle),cell(last)].filter(Boolean).join(' ');
  // Google keeps several values in one cell separated by ":::" and the label in the neighbouring "- Label" column.
  const list=phones.flatMap(({h,i})=>{const label=heads[i-1]?.replace(/ - (label|type)$/,'')===h.replace(/ - value$/,'')?cell(i-1):'';return cell(i).split(':::').map(v=>({value:v,mobile:MOBILE.test(h)||MOBILE.test(label)}));});
  const done=finish({name,org:cell(org),phones:list,emails:emails.flatMap(({i})=>cell(i).split(':::').map(v=>v.trim().toLowerCase())).filter(Boolean),tags:cell(tagCol).split(/:::|[,;]/),note:cell(note)});
  if(done)contacts.push(done);else skipped++;
 }
 return {contacts,skipped,google:heads.some(h=>/ - value$/.test(h))};
}
export async function parseContactFile(file:File):Promise<ParsedContacts>{
 if(/\.(vcf|vcard)$/i.test(file.name)){if(file.size>30_000_000)throw new Error('Limite: 30 MB. Exporte os contatos sem fotos ou divida o arquivo.');return {source:'Agenda do celular (vCard)',...parseVcf(await file.text())};}
 if(/\.csv$/i.test(file.name)){if(file.size>5_000_000)throw new Error('Limite: 5 MB.');const r=parseContactCsv(await file.text());return {source:r.google?'Google Contatos (CSV)':'Planilha (CSV)',contacts:r.contacts,skipped:r.skipped};}
 throw new Error('Selecione o arquivo .vcf exportado da agenda ou o .csv do Google Contatos.');
}
