import { chromium, expect } from '@playwright/test';
import { calculate } from '../shared/time.js';
const browser=await chromium.launch({channel:'msedge',headless:true});
const dates=['2026-10-01','2026-10-02','2026-10-06','2026-10-20','2026-11-01'];
const meeting={id:'discrete',title:'떨어진 날짜 · 24시간 테스트',description:'',dates,startDate:dates[0],endDate:dates.at(-1),startMinute:0,endMinute:1440,duration:60,placeMode:'later',revision:1,timeRevision:1};
const errors=[];
try {
for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568}]){
 const context=await browser.newContext({viewport,hasTouch:viewport.width<768,isMobile:viewport.width<768});
 const page=await context.newPage(); await page.clock.setFixedTime(new Date('2026-10-03T03:00:00Z')); page.on('pageerror',e=>errors.push(e.message));
 const mine={id:'a',name:'나',slots:[],revision:1};
 const data={meeting,mine,isOwner:true,responses:[mine],participants:[],places:[],myVotes:[],result:calculate(meeting,[mine])};
 await page.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;
 if(path==='/api/me') return route.fulfill({json:{user:{id:'owner',name:'주최자'}}});
 if(path.endsWith('/response')) {mine.slots=route.request().postDataJSON().slots; return route.fulfill({json:{ok:true}});}
 await route.fulfill({json:data});
 });
 await page.goto('http://localhost:3000/m/discrete/time');
 await expect(page.locator('.time-end-label')).toHaveText('24:00');
 await page.waitForTimeout(500);
 const metrics=await page.locator('.grid-scroll').evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,view:innerHeight,scroll:el.scrollHeight,height:el.clientHeight,width:el.scrollWidth,clientWidth:el.clientWidth,body:document.documentElement.scrollWidth,viewport:innerWidth}));
 console.log(viewport,metrics);
 expect(metrics.scroll).toBeLessThanOrEqual(metrics.height+1);expect(metrics.width).toBeLessThanOrEqual(metrics.clientWidth+1);expect(metrics.bottom).toBeLessThanOrEqual(metrics.view);expect(metrics.top).toBeGreaterThanOrEqual(0);expect(metrics.body).toBeLessThanOrEqual(metrics.viewport);
 await expect(page.locator('[data-slot^="2026-10-03/"]')).toHaveCount(0);
 const h=page.locator('.day-heading');const boxes=await h.evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})));
 expect(boxes[1].x-boxes[0].right).toBeLessThan(1);expect(boxes[2].x-boxes[1].right).toBeGreaterThanOrEqual(11);
 for(const time of [0,1410]){const cell=page.locator(`[data-slot="2026-10-01/${time}"]`);if(viewport.width<768)await cell.tap();else await cell.click();await expect(cell).toHaveAttribute('aria-pressed','true');}
 await page.screenshot({path:`test-results/time-${viewport.width}.png`});
 await page.goto('http://localhost:3000/new');
 await page.getByRole('button',{name:'선택 모두 해제',exact:true}).click();
 const month=await page.locator('.calendar-nav strong').textContent();
 expect(month).toBe('2026년 10월');
 {
 for(const date of dates.slice(0,4)) await page.getByRole('button',{name:date,exact:true}).click();
 await expect(page.locator('.date-calendar [aria-pressed=true]')).toHaveCount(4);
 await page.getByRole('button',{name:'다음 달',exact:true}).click();await page.getByRole('button',{name:'2026-11-01',exact:true}).click();
 await expect(page.locator('.selected-dates button')).toHaveCount(5);
 }
 await page.locator('.date-picker').screenshot({path:`test-results/dates-${viewport.width}.png`});
 await context.close();
}
expect(errors).toEqual([]);
} finally {await browser.close();}
