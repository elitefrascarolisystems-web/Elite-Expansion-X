export function parseCsv(text:string):string[][]{
 if(text.length>1_000_000)throw new Error('Arquivo muito grande. Limite: 1 MB.');
 const first=text.split(/\r?\n/,1)[0],sep=first.includes(';')?';':',';const rows:string[][]=[];let row:string[]=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else if(!value||quoted)quoted=!quoted;else throw new Error('Aspas inválidas no CSV.');}else if(c===sep&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';}else value+=c;if(rows.length>51)throw new Error('Limite de 50 registros por arquivo.');}
 if(quoted)throw new Error('Aspas não fechadas no CSV.');row.push(value);if(row.some(v=>v.trim()))rows.push(row);return validateGrid(rows);
}
function validateGrid(rows:string[][]){if(rows.length<2||rows.length>51||rows.some(r=>r.length>30||r.some(c=>c.length>2000)))throw new Error('Use cabeçalho e até 50 linhas, com até 30 colunas.');return rows.map(r=>r.map(v=>v.replace(/^\uFEFF/,'').trim()));}
export async function parseBusinessFile(file:File){
 if(file.size>1_000_000)throw new Error('Limite: 1 MB.');if(/\.csv$/i.test(file.name))return parseCsv(await file.text());if(!/\.xlsx$/i.test(file.name))throw new Error('Selecione CSV ou XLSX, sem macros.');
 const {unzipSync,strFromU8}=await import('fflate');let total=0;
 const zip=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:f=>{if(!/^xl\/(sharedStrings\.xml|worksheets\/sheet[0-9]+\.xml)$/.test(f.name))return false;total+=f.originalSize;if(total>4_000_000||f.originalSize>2_000_000)throw new Error('Planilha descompactada excede o limite.');return true;}});
 const xml=(text:string)=>{if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('Conteúdo XML não permitido.');const d=new DOMParser().parseFromString(text,'application/xml');if(d.querySelector('parsererror'))throw new Error('Planilha inválida.');return d;};
 const shared=zip['xl/sharedStrings.xml']?Array.from(xml(strFromU8(zip['xl/sharedStrings.xml'])).getElementsByTagName('si')).map(e=>e.textContent||''):[];
 const name=Object.keys(zip).filter(k=>k.startsWith('xl/worksheets/')).sort()[0];if(!name)throw new Error('Nenhuma planilha encontrada.');const sheet=xml(strFromU8(zip[name]));if(sheet.getElementsByTagName('f').length)throw new Error('Remova as fórmulas antes de importar.');
 const rows=Array.from(sheet.getElementsByTagName('row')).map(r=>{const row:string[]=[];for(const c of Array.from(r.getElementsByTagName('c'))){const letters=(c.getAttribute('r')||'A').replace(/[0-9]/g,'');let index=0;for(const char of letters)index=index*26+char.charCodeAt(0)-64;if(index<1||index>30)throw new Error('Limite de 30 colunas.');const value=c.getElementsByTagName('v')[0]?.textContent||c.getElementsByTagName('t')[0]?.textContent||'';row[index-1]=c.getAttribute('t')==='s'?shared[Number(value)]||'':value;}return Array.from({length:row.length},(_,i)=>row[i]||'');}).filter(r=>r.some(Boolean));return validateGrid(rows);
}
