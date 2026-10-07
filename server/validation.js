import { datesBetween } from '../shared/time.js';
export function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function string(value, label, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${label}을(를) 확인해 주세요.`);
  return value.trim();
}
export function placeInput(b) {
  const name = string(b.name, '장소 이름', 100, true), address = string(b.address ?? '', '주소 또는 지도 링크', 2000), note = string(b.note ?? '', '설명', 300);
  if (/^[a-z][a-z0-9+.-]*:/i.test(address) && !/^https?:\/\//i.test(address)) fail('지도 링크는 http 또는 https 주소를 사용해 주세요.');
  const mapUrl = string(b.mapUrl ?? '', '지도 링크', 2000);
  if (mapUrl && !/^https?:\/\//i.test(mapUrl)) fail('지도 링크는 http 또는 https 주소를 사용해 주세요.');
  return { name, address, note, ...(mapUrl ? { mapUrl } : {}) };
}
export function meetingInput(b) {
  const title = string(b.title, '모임 이름', 100, true), description = string(b.description ?? '', '설명', 1000);
  if (b.dates !== undefined && (!Array.isArray(b.dates) || !b.dates.length || b.dates.length > 31)) fail('날짜를 1개 이상, 최대 31개 선택해 주세요.');
  for (const d of (b.dates ?? [b.startDate, b.endDate])) if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(Date.parse(d)) || new Date(d).toISOString().slice(0, 10) !== d) fail('날짜를 확인해 주세요.');
  const dates = b.dates ? [...new Set(b.dates)].sort() : null;
  if (dates) b = { ...b, startDate: dates[0], endDate: dates.at(-1) };
  const days = (Date.parse(b.endDate) - Date.parse(b.startDate)) / 86400000;
  if (!dates && (days < 0 || days > 30 || !datesBetween(b.startDate, b.endDate).length)) fail('날짜 범위는 최대 31일로 선택해 주세요.');
  if (![b.startMinute, b.endMinute].every(n => Number.isInteger(n) && n % 30 === 0 && n >= 0 && n <= 1440) || b.startMinute >= b.endMinute) fail('시간 범위를 30분 단위로 확인해 주세요.');
  if (b.duration !== null && (!Number.isInteger(b.duration) || b.duration < 30 || b.duration % 30 !== 0 || b.duration > b.endMinute - b.startMinute)) fail('소요 시간은 시간 범위 안에서 30분 단위로 입력해 주세요.');
  if (!['direct', 'together', 'later'].includes(b.placeMode)) fail('장소 결정 방식을 선택해 주세요.');
  return { title, description, dates: dates ?? datesBetween(b.startDate, b.endDate), startDate: b.startDate, endDate: b.endDate, startMinute: b.startMinute, endMinute: b.endMinute, duration: b.duration, placeMode: b.placeMode, directPlace: b.placeMode === 'direct' ? placeInput(b.directPlace ?? {}) : null };
}
