import {spawn} from 'node:child_process';
import {open,mkdir,unlink} from 'node:fs/promises';
const mode=process.argv[2];
if(!['install','build'].includes(mode))throw Error('Modo inválido');
await mkdir('.sites-runtime',{recursive:true});
const lock='.sites-runtime/'+mode+'-portable.lock';
const handle=await open(lock,'wx');
try {
 const args=mode==='install'?['ci','--cache','.sites-runtime/npm-cache','--no-audit','--no-fund']:['node_modules/vinext/dist/cli.js','build'];
 const child=spawn(mode==='install'?'npm':process.execPath,args,{stdio:'inherit',env:{...process.env,WRANGLER_LOG_PATH:'.wrangler/logs',WRANGLER_SEND_METRICS:'false'}});
 const timer=setTimeout(()=>child.kill('SIGTERM'),mode==='install'?480000:180000);
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code??1));});
 clearTimeout(timer);process.exitCode=code;
}finally{await handle.close();await unlink(lock);}
