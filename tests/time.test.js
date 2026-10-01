import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, slotKey, recommendationGroups } from '../shared/time.js';
const date = '2026-10-10';
const meeting = { startDate: date, endDate: date, startMinute: 840, endMinute: 1080, duration: 180 };
const response = (name, start, end) => ({ name, slots: Array.from({ length: (end - start) / 30 }, (_, i) => slotKey(date, start + i * 30)) });
test('3시간 전체 가능 인원과 30분 구간 인원을 구분하고 동률은 시작 시각순', () => {
  const result = calculate(meeting, [response('민수', 840, 1020), response('지연', 840, 960), response('수빈', 900, 1080), response('현우', 840, 1080)]);
  assert.equal(result.counts[slotKey(date, 900)], 4);
  assert.deepEqual(result.candidates.map(c => [c.start, c.count, c.people]), [[840, 2, ['민수', '현우']], [900, 2, ['수빈', '현우']], [870, 1, ['현우']]]);
  assert.ok(result.candidates.every(c => c.end <= meeting.endMinute));
});
test('전원 가능한 후보를 우선하고 날짜와 시간순으로 정렬', () => {
  const m = { ...meeting, endDate: '2026-10-11', duration: 60 };
  const a = response('가', 840, 1080), b = response('나', 900, 960);
  const r = calculate(m, [a, b]);
  assert.equal(r.candidates[0].start, 900); assert.equal(r.candidates[0].count, 2);
  assert.equal(r.candidates.filter(c => c.count === 0).at(-1).date, '2026-10-11');
});
test('미정은 임의 길이 후보 없이 최대 연속 공통 구간만 반환', () => {
  const r = calculate({ ...meeting, duration: null }, [response('가', 840, 1020), response('나', 900, 1080)]);
  assert.deepEqual(r.candidates, []); assert.deepEqual(r.common, [{ date, start: 900, end: 1020 }]);
});
test('빈 응답과 응답 없음에서 전원 가능을 허위 생성하지 않음', () => {
  assert.deepEqual(calculate(meeting, []).common, []);
  const r = calculate(meeting, [response('가', 840, 1080), { name: '나', slots: [] }]);
  assert.equal(r.total, 2); assert.deepEqual(r.common, []); assert.equal(r.candidates[0].count, 1);
});
test('연속 구간을 날짜 경계 또는 선택하지 않은 칸 너머로 합치지 않음', () => {
  const r = calculate({ ...meeting, duration: 60 }, [{ name: '가', slots: [slotKey(date, 840), slotKey(date, 900), slotKey(date, 930)] }]);
  assert.equal(r.candidates.find(c => c.start === 840).count, 0);
  assert.deepEqual(r.common, [{ date, start: 840, end: 870 }, { date, start: 900, end: 960 }]);
});

test('추천은 전원·일부·과반수 짧은 구간으로 분리하고 각 5개까지', () => {
  const m = { ...meeting, endMinute: 1320, duration: 120 };
  const responses = [response('가',840,1260),response('나',840,1260),response('다',840,1200),response('라',840,1080),response('마',840,960)];
  const groups = recommendationGroups(m,responses);
  assert.equal(groups.all[0].start,840);
  assert.ok(groups.all.every(c => c.count === 5 && c.end-c.start === 120));
  assert.ok(groups.some.length > 0);
  assert.ok(groups.some.every(c => c.count > 0 && c.count < 5 && c.end-c.start === 120));
  assert.ok(Object.values(groups).every(list => list.length <= 5));
  const short = recommendationGroups(m,[response('가',840,930),response('나',840,930),response('다',870,930),response('라',1020,1050),response('마',1050,1080)]).short;
  assert.deepEqual(short.map(c => [c.start,c.end,c.count]), [[870,930,3]]);
});

test('추천은 미정·빈 응답·과반수 미달·긴 구간 꼬리를 제외', () => {
  const empty = {all:[],some:[],short:[]};
  assert.deepEqual(recommendationGroups({...meeting,duration:null},[response('가',840,1080)]),empty);
  assert.deepEqual(recommendationGroups(meeting,[]),empty);
  assert.deepEqual(recommendationGroups({...meeting,duration:60},[response('가',840,1080),response('나',840,1080),response('다',840,1080)]).short,[]);
  assert.deepEqual(recommendationGroups(meeting,[response('가',840,870),response('나',840,870),response('다',900,930),response('라',900,930)]).short,[]);
});
