import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeocoder } from '../server/maps.js';

test('지도 검색은 주소를 인코딩하고 같은 주소 요청을 공유한다', async () => {
  let count = 0;
  const geocode = createGeocoder(async (url, options) => {
    count++; assert.equal(url.searchParams.get('q'), '서울 중구 세종대로 110');
    assert.match(options.headers['User-Agent'], /Moimpyo/);
    return {ok:true,json:async()=>[{lat:'37.566',lon:'126.978',display_name:'테스트 주소'}]};
  });
  const [a,b] = await Promise.all([geocode('서울 중구 세종대로 110'),geocode('서울 중구 세종대로 110')]);
  assert.equal(count,1); assert.deepEqual(a,b); assert.equal(a.lat,37.566);
});
test('지도 검색 결과가 없거나 잘못된 좌표이면 위치를 만들지 않는다', async () => {
  assert.equal(await createGeocoder(async()=>({ok:true,json:async()=>[]}))('주소'),null);
  assert.equal(await createGeocoder(async()=>({ok:true,json:async()=>[{lat:'200',lon:'30'}]}))('주소'),null);
});
