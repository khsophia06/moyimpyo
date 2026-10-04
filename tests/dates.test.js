import test from 'node:test';
import assert from 'node:assert/strict';
import { meetingInput } from '../server/validation.js';
import { meetingDates, allowedSlots, calculate, weekKey } from '../shared/time.js';
const input = { title:'날짜 테스트', description:'', dates:['2026-11-12','2026-10-06','2026-10-01'], startMinute:0, endMinute:1440, duration:60, placeMode:'later' };
test('떨어진 날짜만 저장하고 중간 날짜는 응답과 추천에서 제외', () => {
  const m = meetingInput(input);
  assert.deepEqual(m.dates,['2026-10-01','2026-10-06','2026-11-12']);
  assert.equal(m.startDate,'2026-10-01'); assert.equal(m.endDate,'2026-11-12');
  assert.equal(allowedSlots(m).length,144);
  assert.ok(!allowedSlots(m).includes('2026-10-02/0'));
  assert.deepEqual([...new Set(calculate(m,[]).candidates.map(c=>c.date))],m.dates);
});
test('기존 기간형 모임 호환, 주 경계 및 잘못된 날짜 검증', () => {
  assert.deepEqual(meetingDates({startDate:'2026-10-01',endDate:'2026-10-03'}),['2026-10-01','2026-10-02','2026-10-03']);
  assert.equal(weekKey('2026-10-01'),weekKey('2026-09-29'));
  assert.notEqual(weekKey('2026-10-03'),weekKey('2026-10-04'));
  for (const dates of [[],null,['2026-02-30'],Array(32).fill('2026-10-01')]) assert.throws(()=>meetingInput({...input,dates}));
});

test('실제 API: 빠진 날짜의 응답·확정 거절 및 날짜 변경 시 확정 해제', async () => {
  const { createApp } = await import('../server/app.js');
  const { app, db } = createApp({dbPath:':memory:'});
  const server = app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
  const cookies={};
  const request=async (path,method='GET',body)=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method,headers:{'Content-Type':'application/json','X-Moimpyo':'1',Cookie:Object.entries(cookies).map(([k,v])=>`${k}=${v}`).join('; ')},...(body?{body:JSON.stringify(body)}:{})});
    for(const cookie of res.headers.getSetCookie()){const [k,v]=cookie.split(';')[0].split('=');cookies[k]=v;}
    return {status:res.status,body:await res.json()};
  };
  try {
    assert.equal((await request('/auth/register','POST',{name:'날짜 주최자',email:'dates@example.com',password:'testpassword123'})).status,200);
    const created=await request('/meetings','POST',{...input,dates:['2026-10-01','2026-10-03']});
    const path='/meetings/'+created.body.id;
    assert.equal((await request(path+'/response','PUT',{name:'나',revision:1,slots:['2026-10-02/0']})).status,400);
    assert.equal((await request(path+'/finalize/time','POST',{revision:1,date:'2026-10-02',start:0})).status,400);
    assert.equal((await request(path+'/finalize/time','POST',{revision:1,date:'2026-10-01',start:0})).status,200);
    assert.equal((await request(path,'PATCH',{...input,dates:['2026-10-01','2026-10-02','2026-10-03'],revision:2,acknowledge:true})).status,200);
    const saved=(await request(path)).body.meeting;
    assert.deepEqual(saved.dates,['2026-10-01','2026-10-02','2026-10-03']);
    assert.equal(saved.finalizedTime,null);assert.equal(saved.timeRevision,3);
  } finally {await new Promise(r=>server.close(r));db.close();}
});

test('주별 날짜는 PC와 모바일 모두 페이지를 나누지 않는다', async () => {
  const { datePages } = await import('../shared/time.js');
  const dates=['2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-22','2026-10-23','2026-10-24'];
  for(const size of [4,7]) {
    const pages=datePages(dates,size);
    assert.deepEqual(pages.flat(),dates);
    assert.ok(pages.some(p=>['2026-10-22','2026-10-23','2026-10-24'].every(d=>p.includes(d))));
    const fullWeek=['2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10'];
    assert.deepEqual(datePages(fullWeek,size),[fullWeek]);
  }
});
