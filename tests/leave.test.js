import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

test('참여자 나가기: 본인 응답과 투표만 삭제, 재참여 가능, 주최자 보호', async t => {
  const { app, db } = createApp({ dbPath: ':memory:' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(async () => { await new Promise(r => server.close(r)); db.close(); });
  const client = () => {
    const cookies = {};
    return async (path, method = 'GET', body) => {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Moimpyo': '1', Cookie: Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; ') }, ...(body ? { body: JSON.stringify(body) } : {}) });
      for (const c of r.headers.getSetCookie()) { const [k,v] = c.split(';')[0].split('='); cookies[k] = v; }
      return { status: r.status, body: await r.json() };
    };
  };
  const owner = client(), guest = client(), member = client(), stranger = client();
  await owner('/auth/register','POST',{name:'주최자',email:'owner',password:'1'});
  await member('/auth/register','POST',{name:'참여자',email:'member',password:'1'});
  const input = {title:'나가기 검사',dates:['2026-10-10'],startMinute:540,endMinute:1080,duration:60,placeMode:'together'};
  const id = (await owner('/meetings','POST',input)).body.id, path = '/meetings/' + id;
  for (const who of [guest, member]) await who(path+'/response','PUT',{name:'참여자',slots:['2026-10-10/540'],revision:1});
  await guest(path+'/places','POST',{name:'참여자',revision:1,place:{name:'카페',address:''}});
  const place = (await guest(path)).body.places[0].id;
  for (const who of [guest, member]) await who(path+'/votes','PUT',{name:'참여자',revision:1,places:[place]});
  assert.equal((await stranger(path+'/leave','POST',{})).status,403);
  assert.equal((await owner(path+'/leave','POST',{})).status,403);
  const otherId = (await member(path)).body.mine.id;
  assert.equal((await guest(path+'/leave','POST',{participantId:otherId})).status,200);
  assert.deepEqual((await guest('/meetings')).body,[]);
  let state = (await member(path)).body;
  assert.equal(state.participants.length,1);
  assert.equal(state.mine.id,otherId);
  assert.equal(state.result.total,1);
  assert.equal(state.places[0].count,1);
  assert.equal((await guest(path+'/leave','POST',{})).status,200);
  assert.equal((await guest(path+'/join','POST',{name:'다시 참여'})).status,200);
  assert.equal((await guest(path)).body.mine.slots,null);
  assert.equal((await member(path+'/leave','POST',{})).status,200);
  assert.deepEqual((await member('/meetings')).body,[]);
  assert.equal((await owner('/meetings')).body.length,1);
  assert.equal((await owner(path)).body.places[0].count,0);
});
