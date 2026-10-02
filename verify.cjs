// Optional development checks. The app itself needs only index.html.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/katat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const KEY = 'eiken-body-trainer.learning.v1';
const results = [];
async function check(name, run) { await run(); results.push(name); console.log('PASS ' + name); }
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || 'C:/Users/katat/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
 try {
  const context = await browser.newContext({viewport:{width:1100,height:950}});
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const requests=[];
  page.on('request',r=>requests.push(r.url()));
  await page.goto('http://127.0.0.1:5173/');
  await check('single HTML, no external requests, valid unique question IDs', async()=>{
   assert(requests.every(u=>u.startsWith('http://127.0.0.1:5173/')));
   assert.equal(await page.evaluate(()=>QUESTIONS.length),26);
   assert.equal(await page.evaluate(()=>new Set(QUESTIONS.map(q=>q.id)).size),26);
   assert(!fs.readFileSync(path.join(__dirname,'index.html'),'utf8').match(/<script[^>]+src=|<link[^>]+href=|\bfetch\(|XMLHttpRequest|indexedDB/));
  });
  await page.screenshot({path:path.join(__dirname,'preview-desktop.png'),fullPage:true,animations:'disabled'});
  await page.locator('.navigation [data-view="study"]').click();
  await page.locator('[data-action="pattern"][data-pattern="A"]').click();
  await check('all slots initially hidden; only tapped slot opens; closing hides details',async()=>{
   assert.equal(await page.locator('#pattern-A .slot-toggle[aria-expanded="true"]').count(),0);
   await page.locator('[data-action="slot"][data-id="A-2"]').click();
   assert.equal(await page.locator('#pattern-A .slot-toggle[aria-expanded="true"]').count(),1);
   assert.equal(await page.locator('#answer-A-2').innerText(),'This allows A to V.');
   await page.locator('[data-action="detail"][data-id="A-2"][data-kind="explain"]').click();
   await page.locator('[data-action="detail"][data-id="A-2"][data-kind="examples"]').click();
   assert(await page.locator('#A-2-explain').isVisible());
   assert(await page.locator('#A-2-examples').isVisible());
   assert(!await page.locator('#A-2-alternatives').isVisible());
   await page.locator('[data-action="detail"][data-id="A-2"][data-kind="explain"]').click();
   assert(!await page.locator('#A-2-explain').isVisible());
   assert(await page.locator('#A-2-examples').isVisible());
   await page.locator('[data-action="detail"][data-id="A-2"][data-kind="alternatives"]').click();
   assert(await page.locator('#A-2-alternatives').isVisible());
   await page.locator('[data-action="slot"][data-id="A-2"]').click();
   assert(!await page.locator('#details-A-2').isVisible());
  });
  await check('show all / hide all / random hides exactly 1–3 rows, for every pattern',async()=>{
   for(const id of ['A','B','C']){
    if(id!=='A') await page.locator(`[data-action="pattern"][data-pattern="${id}"]`).click();
    await page.locator(`[data-action="all"][data-pattern="${id}"][data-show="yes"]`).click();
    assert.equal(await page.locator(`#pattern-${id} .slot-toggle[aria-expanded="true"]`).count(),4);
    await page.locator(`[data-action="all"][data-pattern="${id}"][data-show="no"]`).click();
    assert.equal(await page.locator(`#pattern-${id} .slot-toggle[aria-expanded="true"]`).count(),0);
    for(let n=0;n<8;n++){
     await page.locator(`[data-action="random"][data-pattern="${id}"]`).click();
     const open=await page.locator(`#pattern-${id} .slot-toggle[aria-expanded="true"]`).count();
     assert(open>=1&&open<=3);
    }
   }
  });
  await check('no answer or rating controls before reveal, for all 26 questions',async()=>{
   await page.locator('.navigation [data-view="test"]').click();
   const ids=await page.evaluate(()=>QUESTIONS.map(q=>q.id));
   for(const id of ids){
    await page.evaluate(id=>{current=QUESTIONS.find(q=>q.id===id);revealed=false;render();},id);
    assert.equal(await page.locator('[data-action="rate"]').count(),0);
    assert.equal(await page.locator('#test-answer .english').count(),0);
    const q=await page.evaluate(()=>({kind:current.kind,line:PATTERNS.find(p=>p.id===current.pattern).context[current.slot],base:PATTERNS.find(p=>p.id===current.pattern).slots[current.slot]?.base}));
    if(q.kind==='slot') assert(!(await page.locator('.test-card').innerText()).includes(q.line));
    if(q.kind==='whole') assert.equal(await page.locator('.test-card .english').count(),0);
    await page.locator('[data-action="reveal"]').click();
    assert(await page.locator('#test-answer').isVisible());
    assert.equal(await page.locator('[data-action="rate"]').count(),3);
    if(q.kind==='slot') assert((await page.locator('#test-answer').innerText()).includes(q.line));
    await page.locator('[data-action="reveal"]').click();
    assert.equal(await page.locator('#test-answer .english').count(),0);
   }
  });
  await check('self-evaluation saves counters and timestamp; survives reload',async()=>{
   await page.evaluate(()=>{state=emptyState();storageBlocked=false;filter='whole';patternFilter='A';startSession();render();});
   await page.locator('[data-action="reveal"]').click();
   await page.locator('[data-action="rate"][data-rating="fail"]').click();
   let saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
   assert.equal(saved.records['A-whole'].fail,1);
   assert.equal(saved.records['A-whole'].good,0);
   assert.equal(saved.records['A-whole'].unsure,0);
   assert.equal(saved.records['A-whole'].lastRating,'fail');
   assert(saved.records['A-whole'].asked>=1);
   assert(Number.isFinite(Date.parse(saved.records['A-whole'].lastStudy)));
   await page.reload();
   assert.equal(await page.evaluate(()=>state.records['A-whole'].fail),1);
   assert((await page.locator('.stats').innerText()).includes('1'));
  });
  await check('priority fail > unsure > unseen > good; avoids immediate repeats',async()=>{
   const result=await page.evaluate(()=>{
    const backup=state;state=emptyState();const pool=QUESTIONS.filter(q=>q.kind==='whole');
    const make=(lastRating)=>({asked:1,good:lastRating==='good'?1:0,unsure:lastRating==='unsure'?1:0,fail:lastRating==='fail'?1:0,lastRating,lastStudy:new Date().toISOString()});
    state.records['A-whole']=make('fail');state.records['B-whole']=make('unsure');
    const a=choose(pool,[]).id,b=choose(pool,['A-whole']).id;
    state.records['A-whole']=make('good');const c=choose(pool,[]).id;
    state.records['B-whole']=make('good');const d=choose(pool,[]).id;
    state=backup;return [a,b,c,d];
   });
   assert.deepEqual(result,['A-whole','B-whole','B-whole','C-whole']);
  });
  await check('10-question session, streak, filter behavior and completion',async()=>{
   await page.locator('.navigation [data-view="test"]').click();
   await page.locator('[data-action="filter"][data-filter="whole"]').click();
   await page.locator('#pattern-filter').selectOption('B');
   for(let i=0;i<10;i++){
    assert((await page.locator('#question-heading').innerText()).includes('B：'));
    await page.locator('[data-action="reveal"]').click();
    await page.locator('[data-action="rate"][data-rating="good"]').click();
   }
   assert((await page.locator('#question-heading').innerText()).includes('10問'));
   assert.equal(await page.evaluate(()=>state.streak),10);
   await page.locator('[data-action="continue"]').click();
   assert.equal(await page.locator('.counter').innerText(),'1 / 10');
   await page.locator('[data-action="filter"][data-filter="alt"]').click();
   assert.equal(await page.evaluate(()=>current.kind),'alt');
   await page.locator('#pattern-filter').selectOption('C');
   assert.equal(await page.evaluate(()=>current.pattern),'C');
  });
  await check('reset cancellation preserves records; confirmation resets only app data',async()=>{
   await page.locator('.navigation [data-view="home"]').click();
   const before=await page.evaluate(key=>localStorage.getItem(key),KEY);
   await page.evaluate(()=>localStorage.setItem('unrelated-check','keep'));
   page.once('dialog',d=>d.dismiss());await page.locator('[data-action="reset"]').click();
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),before);
   page.once('dialog',d=>d.accept());await page.locator('[data-action="reset"]').click();
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),null);
   assert.equal(await page.evaluate(()=>state.streak),0);
   assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-check')),'keep');
  });
  await check('keyboard buttons retain focus and work with Enter',async()=>{
   await page.locator('.navigation [data-view="study"]').click();
   if(await page.locator('[data-action="pattern"][data-pattern="A"]').getAttribute('aria-expanded')==='false') await page.locator('[data-action="pattern"][data-pattern="A"]').click();
   const slot=page.locator('[data-action="slot"][data-id="A-0"]');await slot.focus();
   const before=await slot.getAttribute('aria-expanded');await page.keyboard.press('Enter');
   assert.notEqual(await slot.getAttribute('aria-expanded'),before);
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.id),'A-0');
  });
  await check('no horizontal overflow at 320/360/390/768px on home, study, every test type',async()=>{
   for(const width of [320,360,390,768]){
    await page.setViewportSize({width,height:900});
    for(const v of ['home','study','test']){
     await page.locator(`.navigation [data-view="${v}"]`).click();
     if(v==='study'){
      for(const id of ['A','B','C']){
       if(await page.locator(`[data-action="pattern"][data-pattern="${id}"]`).getAttribute('aria-expanded')==='false') await page.locator(`[data-action="pattern"][data-pattern="${id}"]`).click();
       await page.locator(`[data-action="all"][data-pattern="${id}"][data-show="yes"]`).click();
      }
      await page.locator('[data-action="detail"][data-id="C-1"][data-kind="examples"]').click();
     }
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}/${v}`);
     if(v==='test') for(const kind of ['whole','slot','alt']){
      await page.locator(`[data-action="filter"][data-filter="${kind}"]`).click();
      await page.locator('[data-action="reveal"]').click();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}/${kind}`);
     }
    }
   }
  });
  await page.setViewportSize({width:390,height:844});
  await page.locator('.navigation [data-view="home"]').click();
  await page.screenshot({path:path.join(__dirname,'preview-mobile.png'),fullPage:true,animations:'disabled'});
  await page.emulateMedia({colorScheme:'dark'});
  await check('system dark mode and manual theme toggle',async()=>{
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()),'#17211d');
   await page.screenshot({path:path.join(__dirname,'preview-dark.png'),fullPage:true,animations:'disabled'});
   await page.locator('#theme').click();
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  });
  await page.locator('.navigation [data-view="study"]').click();
  await page.screenshot({path:path.join(__dirname,'preview-study.png'),fullPage:true,animations:'disabled'});
  await page.locator('.navigation [data-view="test"]').click();
  await page.screenshot({path:path.join(__dirname,'preview-test.png'),fullPage:true,animations:'disabled'});
  await check('offline operation after page loaded',async()=>{
   await context.setOffline(true);
   if(await page.locator('[data-action="reveal"]').getAttribute('aria-expanded')==='true') await page.locator('[data-action="reveal"]').click();
   await page.locator('[data-action="reveal"]').click();
   await page.locator('[data-action="rate"][data-rating="unsure"]').click();
   assert.equal(await page.evaluate(()=>Object.values(state.records).reduce((n,r)=>n+r.unsure,0)),1);
   await context.setOffline(false);
  });
  await check('corrupt storage is preserved until explicit reset',async()=>{
   await page.evaluate(key=>localStorage.setItem(key,'invalid-json'),KEY);
   await page.reload();assert(await page.locator('#storage-warning').isVisible());
   await page.locator('.navigation [data-view="test"]').click();
   await page.locator('[data-action="reveal"]').click();
   await page.locator('[data-action="rate"][data-rating="good"]').click();
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),'invalid-json');
   page.once('dialog',d=>d.accept());await page.locator('[data-action="reset"]').click();
   assert(!await page.locator('#storage-warning').isVisible());
  });
  await check('blocked storage degrades safely and displays a warning',async()=>{
   const blocked=await browser.newContext();await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});});
   const p=await blocked.newPage();await p.goto('http://127.0.0.1:5173/');
   assert(await p.locator('#storage-warning').isVisible());
   await p.locator('.navigation [data-view="test"]').click();await p.locator('[data-action="reveal"]').click();await p.locator('[data-action="rate"][data-rating="good"]').click();
   assert.equal(await p.evaluate(()=>state.streak),1);await blocked.close();
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(__dirname,'verification-results.json'),JSON.stringify({checkedAt:new Date().toISOString(),browser:process.env.CHROMIUM_PATH?.includes('Google')?'Google Chrome (Playwright)':'Chromium',url:'http://127.0.0.1:5173/',passed:results,consoleErrors:errors,fileProtocolTested:false,realAndroidDeviceTested:false},null,2));
  console.log(`Completed ${results.length} checks.`);
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
