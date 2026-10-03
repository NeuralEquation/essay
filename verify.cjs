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
  await check('embedded learning app, only local PWA assets, valid unique question IDs', async()=>{
   assert(requests.every(u=>u.startsWith('http://127.0.0.1:5173/')));
   assert.equal(await page.evaluate(()=>QUESTIONS.length),26);
   assert.equal(await page.evaluate(()=>new Set(QUESTIONS.map(q=>q.id)).size),26);
   assert(!fs.readFileSync(path.join(__dirname,'index.html'),'utf8').match(/<script[^>]+src=|<link[^>]+href=["']https?:|\bfetch\(|XMLHttpRequest|indexedDB/));
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
  await check('C learning card shows the new four bases, including both conditional forms',async()=>{
   const before=await page.evaluate(()=>QUESTIONS.map(q=>q.id));
   assert.equal(new Set(before).size,26);
   assert.deepEqual(await page.evaluate(()=>QUESTIONS.filter(q=>q.pattern==='C').map(q=>q.id)),['C-whole','C-slot-0','C-slot-1','C-slot-2','C-slot-3','C-alt-0','C-alt-1','C-alt-2','C-alt-3']);
   if(await page.locator('[data-action="pattern"][data-pattern="C"]').getAttribute('aria-expanded')==='false') await page.locator('[data-action="pattern"][data-pattern="C"]').click();
   await page.locator('[data-action="all"][data-pattern="C"][data-show="yes"]').click();
   const slots=page.locator('#pattern-C .slot-toggle .english');
   assert.deepEqual(await slots.allInnerTexts(),['Finally, ...','When ..., S can ...\nIf ..., S can/could ...','By -ing, S can/could ...','This would help ...']);
   assert.equal(await page.locator('#pattern-C .slot-toggle[aria-expanded="true"]').count(),4);
   await page.locator('[data-action="all"][data-pattern="C"][data-show="no"]').click();
   assert.equal(await page.locator('#pattern-C .slot-toggle[aria-expanded="false"]').count(),4);
   await page.locator('[data-action="slot"][data-id="C-1"]').click();
   assert.equal(await page.locator('#pattern-C .slot-toggle[aria-expanded="true"]').count(),1);
   await page.locator('[data-action="detail"][data-id="C-1"][data-kind="explain"]').click();
   assert.equal(await page.locator('[data-action="detail"][data-id="C-1"][data-kind="alternatives"]').innerText(),'助動詞ルールを見る');
   const explanation=await page.locator('#C-1-explain').innerText();
   for(const rule of ['When + 現在形','後半は基本 can','If + 現在形','can または could','If + 過去形, would'])assert(explanation.includes(rule),rule);
   await page.locator('[data-action="detail"][data-id="C-1"][data-kind="examples"]').click();
   for(const example of ['When people have access','schools can improve','schools could improve'])assert((await page.locator('#C-1-examples').innerText()).includes(example),example);
   await page.locator('[data-action="slot"][data-id="C-1"]').click();
   assert.equal(await page.locator('#pattern-C .slot-toggle[aria-expanded="true"]').count(),0);
   await page.locator('[data-action="slot"][data-id="C-2"]').click();
   await page.locator('[data-action="detail"][data-id="C-2"][data-kind="explain"]').click();
   const means=await page.locator('#C-2-explain').innerText();
   assert(means.includes('一般的・実際の効果なら can'));assert(means.includes('控えめな可能性なら could'));
   await page.locator('[data-action="detail"][data-id="C-2"][data-kind="examples"]').click();
   const examples=await page.locator('#C-2-examples').innerText();assert(examples.includes('governments can reduce traffic congestion'));assert(examples.includes('governments could improve access to education'));
   await page.locator('[data-action="slot"][data-id="C-2"]').click();
   await page.locator('[data-action="slot"][data-id="C-3"]').click();
   await page.locator('[data-action="detail"][data-id="C-3"][data-kind="explain"]').click();
   assert((await page.locator('#C-3-explain').innerText()).includes('まず覚える基本形'));
   await page.locator('[data-action="detail"][data-id="C-3"][data-kind="examples"]').click();
   assert((await page.locator('#C-3-examples').innerText()).includes('This would help protect public health.'));
   const idsAfter=await page.evaluate(()=>QUESTIONS.map(q=>q.id));assert.deepEqual(idsAfter,before);
   assert.deepEqual(await page.evaluate(()=>PATTERNS.filter(p=>p.id==='A'||p.id==='B').map(p=>p.slots.map(s=>s.base))),[
    ['First of all, ...','S + V ...','This allows A to V.','As a result, ...'],
    ['Additionally, ...','V-ing ... can ...','This, in turn, can ...','Such an improvement can ...']
   ]);
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
    if(id==='C-whole') for(const answer of ['Finally, ...','When ..., S can ...','If ..., S can/could ...','By -ing, S can/could ...','This would help ...'])assert(!(await page.locator('.test-card').innerText()).includes(answer));
    if(id==='C-alt-1')assert(!(await page.locator('.test-card').innerText()).includes('When + 現在形'));
    if(id==='C-alt-2')assert(!(await page.locator('.test-card').innerText()).includes('By -ingの後の助動詞'));
    await page.locator('[data-action="reveal"]').click();
    assert(await page.locator('#test-answer').isVisible());
    assert.equal(await page.locator('[data-action="rate"]').count(),3);
    if(q.kind==='slot') assert((await page.locator('#test-answer').innerText()).includes(q.line));
    if(id==='C-whole'){
     for(const answer of ['Finally, ...','When ..., S can ...','If ..., S can/could ...','By -ing, S can/could ...','This would help ...'])assert((await page.locator('#test-answer').innerText()).includes(answer));
     assert((await page.locator('#test-answer .context-row').nth(1).innerText()).includes('\nIf ..., S can/could ...'));
    }
    if(id==='C-alt-1')for(const answer of ['When + 現在形 → 後半は基本 can','If + 現在形 → 後半は can / could'])assert((await page.locator('#test-answer').innerText()).includes(answer));
    if(id==='C-alt-2')for(const answer of ['一般的・実際の効果 → can','少し控えめな可能性 → could'])assert((await page.locator('#test-answer').innerText()).includes(answer));
    await page.locator('[data-action="reveal"]').click();
    assert.equal(await page.locator('#test-answer .english').count(),0);
   }
  });
  await check('self-evaluation saves counters and timestamp; survives reload',async()=>{
   await page.evaluate(()=>{state=emptyState();state.records['C-alt-1']={asked:4,good:2,unsure:1,fail:1,lastRating:'unsure',lastStudy:'2026-10-02T10:00:00.000Z'};state.records['C-alt-2']={asked:2,good:2,unsure:0,fail:0,lastRating:'good',lastStudy:'2026-10-02T10:05:00.000Z'};storageBlocked=false;save();filter='whole';patternFilter='A';startSession();render();});
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
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).records['C-alt-1'].unsure),1);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(KEY)).records['C-alt-2'].good),2);
   await page.locator('.navigation [data-view="home"]').click();
   assert.match(await page.locator('.stat strong').first().innerText(),/^3/);
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
  await check('mobile navigation, controls and install panel fit without covering content',async()=>{
   for(const width of [320,360,390]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.locator('.navigation').evaluate(e=>getComputedStyle(e).position),'fixed');
    const nav=await page.locator('.navigation').boundingBox();assert(Math.abs(nav.y+nav.height-844)<2);
    const layout=await page.evaluate(()=>({main:document.querySelector('main').getBoundingClientRect().bottom,pwa:document.querySelector('.pwa-panel').getBoundingClientRect().top}));assert(layout.pwa>=layout.main);
    for(const box of await page.locator('.navigation button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height)))assert(box>=44);
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
    const reset=await page.locator('[data-action="reset"]').boundingBox();assert(reset.y+reset.height<=nav.y);
   }
   await page.setViewportSize({width:1100,height:950});
   assert.equal(await page.locator('.navigation').evaluate(e=>getComputedStyle(e).position),'static');
   assert.equal(await page.locator('.nav-icon').first().evaluate(e=>getComputedStyle(e).display),'none');
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
  });
  await page.screenshot({path:path.join(__dirname,'preview-mobile.png'),fullPage:true,animations:'disabled'});
  await page.screenshot({path:path.join(__dirname,'preview-mobile-screen.png'),animations:'disabled'});
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
  await check('theme, study details and per-view position survive reload and tab reopen',async()=>{
   await page.emulateMedia({colorScheme:'light'});
   if(await page.evaluate(()=>document.documentElement.dataset.theme)!=='dark')await page.locator('#theme').click();
   await page.locator('.navigation [data-view="study"]').click();
   for(const id of ['A','B','C']){
    if(await page.locator(`[data-action="pattern"][data-pattern="${id}"]`).getAttribute('aria-expanded')==='false')await page.locator(`[data-action="pattern"][data-pattern="${id}"]`).click();
    await page.locator(`[data-action="all"][data-pattern="${id}"][data-show="yes"]`).click();
   }
   await page.locator('[data-action="detail"][data-id="C-1"][data-kind="explain"]').click();
   const records=await page.evaluate(key=>localStorage.getItem(key),KEY);
   await page.evaluate(()=>window.scrollTo(0,900));
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('eiken-body-trainer.ui.v1')).scrollPositions.study>800);
   const y=await page.evaluate(()=>scrollY);
   await page.reload();
   await page.waitForFunction(y=>view==='study'&&Math.abs(scrollY-y)<3,y);
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
   assert(await page.locator('#C-1-explain').isVisible());
   assert.equal(await page.locator('#pattern-C .slot-toggle[aria-expanded="true"]').count(),4);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),KEY),records);
   await page.evaluate(()=>document.querySelector('.navigation [data-view="home"]').click());
   await page.waitForFunction(()=>!restoringScroll);
   await page.evaluate(()=>document.querySelector('.navigation [data-view="study"]').click());
   await page.waitForFunction(y=>Math.abs(scrollY-y)<3,y);
   const reopened=await context.newPage();await reopened.goto('http://127.0.0.1:5173/');
   await reopened.waitForFunction(y=>view==='study'&&Math.abs(scrollY-y)<3,y);
   assert.equal(await reopened.evaluate(()=>document.documentElement.dataset.theme),'dark');
   assert(await reopened.locator('#C-1-explain').isVisible());await reopened.close();
   await page.locator('#theme').click();await page.reload();
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  });
  await check('test filters, question, reveal and session survive reload without duplicate counts',async()=>{
   await page.locator('.navigation [data-view="test"]').click();
   await page.locator('[data-action="filter"][data-filter="grammar"]').click();
   await page.locator('#pattern-filter').selectOption('C');
   await page.locator('[data-action="reveal"]').click();
   await page.locator('[data-action="rate"][data-rating="good"]').click();
   await page.locator('[data-action="reveal"]').click();
   const before=await page.evaluate(key=>({records:localStorage.getItem(key),id:current.id,completed,sessionGood,previous}),KEY);
   await page.reload();
   assert.equal(await page.evaluate(()=>view),'test');
   assert.equal(await page.locator('#pattern-filter').inputValue(),'C');
   assert.equal(await page.locator('[data-filter="grammar"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('[data-action="reveal"]').getAttribute('aria-expanded'),'true');
   assert.deepEqual(await page.evaluate(key=>({records:localStorage.getItem(key),id:current.id,completed,sessionGood,previous}),KEY),before);
   await page.locator('[data-action="rate"][data-rating="good"]').click();
   assert.equal(await page.evaluate(()=>completed),2);
   const records=await page.evaluate(key=>localStorage.getItem(key),KEY);
   const invalidPage=await context.newPage();
   await invalidPage.addInitScript(()=>localStorage.setItem('eiken-body-trainer.ui.v1','invalid-json'));
   await invalidPage.goto('http://127.0.0.1:5173/');
   assert.equal(await invalidPage.evaluate(()=>view),'home');
   assert.equal(await invalidPage.evaluate(key=>localStorage.getItem(key),KEY),records);await invalidPage.close();
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
