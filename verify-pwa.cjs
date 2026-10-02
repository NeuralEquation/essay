const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/katat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const checks=[];
let update=false;
const originalVersion=fs.readFileSync(path.join(__dirname,'sw.js'),'utf8').match(/const VERSION = '([^']+)'/)[1];
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(!url.pathname.startsWith('/essay/')){res.writeHead(404);res.end();return;}
 const name=url.pathname.slice('/essay/'.length)||'index.html';
 const allowed=['index.html','install.html','sw.js','app.webmanifest','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
 if(!allowed.includes(name)){res.writeHead(404);res.end();return;}
 let bytes=fs.readFileSync(path.join(__dirname,name));
 if(name==='sw.js'&&update)bytes=Buffer.from(bytes.toString().replace(/const VERSION = '[^']+';/,"const VERSION = 'test-update';"));
 res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript':name.endsWith('.png')?'image/png':'application/manifest+json');
 res.setHeader('Cache-Control','no-store');res.end(bytes);
});
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/essay/`;
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'eiken-pwa-')),{headless:true,viewport:{width:390,height:844},executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{if(!location.pathname.endsWith('/install.html'))addEventListener('beforeinstallprompt',e=>{e.preventDefault();e.stopImmediatePropagation();},true);});
  await page.goto(url);
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await check('worker activated with /essay/ scope; app shell cached',async()=>{
   assert.equal(await page.evaluate(async()=> (await navigator.serviceWorker.ready).scope),url);
   assert((await page.locator('#pwa-status').innerText()).includes('オフラインで使えます'));
   assert.equal(await page.evaluate(async()=>{const keys=await caches.keys();const c=await caches.open(keys.find(k=>k.startsWith('eiken-body-trainer:')));return(await c.keys()).length;}),6);
  });
  await check('valid standalone manifest, relative launch URL and raster icons',async()=>{
   const manifest=await (await context.request.get(url+'app.webmanifest')).json();
   assert.equal(manifest.display,'standalone');assert.equal(new URL(manifest.start_url,url).href,url+'index.html?launch=pwa');
   assert.equal(manifest.id,'/essay/');
   assert.equal(new URL(manifest.scope,url).href,url);assert.equal(manifest.icons.length,2);
   for(const icon of manifest.icons){const r=await context.request.get(new URL(icon.src,url).href);assert.equal(r.status(),200);const bytes=await r.body();const n=Number(icon.sizes.split('x')[0]);assert.equal(bytes.readUInt32BE(16),n);assert.equal(bytes.readUInt32BE(20),n);assert(icon.purpose.includes('maskable'));}
   const cdp=await context.newCDPSession(page);const installability=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors,[]);
   const parsed=await cdp.send('Page.getAppManifest');assert.equal(parsed.manifest.id,url);
  });
  await page.locator('.navigation [data-view="test"]').click();await page.locator('[data-action="reveal"]').click();await page.locator('[data-rating="good"]').click();
  await check('offline cold page open, query navigation, test and persisted progress',async()=>{
   await context.setOffline(true);await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);assert.equal(await page.evaluate(()=>state.streak),1);
   await page.goto(url+'index.html?offline=1');assert.equal(await page.evaluate(()=>state.streak),1);
   await page.locator('.navigation [data-view="test"]').click();await page.locator('[data-action="reveal"]').click();await page.locator('[data-rating="unsure"]').click();
   await page.reload();assert.equal(await page.evaluate(()=>Object.values(state.records).reduce((n,r)=>n+r.unsure,0)),1);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await context.setOffline(false);
  });
  await check('manual install help expands accessibly and remains within mobile width',async()=>{
   await page.evaluate(()=>{window.dispatchEvent(new Event('appinstalled'));document.querySelector('#pwa-install').hidden=false;});
   await page.locator('#pwa-install').click();assert(await page.locator('#pwa-help').isVisible());assert.equal(await page.locator('#pwa-install').getAttribute('aria-expanded'),'true');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#pwa-install').click();assert(!await page.locator('#pwa-help').isVisible());
  });
  await check('uncached installer uses distinct manifest URL, preserves records and handles install dismissal',async()=>{
   const stored=await page.evaluate(()=>localStorage.getItem('eiken-body-trainer.learning.v1'));
   await page.goto(url+'install.html');await page.waitForFunction(()=>document.querySelector('#install').disabled===false);
   const cdp=await context.newCDPSession(page);const manifest=await cdp.send('Page.getAppManifest');assert.equal(manifest.url,url+'app.webmanifest');assert.equal(manifest.manifest.id,url);assert.equal(manifest.manifest.startUrl,url+'index.html?launch=pwa');
   await page.evaluate(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.promptCalls=(window.promptCalls||0)+1;};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});
   await page.locator('#install').click();assert.equal(await page.evaluate(()=>window.promptCalls),1);assert((await page.locator('#status').innerText()).includes('キャンセル'));
   assert.equal(await page.evaluate(()=>localStorage.getItem('eiken-body-trainer.learning.v1')),stored);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.equal(JSON.parse(await page.locator('#diagnostics').textContent()).appId,'/essay/');
   await page.goto(url);
  });
  await check('updated worker waits for user; update preserves learning and other caches',async()=>{
   await page.evaluate(async()=>{await caches.open('other-pwa-cache');});
   const stored=await page.evaluate(()=>localStorage.getItem('eiken-body-trainer.learning.v1'));
   update=true;await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
   await page.locator('#pwa-update').waitFor({state:'visible'});
   assert.equal(await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.waiting?.state;}),'installed');
   await Promise.all([page.waitForNavigation(),page.locator('#pwa-update').click()]);
   assert.equal(await page.evaluate(()=>localStorage.getItem('eiken-body-trainer.learning.v1')),stored);
   const keys=await page.evaluate(()=>caches.keys());assert(keys.includes('other-pwa-cache'));assert(keys.some(k=>k.endsWith(':test-update')));assert(!keys.some(k=>k.startsWith('eiken-body-trainer:')&&k.endsWith(':'+originalVersion)));
   await context.setOffline(true);await page.reload();assert.equal(await page.evaluate(()=>localStorage.getItem('eiken-body-trainer.learning.v1')),stored);await context.setOffline(false);
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(__dirname,'pwa-verification-results.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:'Google Chrome (Playwright)',scope:'/essay/',passed:checks,consoleErrors:errors,realDeviceInstallTested:false},null,2));
 }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
