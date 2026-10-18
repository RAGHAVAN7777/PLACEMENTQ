const {spawn}=require('node:child_process');
const path=require('node:path');
const children=[];
const env={...process.env,PLACEMENTIQ_PORT:'8879',PLACEMENTIQ_UI_URL:'http://127.0.0.1:3107',OLLAMA_BASE_URL:'http://127.0.0.1:9',PLACEMENTIQ_DATA_DIR:'server/data/test-runtime/demo-offline-browser'};
const run=(args)=>{const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});children.push(child);return child;};
async function wait(url){for(let i=0;i<80;i++){try{const r=await fetch(url);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error('Test server did not start: '+url);}
(async()=>{try{
  run(['server/src/server.mjs']);
  run(['frontend/node_modules/vite/bin/vite.js','frontend','--port','3107','--host','127.0.0.1','--strictPort']);
  await Promise.all([wait('http://127.0.0.1:8879/api/health'),wait('http://127.0.0.1:3107')]);
  const child=run([process.env.PLACEMENTIQ_UI_SCRIPT||'scripts/verify-demo-ui.cjs']);
  const code=await new Promise(r=>child.on('exit',r));if(code!==0)throw new Error('Browser verification failed');
}finally{for(const child of children)child.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
