const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH});try{
 const page=await browser.newPage({viewport:{width:390,height:1000}});
 await page.addInitScript(()=>localStorage.setItem('placementiq_muted','true'));
 await page.goto(process.env.PLACEMENTIQ_UI_URL+'/app/overview');
 await page.locator('.app-topbar .demo-launcher summary').click();await page.getByLabel('Demo candidate level').selectOption('advanced');await page.getByRole('button',{name:'Try Demo Interview',exact:true}).click();await page.getByText('DEMO · Meera Demo · advanced',{exact:true}).waitFor();
 await page.screenshot({path:'docs/verification/resume-optimization/demo-navigation-mobile.png',fullPage:true});
 const header=await page.locator('.interview-topbar').boundingBox(),stage=await page.locator('.presenter-stage').boundingBox();assert.ok(stage.y>=header.y+header.height,'Navigation must not overlap the avatar stage');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log('Final mobile navigation layout passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
