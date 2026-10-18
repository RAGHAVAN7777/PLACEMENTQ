const assert=require('node:assert/strict');const fs=require('node:fs/promises');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{await page.addInitScript(()=>localStorage.setItem('placementiq_muted','true'));await page.goto((process.env.PLACEMENTIQ_UI_URL||'http://127.0.0.1:3001')+'/assessment');await page.locator('.interview-topbar .demo-launcher summary').click();await page.getByRole('button',{name:'Try Demo Interview',exact:true}).waitFor();await page.getByRole('button',{name:'Or paste your résumé text'}).click();const draft='Real draft stays unchanged. Python and SQL student with an academic task planner.';await page.getByLabel('Résumé text',{exact:true}).fill(draft);const normal=await page.evaluate(()=>localStorage.getItem('placementiq_interview_session_v1'));
await page.getByLabel('Demo candidate level').selectOption('beginner');await page.getByRole('button',{name:'Try Demo Interview',exact:true}).click();await page.getByRole('button',{name:'Run Full Demo',exact:true}).waitFor();await page.getByRole('button',{name:'Run Full Demo',exact:true}).click();await page.getByRole('button',{name:'Pause demo',exact:true}).click();await page.waitForTimeout(2000);assert.equal(await page.getByLabel('Résumé text',{exact:true}).count(),1);await page.getByRole('button',{name:'Run Full Demo',exact:true}).click();
await page.getByRole('button',{name:'Auto-Fill Demo Answer',exact:true}).waitFor({timeout:90000});await page.getByRole('button',{name:'Pause demo',exact:true}).click();await page.waitForTimeout(2000);await page.getByRole('button',{name:'Auto-Fill Demo Answer',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Your answer"]')?.value.length>20);const filled=await page.getByLabel('Your answer',{exact:true}).inputValue();await page.getByLabel('Your answer',{exact:true}).fill(filled+' I would test this with a small example.');await page.screenshot({path:'docs/verification/resume-optimization/demo-answer.png',fullPage:true});await page.getByRole('button',{name:'Continue demo',exact:true}).click();
await page.getByText('Fictional baseline model output:',{exact:false}).waitFor({timeout:180000});await page.getByRole('heading',{name:'Evidence-based interview report',exact:true}).waitFor();await page.screenshot({path:'docs/verification/resume-optimization/demo-report.png',fullPage:true});const dashboard=await page.getByRole('link',{name:'Open integrated demo dashboard'}).getAttribute('href');assert.equal(await page.evaluate(()=>localStorage.getItem('placementiq_interview_session_v1')),normal);await page.getByRole('button',{name:'Exit Demo',exact:true}).click();assert.equal(await page.getByLabel('Résumé text',{exact:true}).inputValue(),draft);assert.equal(await page.evaluate(()=>localStorage.getItem('placementiq_interview_session_v1')),normal);assert.deepEqual(errors,[]);
const baseUrl=process.env.PLACEMENTIQ_UI_URL||'http://127.0.0.1:3001';
// Verify the real candidate cannot bypass review or the actual baseline model.
await page.getByLabel('Résumé text',{exact:true}).fill('Example Candidate\nEducation\nB.Tech Computer Science, CGPA: 8.2/10\nSkills\nPython and SQL\nProjects\nStudy Planner: Built a Python task planner with unit tests.');
await page.getByRole('button',{name:'Let’s get to know you',exact:false}).click();
await page.getByRole('button',{name:'Continue without GitHub',exact:true}).click();
await page.getByRole('button',{name:'Confirm all claims',exact:false}).waitFor();
await page.getByRole('button',{name:'Confirm all claims',exact:false}).click();
await page.getByRole('button',{name:'Continue',exact:true}).click();
await page.getByRole('heading',{name:'Candidate Profile Verification',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'Begin with',exact:false}).count(),0);
const numeric=JSON.parse(await fs.readFile('docs/verification/readiness-inputs.json','utf8')).high;
for(let step=0;step<3;step++){
 const fields=await page.locator('[id^="baseline-"]').all();
 for(const field of fields){const key=(await field.getAttribute('id')).slice(9);if(await field.evaluate(e=>e.tagName==='SELECT'))await field.selectOption(String(numeric[key]));else await field.fill(String(numeric[key]));}
 await page.getByRole('button',{name:'Next',exact:true}).click();
}
await page.getByRole('checkbox',{name:'I have checked and confirm',exact:false}).check();
await page.getByRole('button',{name:'Continue to Assessment',exact:true}).click();
await page.getByRole('button',{name:'Begin with',exact:false}).waitFor({timeout:60000});
await page.screenshot({path:'docs/verification/resume-optimization/unified-real-baseline.png',fullPage:true});

await page.goto(baseUrl+dashboard);await page.getByRole('heading',{name:'Integrated Placement Readiness Score',exact:true}).waitFor();
const query=dashboard.slice(dashboard.indexOf('?'));
for(const route of ['readiness','skills','scenarios','plan','progress','interviews','model-lab','faculty','profile']){
 await page.goto(baseUrl+'/app/'+route+query);await page.waitForTimeout(1100);assert.ok(!(await page.getByText('We couldn’t open your results.',{exact:true}).count()),route+' loads');assert.ok(await page.locator('main').innerText(),route+' has content');
 if(route==='plan'){const check=page.locator('.roadmap-task input[type=checkbox]').first();await check.waitFor();const original=await check.isChecked();await check.click();await page.waitForTimeout(600);await page.reload();await check.waitFor();assert.equal(await check.isChecked(),!original);}
}
await page.goto(baseUrl+dashboard);await page.getByRole('heading',{name:'Integrated Placement Readiness Score',exact:true}).waitFor();await page.screenshot({path:'docs/verification/resume-optimization/unified-demo-dashboard.png',fullPage:true});
await page.goto(baseUrl+'/app/overview');
await page.locator('.app-topbar .demo-launcher summary').waitFor();
for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);await page.screenshot({path:`docs/verification/resume-optimization/dashboard-${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Dashboard must not overflow horizontally');}
await page.locator('.app-topbar .demo-launcher summary').click();await page.getByLabel('Demo candidate level').selectOption('advanced');await page.getByRole('button',{name:'Try Demo Interview',exact:true}).click();await page.getByText('DEMO · Meera Demo · advanced',{exact:true}).waitFor();await page.screenshot({path:'docs/verification/resume-optimization/demo-navigation-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
await fs.writeFile('docs/verification/resume-optimization/demo-offline-browser.json',JSON.stringify({passed:true,at:new Date().toISOString(),checks:['Ollama endpoint intentionally unavailable','Paused automated progression','Auto-filled and edited current answer','Completed existing grading and real placement model','Rendered labelled fictional report','Restored normal session and unsaved resume draft','Unified demo dashboard and all workspace routes','Preparation task persists after reload','Real candidate review and missing baseline inputs gate interview startup'],errors},null,2));console.log('Demo browser checks passed');
}catch(e){await page.screenshot({path:'docs/verification/resume-optimization/demo-failure.png',fullPage:true});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


