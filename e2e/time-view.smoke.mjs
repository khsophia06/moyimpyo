import { chromium, expect } from '@playwright/test';
import { calculate, datesBetween } from '../shared/time.js';
const base = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const mid = 'ui-time-smoke';
const meeting = {id:mid,title:'시간표 UI 검증',description:'독립적인 테스트 자료',startDate:'2026-09-30',endDate:'2026-10-09',startMinute:540,endMinute:1320,duration:120,placeMode:'later',revision:1,timeRevision:1,finalizedTime:null,finalizedPlace:null};
const responses = ['지수','민수','수빈','현우','지연'].map((name,i) => {
 const slots=[];
 datesBetween(meeting.startDate,meeting.endDate).forEach((date,day)=>{
  for(let t=540;t<1320;t+=30) if((day%3===0&&t>=1080&&t<1200)||(t>=960+((i+day)%4)*30&&t<1260-((i*2+day)%3)*30&&(i+day)%4!==0)||(day%2===1&&t>=780+i*30&&t<930+i*30)) slots.push(`${date}/${t}`);
 });
 return {id:`member-${i}`,name,slots,revision:1};
});
let data = {meeting,responses,result:calculate(meeting,responses),participants:responses.map(r=>({id:r.id,name:r.name,responded:true,revision:1,isMine:false,isOwner:false})),places:[],myVotes:[]};
data.isOwner = true;
data.mine = {id:data.participants[0].id,name:data.participants[0].name,slots:data.responses[0].slots,revision:1,outsideCount:0};
data.participants[0].isMine=true; data.participants[0].isOwner=true;
data.participants.push({id:'pending-example',name:'아직 선택 안 한 팀원',responded:false,revision:1,isMine:false,isOwner:false});
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext({viewport:{width:1092,height:871}});
const page = await context.newPage();
let failNextSave=false, activeSaves=0, maxActiveSaves=0;
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',async route=>{
 const req=route.request(), url=new URL(req.url()), body=req.postDataJSON();
 let response={ok:true};
 if(url.pathname==='/api/me') response={user:{id:'ui-owner',name:'주최자'}};
 else if(url.pathname.endsWith('/response')) {
  activeSaves++;maxActiveSaves=Math.max(maxActiveSaves,activeSaves);
  await new Promise(r=>setTimeout(r,250));activeSaves--;
  if(failNextSave){failNextSave=false;await route.fulfill({status:503,json:{error:'잠시 저장할 수 없습니다.'}});return;}
  data.mine.slots=body.slots;
  data.responses.find(r=>r.id===data.mine.id).slots=body.slots;
  data.result=calculate(data.meeting,data.responses);
 } else if(url.pathname.endsWith('/finalize/time')) { data.meeting.finalizedTime={date:body.date,start:body.start,end:data.meeting.duration==null?null:body.start+data.meeting.duration};data.meeting.revision++; }
 else if(url.pathname.endsWith('/participants/me')) {data.mine.name=body.name; data.participants.find(p=>p.isMine).name=body.name;data.responses.find(p=>p.id===data.mine.id).name=body.name;}
 else if(url.pathname.endsWith('/remove')) {const id=url.pathname.split('/').at(-2);data.participants=data.participants.filter(p=>p.id!==id);data.responses=data.responses.filter(p=>p.id!==id);data.result=calculate(data.meeting,data.responses);}
 else if(req.method()==='GET' && url.pathname===`/api/meetings/${mid}`) response=data;
 await route.fulfill({json:response});
});
try {
 await page.goto(`${base}/m/${mid}/time`);
 await expect(page.getByRole('heading',{name:'추천 시간',exact:true})).toBeVisible();
 for(const key of ['all','some','short']) {const group=page.locator(`[data-recommendation="${key}"]`);await expect(group).toBeVisible();await expect(group).not.toHaveAttribute('open','');await group.locator('summary').click();const count=await group.locator('.candidate').count();expect(count).toBeLessThanOrEqual(5);if(!count)await expect(group.getByText('해당되는 시간이 없습니다.')).toBeVisible();await group.locator('summary').click();}
 await expect(page.getByRole('button',{name:'내 시간 입력',exact:true})).toHaveCount(0);
 await expect(page.locator('.meeting-description')).toHaveText('밑의 표에서 가능한 시간을 눌러주세요');
 const autoA=page.locator('[data-slot="2026-09-30/540"]'),autoB=page.locator('[data-slot="2026-09-30/570"]');
 await autoA.click();await expect(autoA).toHaveAttribute('aria-pressed','true');
 await autoB.click();await expect(autoB).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('내 가능 시간이 자동 저장되었어요.',{exact:true})).toBeVisible();
 expect(data.mine.slots).toContain('2026-09-30/540');expect(data.mine.slots).toContain('2026-09-30/570');
 await page.reload();await expect(autoA).toHaveAttribute('aria-pressed','true');
 await autoA.click();await autoB.click();await expect(page.getByText('내 가능 시간이 자동 저장되었어요.',{exact:true})).toBeVisible();
 expect(data.mine.slots).not.toContain('2026-09-30/540');expect(data.mine.slots).not.toContain('2026-09-30/570');
 failNextSave=true;await autoA.click();await expect(page.getByRole('alert')).toContainText('아직 저장되지');
 await page.getByRole('button',{name:'저장 다시 시도'}).click();await expect(page.getByText('내 가능 시간이 자동 저장되었어요.',{exact:true})).toBeVisible();
 expect(data.mine.slots).toContain('2026-09-30/540');expect(maxActiveSaves).toBe(1);
 await page.getByRole('button',{name:'확정할 시간 선택',exact:true}).click();
 const slot=page.locator('[data-slot="2026-09-30/1080"]');
 await slot.click(); await expect(page.locator('.confirmation-cell')).toHaveCount(4);
 await expect(slot).toHaveCSS('background-color','rgb(249, 217, 103)');
 await page.getByRole('button',{name:'모임 시간 확정',exact:true}).click(); await page.getByRole('button',{name:'확인하고 저장'}).click();
 await expect(page.locator('.final-banner')).toContainText('18:00 ~ 20:00');
 await page.getByRole('button',{name:'수정',exact:true}).click();
 await page.locator('[data-slot="2026-09-30/1050"]').click();
 await page.getByRole('button',{name:'수정 확정'}).click();await page.getByRole('button',{name:'확인하고 저장'}).click();
 await expect(page.locator('.final-banner')).toContainText('17:30 ~ 19:30');
 await page.getByRole('button',{name:'수정',exact:true}).click();
 await page.locator('[data-slot="2026-09-30/1290"]').click();await expect(page.getByRole('alert')).toContainText('더 이른 시간을 선택');
 await page.getByRole('button',{name:'팀원별 가능 시간 확인',exact:true}).click();
 await page.locator('.member-picker button').nth(1).click();
 await expect(page.getByRole('group',{name:'팀원별 시간표'}).locator('[aria-pressed="true"]').first()).toBeVisible();
 await page.getByRole('button',{name:'전체 현황',exact:true}).click();
 await page.locator('.time-page').screenshot({path:'test-results/time-groups-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole('button',{name:'팀원별 가능 시간 확인',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'test-results/time-groups-mobile.png',fullPage:true});
 await page.getByRole('link',{name:'모임 홈',exact:true}).click();
 await expect(page.locator('.participant-item').filter({hasText:'아직 선택 안 한 팀원'})).toContainText('응답 미완료');
 await page.getByRole('button',{name:'이름 수정',exact:true}).click();await page.getByLabel('내 이름',{exact:true}).fill('수정한 내 이름');await page.getByRole('button',{name:'이름 저장',exact:true}).click();
 await expect(page.locator('.participant-item').filter({hasText:'수정한 내 이름'})).toBeVisible();
 await page.getByRole('button',{name:'아직 선택 안 한 팀원 내보내기',exact:true}).click();await page.getByRole('button',{name:'확인하고 저장'}).click();
 await expect(page.locator('.participant-item').filter({hasText:'아직 선택 안 한 팀원'})).toHaveCount(0);
 data.meeting.duration=180;data.meeting.finalizedTime=null;data.meeting.revision++;data.result=calculate(data.meeting,data.responses);
 await page.getByRole('link',{name:'시간',exact:true}).click();
 await page.getByRole('button',{name:'확정할 시간 선택',exact:true}).click();
 await page.locator('[data-slot="2026-09-30/1080"]').click();await expect(page.locator('.confirmation-cell')).toHaveCount(6);
 data.meeting.duration=null;data.meeting.finalizedTime=null;data.meeting.revision++;data.result=calculate(data.meeting,data.responses);
 await page.getByRole('button',{name:'현황 새로고침'}).click();
 await expect(page.getByText('소요 시간이 미정이면 추천 시간을 표시하지 않아요.')).toBeVisible();await expect(page.locator('[data-recommendation]')).toHaveCount(0);
 await page.getByRole('button',{name:'확정할 시간 선택',exact:true}).click();
 await page.locator('[data-slot="2026-09-30/1080"]').click();await expect(page.locator('.confirmation-cell')).toHaveCount(1);
 expect(errors).toEqual([]);
 console.log('PASS: recommendation groups, yellow duration selection, finalization and revision, range guard, member view, mobile width, pending members, rename, removal, undetermined duration. No actual meeting data changed.');
} finally {await context.close();await browser.close();}
