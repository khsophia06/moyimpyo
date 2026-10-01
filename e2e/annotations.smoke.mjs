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
 else if(url.pathname.endsWith('/map')) response={point:{lat:37.566,lon:126.978,label:'테스트 주소'}};
 else if(req.method()==='GET' && url.pathname===`/api/meetings/${mid}`) response=data;
 await route.fulfill({json:response});
});
try {
 await page.goto(`${base}/m/${mid}/time`);
 await expect(page.locator('.meeting-heading h1')).toHaveCSS('font-size','40px');
 await expect(page.locator('.meeting-meta')).not.toContainText('응답');
 await expect(page.locator('.meeting-tabs').getByRole('link',{name:'장소',exact:true})).toHaveCount(0);
 await expect(page.locator('.time-view-actions').getByRole('button',{name:'내 선택 모두 해제'})).toBeVisible();
 await expect(page.locator('.slot-detail')).toHaveText('현재 응답자 5명');
 const before=JSON.stringify(data.mine.slots);
 await page.locator('[data-recommendation="all"] summary').click();
 await page.locator('[data-recommendation="all"] .candidate').first().click();
 await expect(page.locator('.pending-interval')).toHaveCount(4);
 await expect(page.locator('.pending-interval').first()).toHaveCSS('background-color','rgb(255, 240, 164)');
 expect(JSON.stringify(data.mine.slots)).toBe(before);expect(data.meeting.finalizedTime).toBeNull();
 await page.getByRole('button',{name:'선택 취소',exact:true}).click();
 await page.locator('[data-recommendation="short"] summary').click();
 await page.locator('[data-recommendation="short"] .candidate').first().click();
 await expect(page.getByRole('button',{name:'이 시간으로 확정',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'선택 취소',exact:true}).click();
 data.meeting.finalizedTime={date:'2026-10-03',start:1080,end:1200};data.meeting.revision++;
 await page.getByRole('button',{name:'현황 새로고침'}).click();
 await expect(page.getByRole('heading',{name:'확정 약속 시간'})).toHaveCSS('font-size','30px');
 await expect(page.locator('.final-interval').first()).toHaveCSS('border-left-width','5px');
 await expect(page.locator('.final-interval').first()).toHaveCSS('background-color','rgb(255, 225, 106)');
 await page.screenshot({path:'test-results/annotations-time.png',fullPage:true});
 data.meeting.placeMode='direct';data.meeting.finalizedPlace={name:'예시 장소',address:'',note:''};
 await page.goto(`${base}/m/${mid}`);
 await expect(page.locator('.next-action h2')).toHaveText('시간과 장소가 모두 정해졌어요!');
 await expect(page.locator('.next-action .button')).toHaveCount(0);
 await expect(page.locator('.response-section h2')).toContainText('모임원');
 await expect(page.locator('.next-action')).not.toContainText('가입 없이');
 await page.getByRole('link',{name:'장소',exact:true}).click();
 await expect(page.locator('.place-map')).toContainText('주소가 아직 등록되지');
 data.meeting.finalizedPlace.address='서울 중구 세종대로 110';
 await page.reload();
 await expect(page.locator('.final-place .address')).toHaveAttribute('href',/map.naver.com/);
 await page.route('https://www.openstreetmap.org/**',r=>r.fulfill({contentType:'text/html',body:'<p>지도 프레임 테스트</p>'}));
 await page.getByRole('button',{name:'주소 지도 펼치기'}).click();
 await expect(page.locator('.place-map iframe')).toHaveAttribute('src',/marker=37.566,126.978/);
 data.meeting.finalizedTime=null;
 await page.goto(`${base}/m/${mid}`);
 await expect(page.locator('.next-action h2')).toContainText('장소가 정해졌어요');
 await expect(page.locator('.next-action .button').first()).toHaveAttribute('href',`/m/${mid}/time`);
 data.meeting.placeMode='together';data.meeting.finalizedPlace=null;data.meeting.finalizedTime={date:'2026-10-03',start:1080,end:1200};
 await page.reload();
 await expect(page.locator('.next-action h2')).toContainText('이제 장소를 정해요');
 await expect(page.locator('.next-action .button').first()).toHaveAttribute('href',`/m/${mid}/place`);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/annotations-home-mobile.png',fullPage:true});
 await page.goto(`${base}/m/${mid}/time`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'test-results/annotations-time-mobile.png',fullPage:true});
 data.meeting.placeMode='later';
 await page.goto(`${base}/m/${mid}/place`);
 await expect(page).toHaveURL(`${base}/m/${mid}/time`);
 expect(errors).toEqual([]);
 console.log('PASS: annotations, preview without saving, short interval guard, home states, map fallback/embed, responsive layout');
} finally {await context.close();await browser.close();}
