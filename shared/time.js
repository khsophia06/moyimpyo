export const ZONE = 'Asia/Seoul';
export const clock = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const durationLabel = m => m == null ? '소요 시간 미정' : `${m >= 60 ? `${Math.floor(m / 60)}시간` : ''}${m % 60 ? ' 30분' : ''}`.trim();
export function datesBetween(start, end) {
  const dates = [];
  for (let t = Date.parse(start + 'T00:00:00Z'); t <= Date.parse(end + 'T00:00:00Z') && dates.length < 31; t += 86400000) dates.push(new Date(t).toISOString().slice(0, 10));
  return dates;
}
export const slotKey = (date, minute) => `${date}/${minute}`;
export function allowedSlots(m) {
  return datesBetween(m.startDate, m.endDate).flatMap(date => Array.from({ length: (m.endMinute - m.startMinute) / 30 }, (_, i) => slotKey(date, m.startMinute + i * 30)));
}
export function calculate(m, responses) {
  const sets = responses.map(r => new Set(r.slots));
  const counts = Object.fromEntries(allowedSlots(m).map(k => [k, sets.filter(s => s.has(k)).length]));
  const candidates = [], common = [];
  for (const date of datesBetween(m.startDate, m.endDate)) {
    let run = null;
    for (let t = m.startMinute; t < m.endMinute; t += 30) {
      const all = responses.length > 0 && counts[slotKey(date, t)] === responses.length;
      if (all && run === null) run = t;
      if (run !== null && (!all || t + 30 === m.endMinute)) {
        common.push({ date, start: run, end: all ? t + 30 : t }); run = null;
      }
      if (m.duration != null && t + m.duration <= m.endMinute) {
        const people = responses.filter((_, i) => Array.from({ length: m.duration / 30 }, (_, j) => slotKey(date, t + j * 30)).every(k => sets[i].has(k))).map(r => r.name);
        candidates.push({ date, start: t, end: t + m.duration, count: people.length, people });
      }
    }
  }
  candidates.sort((a, b) => b.count - a.count || a.date.localeCompare(b.date) || a.start - b.start);
  return { counts, candidates, common, total: responses.length };
}

export function recommendationGroups(m, responses, result = calculate(m, responses)) {
  const groups = { all: [], some: [], short: [] };
  if (m.duration == null || !responses.length) return groups;
  groups.all = result.candidates.filter(c => c.count === responses.length).slice(0, 5);
  groups.some = result.candidates.filter(c => c.count > 0 && c.count < responses.length).slice(0, 5);
  const sets = responses.map(r => new Set(r.slots));
  const majority = Math.floor(responses.length / 2) + 1;
  const short = [];
  for (const date of datesBetween(m.startDate, m.endDate)) {
    for (let start = m.startMinute; start < m.endMinute; start += 30) {
      let members = sets.map((_, i) => i), end = start;
      for (let t = start; t < m.endMinute; t += 30) {
        const next = members.filter(i => sets[i].has(slotKey(date, t)));
        if (next.length < majority) break;
        members = next;
        end = t + 30;
        if (end - start >= m.duration) break;
      }
      if (end > start && end - start < m.duration) short.push({ date, start, end, count: members.length, members, people: members.map(i => responses[i].name) });
    }
  }
  // Do not show a trailing fragment of a longer interval for the same people.
  groups.short = short.filter(c => {
    const extendsEarlier = c.start > m.startMinute && c.members.every(i => sets[i].has(slotKey(c.date, c.start - 30)));
    return !extendsEarlier;
  }).sort((a, b) => b.count - a.count || (b.end - b.start) - (a.end - a.start) || a.date.localeCompare(b.date) || a.start - b.start)
    .slice(0, 5).map(({ members, ...c }) => c);
  return groups;
}
