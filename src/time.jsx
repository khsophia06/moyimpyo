import React, { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import { Check, ArrowClockwise } from '@phosphor-icons/react';
import { useAvailability } from './useAvailability';
import { Button, Notice, Status, shortDate } from './ui';
import { datesBetween, clock, durationLabel, slotKey, calculate, recommendationGroups } from '../shared/time';
const heat = (count, total) => count === 0 ? '#f1f3ef' : `hsl(151 39% ${91 - 62 * count / Math.max(1, total)}%)`;
export function TimeView({ data: d, user, reload, ask }) {
  const m = d.meeting;
  const [mode, setMode] = useState('all'), [choosing, setChoosing] = useState(false);
  const availability = useAvailability(d, reload);
  const { selected, busy } = availability;
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [detail, setDetail] = useState(''), [page, setPage] = useState(0), [memberIndex, setMemberIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const drag = useRef(null);
  const responses = useMemo(() => {
    if (!availability.edited) return d.responses;
    const mine = { id:d.mine?.id, name:d.mine?.name || '참여자', slots:[...selected], revision:m.revision };
    const other = d.responses.filter(r => r.id !== d.mine?.id);
    return [...other, mine];
  }, [d.responses, d.mine, selected, availability.edited, m.revision]);
  const result = useMemo(() => calculate(m, responses), [m, responses]);
  const days = datesBetween(m.startDate, m.endDate), visibleDays = days.slice(page * 7, page * 7 + 7);
  const times = Array.from({ length: (m.endMinute - m.startMinute) / 30 }, (_, i) => m.startMinute + i * 30);
  const groups = useMemo(() => recommendationGroups(m, responses, result), [m, responses, result]);
  const member = d.responses[memberIndex], memberSlots = new Set(member?.slots || []);
  const activeChoice = (choosing ? choice : null) || m.finalizedTime;
  const choiceCount = activeChoice ? responses.filter(r => {
    const slots = new Set(r.slots);
    return Array.from({ length: (m.duration || 30) / 30 }, (_, i) => slotKey(activeChoice.date, activeChoice.start + i * 30)).every(k => slots.has(k));
  }).length : 0;
  useEffect(() => {
    const end = () => { drag.current = null; };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    return () => { removeEventListener('pointerup', end); removeEventListener('pointercancel', end); };
  }, []);
  useEffect(() => { setChoice(null); setChoosing(false); }, [m.revision]);
  useEffect(() => { setPage(p => Math.min(p, Math.ceil(days.length / 7) - 1)); }, [days.length]);
  const choose = (date, start) => {
    if (start + (m.duration || 30) > m.endMinute) { setError('선택한 시작 시간부터 모임 전체 시간이 범위 안에 들어가야 해요. 더 이른 시간을 선택해 주세요.'); return; }
    setChoice({ date, start }); setError('');
  };
  const confirmTime = () => {
    if (!choice) return;
    const end = m.duration == null ? ' 시작 · 소요 시간 미정' : ` ~ ${clock(choice.start + m.duration)}`;
    ask(m.finalizedTime ? '모임 시간을 변경할까요?' : '이 시간으로 확정할까요?', `${shortDate(choice.date)} ${clock(choice.start)}${end} · 응답자 ${result.total}명 중 ${choiceCount}명 가능`, 'finalize/time', choice);
  };
  return <div className="time-page">
    <div className="view-toolbar">
      <div className="segmented" aria-label="시간 화면 모드">
        <button aria-pressed={mode === 'all'} onClick={() => setMode('all')}>전체 현황</button>
        <button aria-pressed={mode === 'members'} onClick={() => setMode('members')}>팀원별 가능 시간 확인</button>
      </div>
      <button className="text-link" disabled={busy} onClick={async () => { setError(''); try { await reload(); setMessage('최신 응답을 불러왔어요.'); } catch (e) { setError(e.message); } }}><ArrowClockwise/> 현황 새로고침</button>
    </div>
    <div className="time-layout"><section className="timetable-section">
      <div className="section-title"><div><h2>{mode === 'members' ? '팀원별 가능한 시간' : '우리의 시간이 겹치는 곳'}</h2><p className="muted">{mode === 'members' ? '팀원 이름을 선택하면 해당 팀원의 응답을 색으로 보여드려요.' : choosing ? '확정할 시작 시간을 선택해 주세요. 노란색 구간은 모임 확정용 선택이에요.' : '가능한 시간을 누르면 바로 반영되고 자동 저장돼요. 다시 누르면 취소돼요.'}</p></div></div>
      {mode === 'members' && <div className="member-picker" aria-label="팀원 선택">{d.responses.length ? d.responses.map((r, i) => <button key={i} type="button" aria-pressed={i === memberIndex} onClick={() => { setMemberIndex(i); setDetail(''); }}>{r.name}{d.responses.filter(p => p.name === r.name).length > 1 ? ` · ${i + 1}` : ''}</button>) : <p className="muted">아직 응답한 팀원이 없어요.</p>}</div>}
      {d.mine?.revision < m.timeRevision && <Notice>모임의 시간 설정이 바뀌었어요. 기존 응답을 확인하고 가능한 시간을 다시 선택해 주세요.</Notice>}
      {d.mine?.outsideCount > 0 && <Notice>새 범위 밖의 {d.mine.outsideCount}개 선택은 보관 중이며 현재 결과에는 포함하지 않아요.</Notice>}
      <div className="grid-tools">
        {mode === 'all' ? <div className="legend"><span>0명</span>{Array.from({ length: Math.min(result.total, 4) + 1 }, (_, i) => { const n = result.total === 0 ? 0 : Math.round(i * result.total / Math.min(result.total, 4)); return <i key={i} title={`${n}명 가능`} style={{ background: heat(n, result.total) }}/>; })}<span>{result.total}명</span><span className="mine-legend">✓ 내 응답</span>{activeChoice && <span className="selection-legend">노란색 · {choosing && choice ? '확정 전 선택' : '확정 시간'}</span>}</div> : <span className="small muted">{mode === 'members' ? `${member?.name || '팀원'} · 초록색: 가능한 시간` : '✓ 저장됨 · 점선: 저장 전 변경 · 드래그로 여러 칸 선택'}</span>}
        {days.length > 7 && <div className="inline-actions week-navigation"><button className="small-button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>이전</button><span className="small">{page + 1} / {Math.ceil(days.length / 7)}</span><button className="small-button" disabled={(page + 1) * 7 >= days.length} onClick={() => setPage(p => p + 1)}>다음</button></div>}
      </div>
      <div className="grid-scroll"><div className="time-grid" role="group" aria-label={mode === 'all' ? '전체 응답 시간표' : '팀원별 시간표'} style={{ '--days': visibleDays.length }}>
        <div className="grid-corner">KST</div>{visibleDays.map(date => <div key={date} className="day-heading"><span>{new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(date + 'T12:00:00+09:00'))}</span><strong>{Number(date.slice(5, 7))}.{Number(date.slice(8))}</strong></div>)}
        {times.map(t => <Fragment key={t}><div className={`time-label ${t % 60 ? 'half' : ''}`}>{clock(t)}</div>{visibleDays.map(date => {
          const key = slotKey(date, t), count = result.counts[key] || 0, active = selected.has(key), memberActive = memberSlots.has(key);
          const chosen = mode === 'all' && activeChoice?.date === date && t >= activeChoice.start && t < activeChoice.start + (m.duration || 30);
          const label = `${shortDate(date)} ${clock(t)}~${clock(t + 30)}`;
          const description = mode === 'members' ? `${label} · ${member?.name || '팀원'} ${memberActive ? '가능' : '응답 없음'}` : `${label} · 응답자 ${result.total}명 중 ${count}명 가능`;
          const style = chosen ? { background:'#f9d967', color:'#493900' } : mode === 'all' ? { background:heat(count,result.total), color:count / Math.max(1,result.total) > .6 ? '#fff' : '#173d2d' } : mode === 'members' ? { background: memberActive ? '#246c50' : '#f1f3ef', color:memberActive ? '#fff' : '#173d2d' } : {};
          return <button type="button" key={key} data-slot={key} className={`time-cell ${mode === 'all' && active ? 'my-outline' : ''} ${chosen ? 'confirmation-cell' : ''} ${t % 60 ? 'half-row' : ''}`} style={style} aria-label={description} aria-pressed={mode === 'members' ? memberActive : choosing ? chosen : active} title={description}
            onPointerDown={e => { if (mode === 'all' && !choosing && e.pointerType === 'mouse' && e.button === 0) { e.preventDefault(); e.currentTarget.focus({preventScroll:true}); drag.current = {value:!active}; availability.setSlot(key,!active); } }}
            onPointerEnter={e => { if (mode === 'all' && !choosing && drag.current && e.buttons === 1) availability.setSlot(key,drag.current.value); }}
            onClick={e => { if (mode === 'all') { if (choosing && d.isOwner) choose(date,t); else if(e.detail === 0 || e.nativeEvent.pointerType !== 'mouse') availability.setSlot(key,!active); } else setDetail(description); }}>
            <span>{mode === 'all' ? <>{count > 0 ? count : ''}{active && <Check size={13} weight="bold"/>}</> : memberActive ? <Check size={17} weight="bold"/> : ''}</span>
          </button>;
        })}</Fragment>)}
      </div></div>
      <div className="slot-detail" role="status">{mode === 'members' ? detail || `${member?.name || '팀원'}의 가능한 시간` : choosing ? '노란색으로 선택한 모임 시간을 확인하고 확정해 주세요.' : busy ? '내 가능 시간을 저장 중이에요…' : availability.message || `내가 선택한 시간 ${selected.size}개 · 현재 응답자 ${result.total}명`}</div>
      <Notice error>{error || availability.error}</Notice><Notice>{message}</Notice>
      {availability.error && <Button secondary onClick={availability.retry} disabled={busy}>저장 다시 시도</Button>}
      {mode === 'all' && !choosing && <div className="save-bar"><button className="text-link" onClick={availability.clear}>내 선택 모두 해제</button><span className="small muted">✓ 내 응답 · 자동 저장</span></div>}
    {m.finalizedTime && <div className="final-banner"><div><Status done>시간 확정</Status><h2>{shortDate(m.finalizedTime.date)} · {clock(m.finalizedTime.start)}{m.finalizedTime.end !== null && ` ~ ${clock(m.finalizedTime.end)}`}</h2><p>{durationLabel(m.duration)}</p></div>{d.isOwner && <Button secondary onClick={() => ask('시간 확정을 해제할까요?', '기존 응답을 유지하고 확정 시간을 해제해요.', 'reopen/time')}>다시 조율하기</Button>}</div>}
        </section>
    <aside className="candidate-panel">
      {d.isOwner && <section className="meeting-time-picker"><h2>모임 시간 선택</h2><p className="small muted">아래 버튼을 누른 뒤 표에서 시작할 칸을 선택해 주세요. {m.duration == null ? '소요 시간이 미정이면 시작 시간만 선택해요.' : `${durationLabel(m.duration)} 구간이 한 번에 선택돼요.`} 확정 후에는 수정 버튼으로 시간을 바꿀 수 있어요.</p>
        {(!m.finalizedTime || choosing) && <Button secondary disabled={busy} aria-pressed={choosing} onClick={() => {setMode('all');setChoosing(v=>!v);setChoice(null);setError('');}}>{choosing ? '시간 선택 취소' : '확정할 시간 선택'}</Button>}
        {activeChoice ? <div className="chosen-time" role="status"><span>{choice ? '확정 전 선택' : '현재 확정 시간'}</span><strong>{shortDate(activeChoice.date)}</strong><strong>{clock(activeChoice.start)}{m.duration == null ? ' 시작' : ` ~ ${clock(activeChoice.start + m.duration)}`}</strong><span>{choiceCount}/{result.total}명 {m.duration == null ? '시작 시간에 가능' : '전체 시간 참석 가능'}</span></div> : <p className="empty-copy">아직 선택한 시간이 없어요.</p>}
        <Button className="confirm-time-button" disabled={busy || !!availability.error || (!(m.finalizedTime && !choosing) && (!choosing || !choice))} onClick={() => { if (m.finalizedTime && !choosing) { setMode('all'); setChoosing(true); setChoice(null); setError(''); } else confirmTime(); }}>{m.finalizedTime && !choosing ? '수정' : choosing && m.finalizedTime ? '수정 확정' : '모임 시간 확정'}</Button>
      </section>}
      {m.duration !== null ? <><div className="candidate-heading"><span className="eyebrow">응답자 기준</span><h2>추천 시간</h2><p>참석 인원과 소요 시간에 따라 세 부류로 나누어, 각각 최대 5개의 추천 시간을 보여드려요.</p></div>
        {[
          ['all','모두가 끝까지 함께할 수 있어요','응답자 전원이 모임 전체 시간에 참석할 수 있어요.'],
          ['some','일부가 끝까지 함께할 수 있어요','응답자 중 일부가 모임 전체 시간에 참석할 수 있어요.'],
          ['short','다수가 가능하지만 시간이 짧아요','응답자의 과반수가 함께 가능하지만, 설정한 소요 시간보다 짧은 구간이에요.']
        ].map(([key,title,description]) => <details className="recommendation-group" data-recommendation={key} key={key}><summary><span>{title}</span><span className="recommendation-count">{groups[key].length}개</span></summary><p className="small muted">{description}</p>{groups[key].length ? groups[key].map(c => <div className="candidate" key={`${c.date}/${c.start}`}><span className="candidate-date">{shortDate(c.date)}</span><div><strong>{clock(c.start)} ~ {clock(c.end)}</strong><span className="candidate-count">{c.count}/{result.total}명</span></div><p>{c.people.join(' · ')}</p>{key === 'short' && <p className="small">가능한 길이 {durationLabel(c.end-c.start)} · 모임 {durationLabel(m.duration)}</p>}</div>) : <p className="empty-copy">해당되는 시간이 없습니다.</p>}</details>)}
      </> : <p className="small muted undetermined-note">소요 시간이 미정이면 추천 시간을 표시하지 않아요.</p>}
      {!d.isOwner && <p className="small muted">모임 시간 확정·변경은 주최자가 진행해요.</p>}
    </aside></div>
  </div>;
}