import { test, expect } from '@playwright/test';
import { calculate } from '../shared/time.js';

const user = {id:'host',name:'가현'};
const meeting = {id:'figma-review',title:'디자인 회의',description:'팀원과 디자인을 검토해요.',dates:['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16'],startDate:'2026-10-12',endDate:'2026-10-16',startMinute:540,endMinute:1080,duration:120,placeMode:'together',revision:1,timeRevision:1,finalizedTime:null,finalizedPlace:null};
const responses = ['가현','민지','지훈','수빈'].map((name,i)=>({id:`person-${i}`,name,revision:1,slots:meeting.dates.flatMap((date,d)=>Array.from({length:4},(_,j)=>`${date}/${600+j*30+(d%2)*60}`))}));
const data = {meeting,isOwner:true,mine:responses[0],responses,result:calculate(meeting,responses),places:[],myVotes:[],participants:responses};
async function mock(page,{signedIn=true,guest=false,loading=null}={}) {
  await page.route('**/api/**',async route=>{
    const path = new URL(route.request().url()).pathname;
    if((loading==='app' && path==='/api/me') || (loading==='meeting' && path.includes('/api/meetings/'))) return;
    const value = path==='/api/me' ? {user:signedIn?user:null} : path==='/api/meetings' ? [{...meeting,isOwner:true}] : {...data,isOwner:!guest,mine:guest?null:data.mine};
    await route.fulfill({json:value});
  });
}
async function capture(page,name){await page.evaluate(async()=>{await document.fonts.ready;document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:`test-results/design-${name}.png`,fullPage:true});}
test('공통 화면: 홈, 폼, 인증, 초대, 로딩과 공유',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-08T03:00:00Z'));
  await mock(page);await page.goto('/');
  await expect(page.getByRole('heading',{name:'쉬운 약속 정하기 클릭 한 번에-!'})).toBeVisible();
  await expect(page.locator('.meeting-role-group').first()).toHaveAttribute('aria-label','주최자인 모임');
  await capture(page,'01-home');
  await page.setViewportSize({width:1280,height:1000});await page.goto('/new');
  await expect(page.getByRole('heading',{name:'When?',exact:true})).toBeVisible();await capture(page,'02-form');
  await page.goto('/login');await capture(page,'07-login');
  await page.getByRole('button',{name:'처음 오셨나요? 계정 만들기'}).click();
  await expect(page.getByText('아이디와 비밀번호를 다시 찾을 수 없습니다.',{exact:false})).toBeVisible();await capture(page,'16-register');
  await page.unroute('**/api/**');await mock(page,{signedIn:false,guest:true});await page.goto('/m/figma-review');
  const join=page.getByRole('button',{name:'이 이름으로 참여하기'});await expect(join).toBeDisabled();
  await expect(page.getByPlaceholder('모임 내에서 사용할 이름을 입력하세요')).toBeVisible();await capture(page,'10-invite');
  await page.getByLabel('내 이름').fill('  ');await expect(join).toBeDisabled();await page.getByLabel('내 이름').fill('민지');await expect(join).toBeEnabled();
  await page.unroute('**/api/**');await mock(page,{loading:'app'});await page.goto('/');
  await expect(page.getByRole('status')).toContainText('모임표를 불러오고 있어요');await capture(page,'08-app-loading');
  await page.unroute('**/api/**');await mock(page,{loading:'meeting'});await page.goto('/m/figma-review');
  await expect(page.getByRole('status')).toContainText('모임을 불러오고 있어요');await capture(page,'09-meeting-loading');
});
test('시간 화면: 추천, 주최자 권한, 반응형 시간표와 공유 링크',async({page})=>{
  await mock(page);await page.goto('/m/figma-review/time');await page.setViewportSize({width:1280,height:1000});
  await page.getByRole('button',{name:'시간 확정하기',exact:true}).click();await expect(page.getByRole('heading',{name:'추천 시간'})).toBeVisible();await capture(page,'12-recommendations');
  await expect(page.locator('.best-candidate')).toContainText('4/4명');
  await page.route('https://t1.kakaocdn.net/**',route=>route.fulfill({contentType:'application/javascript',body:'window.Kakao={isInitialized:()=>true,Share:{sendDefault:()=>{}}};'}));
  await page.getByRole('button',{name:'공유',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('모임 초대 링크')).toHaveValue('http://localhost:3100/m/figma-review');
  const box=await page.getByRole('dialog').boundingBox();expect(Math.abs(box.x+box.width/2-640)).toBeLessThan(2);expect(Math.abs(box.y+box.height/2-500)).toBeLessThan(2);
  await capture(page,'17-share');await page.getByRole('button',{name:'공유창 닫기'}).click();
  await page.setViewportSize({width:390,height:844});await capture(page,'12-mobile');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await expect(page.locator('.refresh-availability')).toBeHidden();
  await expect(page.locator('.mobile-time-action')).toBeVisible();
  await page.locator('.recommendation-chips button').nth(1).click();
  await expect(page.locator('.chosen-time')).toContainText('11:00');
  await expect(page.locator('.confirmation-cell.pending-interval')).toHaveCount(4);
  const chipText = await page.locator('.recommendation-chips').textContent();
  await page.locator('.time-cell').first().click();
  await expect(page.locator('.recommendation-chips')).toHaveText(chipText);
  await expect(page.getByRole('button',{name:'전체 보기'})).toBeVisible();
  await page.getByRole('button',{name:'전체 보기'}).click();
  await expect(page.getByRole('dialog',{name:'추천 시간'})).toBeVisible();
  await capture(page,'12-mobile-sheet');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'추천 시간'})).toHaveCount(0);
  await page.unroute('**/api/**');await mock(page,{signedIn:false});await page.route('**/api/meetings/figma-review',route=>route.fulfill({json:{...data,isOwner:false,mine:responses[1]}}));
  await page.reload();await expect(page.locator('.mobile-time-action')).toHaveCount(0);await page.getByRole('button',{name:'추천시간 보기',exact:true}).click();await page.getByRole('button',{name:'전체 보기'}).click();await expect(page.getByRole('heading',{name:'추천 시간'})).toBeVisible();
  await expect(page.getByRole('button',{name:'모임 시간 정하기'})).toHaveCount(0);
  await page.goto('/m/figma-review');
  await expect(page.locator('.meeting-heading .meeting-description')).toHaveText(meeting.description);
  await page.locator('.promise-heading').getByRole('button',{name:'공유',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'공유창 닫기'}).click();
  await page.getByRole('link',{name:'장소',exact:true}).click();
  await expect(page.locator('.meeting-heading .time-instructions')).toHaveText('원하는 장소를 추천하고 투표해주세요');
});

test('장소 카드: 데스크톱과 모바일 선택 상태 및 메뉴',async({page})=>{
  await mock(page);
  await page.route('**/api/meetings/figma-review',route=>route.fulfill({json:{...data,myVotes:['one'],places:[{id:'one',name:'국민대 조형관',count:4,canEdit:true,generate_map:true},{id:'two',name:'서울역',count:0,canEdit:true,generate_map:true},{id:'three',name:'모임표',count:0,canEdit:true,address:'https://moyimpyo.vercel.app/m/figma-review'}]}}));
  await page.goto('/m/figma-review/place');
  await expect(page.locator('.place-row.voted')).toHaveCount(1);
  await page.getByRole('checkbox',{name:'서울역 선택'}).check();
  await expect(page.locator('.place-save-status')).toContainText('2곳 선택함');
  await page.getByLabel('서울역 더보기').click();
  await expect(page.getByRole('button',{name:'이 장소 확정'})).toBeVisible();
  await page.getByLabel('서울역 더보기').click();
  await capture(page,'place-cards-desktop');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await capture(page,'place-cards-mobile');
});

test('모임 홈 현황판: 요약, 응답 진행률, 관리와 초대 링크',async({page,context})=>{
  await mock(page);
  await page.route('**/api/meetings/figma-review',route=>route.fulfill({json:{...data,participants:responses.map((p,i)=>({...p,isMine:i===0,isOwner:i===0,responded:i<3})),places:[{id:'one',name:'유니클로 목동점',count:2}]}}));
  await page.goto('/m/figma-review');
  await expect(page.locator('.home-status-summary').first()).toContainText('4/4명 가능');
  await expect(page.locator('.home-status-summary').last()).toContainText('유니클로 목동점');
  await expect(page.locator('.response-progress-label')).toHaveText('4명 중 3명 응답');
  await page.locator('.participant-heading').getByRole('button',{name:'공유',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'공유창 닫기'}).click();
  await page.getByLabel('가현 관리').click();
  await expect(page.getByRole('button',{name:'이름 수정'})).toBeVisible();
  await page.getByLabel('가현 관리').click();
  const cards=await page.locator('.home-main').boundingBox(), members=await page.locator('.response-section').boundingBox();
  expect(Math.abs(cards.x+cards.width-members.x-members.width)).toBeLessThan(2);
  await capture(page,'home-dashboard-desktop');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await expect.poll(async()=>{const a=await page.locator('.home-status-summary').first().boundingBox(),b=await page.locator('.home-status-summary').last().boundingBox();return Math.abs(a.y-b.y)+Math.abs(a.height-b.height);}).toBeLessThan(2);
  await capture(page,'home-dashboard-mobile');
});

test('모임 목록은 2개까지 펼치고 3개부터 접는다',async({page})=>{
  await mock(page);
  await page.route('**/api/meetings',route=>route.fulfill({json:[...Array.from({length:3},(_,i)=>({...meeting,id:`host-${i}`,isOwner:true})),...Array.from({length:2},(_,i)=>({...meeting,id:`guest-${i}`,isOwner:false}))]}));
  await page.goto('/');
  await expect(page.locator('.meeting-role-group').first()).not.toHaveAttribute('open','');
  await expect(page.locator('.meeting-role-group').last()).toHaveAttribute('open','');
});
