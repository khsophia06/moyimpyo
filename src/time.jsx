import React, { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import { Check, ArrowClockwise, Bell } from '@phosphor-icons/react';
import { useAvailability } from './useAvailability';
import { Button, Notice, Status, shortDate, Link } from './ui';
import { meetingDates, weekKey, datePages, clock, durationLabel, slotKey, calculate, recommendationGroups } from '../shared/time';
const heat = (count, total) => count === 0 ? '#f1f3ef' : `hsl(151 39% ${91 - 62 * count / Math.max(1, total)}%)`;
export function TimeView({ data: d, user, reload, ask }) {
  const m = d.meeting;
  const [pageSize, setPageSize] = useState(() => matchMedia('(max-width: 767px)').matches ? 4 : 7);
  useEffect(() => {
    const media = matchMedia('(max-width: 767px)');
    const update = () => { setPageSize(media.matches ? 4 : 7); setPage(0); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [mode, setMode] = useState('all'), [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState(!m.finalizedTime);
  const availability = useAvailability(d, reload);
  const { selected, busy } = availability;
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [detail, setDetail] = useState(''), [page, setPage] = useState(0), [memberIndex, setMemberIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const drag = useRef(null), grid = useRef(null);
  const responses = useMemo(() => {
    if (!availability.edited) return d.responses;
    const mine = { id:d.mine?.id, name:d.mine?.name || '참여자', slots:[...selected], revision:m.revision };
    const other = d.responses.filter(r => r.id !== d.mine?.id);
    return [...other, mine];
  }, [d.responses, d.mine, selected, availability.edited, m.revision]);
  const result = useMemo(() => calculate(m, responses), [m, responses]);
  const days = meetingDates(m);
  const pages = datePages(days, pageSize), visibleDays = pages[Math.min(page, pages.length - 1)] || [];
  const columns = visibleDays.flatMap((date, i) => i && weekKey(date) !== weekKey(visibleDays[i - 1]) ? [null, date] : [date]);
  const columnTemplate = '48px ' + columns.map(date => date ? 'minmax(0, 120px)' : '12px').join(' ');
  const times = Array.from({ length: (m.endMinute - m.startMinute) / 30 }, (_, i) => m.startMinute + i * 30);
  const groups = useMemo(() => recommendationGroups(m, responses, result), [m, responses, result]);
  const member = d.responses[memberIndex], memberSlots = new Set(member?.slots || []);
  const editable = mode === 'all' && !choosing && editing;
  const activeChoice = choosing ? choice : m.finalizedTime;
  const choiceDuration = choosing && choice?.end != null ? choice.end - choice.start : (m.duration || 30);
  const shortChoice = choosing && choice && choiceDuration < (m.duration || 30);
  const previewCandidate = candidate => {
    if (!d.isOwner || busy || availability.error) return;
    beginChoice(); setChoice({date:candidate.date,start:candidate.start,end:candidate.end});
    setPage(Math.max(0, pages.findIndex(dates => dates.includes(candidate.date))));
    grid.current?.scrollIntoView({block:'center',behavior:'smooth'});
  };
  const best = groups.all[0] || groups.some[0];
  const beginChoice = () => { if (!d.isOwner) return; drag.current = null; setMode('all'); setChoosing(true); setChoice(null); setError(''); };
  const cancelChoice = () => { setChoosing(false); setChoice(null); setError(''); };
  const choicePeople = activeChoice ? responses.filter(r => {
    const slots = new Set(r.slots);
    return Array.from({ length: choiceDuration / 30 }, (_, i) => slotKey(activeChoice.date, activeChoice.start + i * 30)).every(k => slots.has(k));
  }) : [];
  const choiceCount = choicePeople.length;
  useEffect(() => {
    const end = () => { drag.current = null; };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    return () => { removeEventListener('pointerup', end); removeEventListener('pointercancel', end); };
  }, []);
  useEffect(() => { setChoice(null); setChoosing(false); setEditing(!m.finalizedTime); }, [m.revision]);
  useEffect(() => { setPage(p => Math.min(p, pages.length - 1)); }, [pages.length, pageSize]);
  useEffect(() => {
    if (m.finalizedTime) setPage(Math.max(0, pages.findIndex(dates => dates.includes(m.finalizedTime.date))));
  }, [m.finalizedTime?.date, pageSize, m.revision]);
  const choose = (date, start) => {
    if (start + (m.duration || 30) > m.endMinute) { setError('선택한 시작 시간부터 모임 전체 시간이 범위 안에 들어가야 해요. 더 이른 시간을 선택해 주세요.'); return; }
    setChoice({ date, start }); setError('');
  };
  const confirmTime = () => {
    if (!choice || !d.isOwner || shortChoice) return;
    const end = m.duration == null ? ' 시작 · 소요 시간 미정' : ` ~ ${clock(choice.start + m.duration)}`;
    ask(m.finalizedTime ? '모임 시간을 변경할까요?' : '이 시간으로 확정할까요?', `${shortDate(choice.date)} ${clock(choice.start)}${end} · 응답자 ${result.total}명 중 ${choiceCount}명 가능`, 'finalize/time', {date:choice.date,start:choice.start});
  };
  return <div className="time-page redesigned-time">
    {m.finalizedTime && !choosing && <div className="final-banner compact-final"><div><Status done>시간 확정</Status><h2>{shortDate(m.finalizedTime.date)} · {clock(m.finalizedTime.start)}{m.finalizedTime.end != null ? ' ~ ' + clock(m.finalizedTime.end) : ' 시작'}</h2><p>{m.finalizedPlace ? '장소: ' + m.finalizedPlace.name : m.placeMode === 'later' ? '시간만 정하는 모임이에요.' : '장소는 아직 정하는 중이에요.'}</p></div><div className="inline-actions">{m.placeMode !== 'later' && <Link className="button" to={`/m/${m.id}/place`}>{m.finalizedPlace ? '장소 확인하기' : '장소 투표하기'}</Link>}{d.isOwner && <Button secondary disabled={busy || !!availability.error} onClick={beginChoice}>확정 시간 변경</Button>}</div></div>}
    <div className="view-toolbar">
      <div className="time-view-actions"><div className="segmented" aria-label="시간 화면 모드">
        <button aria-pressed={mode === 'all'} onClick={() => setMode('all')}>전체 현황</button>
        <button aria-pressed={mode === 'members'} disabled={choosing} onClick={() => setMode('members')}>참여자별 보기</button>
      </div>{editable && <button className="text-link clear-availability" onClick={availability.clear}>내 선택 모두 해제</button>}</div>
      <button className="text-link" disabled={busy} onClick={async () => { setError(''); try { await reload(); setMessage('최신 응답을 불러왔어요.'); } catch (e) { setError(e.message); } }}><ArrowClockwise/> 현황 새로고침</button>
    </div>
    <div className="time-controls">
      {mode === 'members' && <div className="member-picker" aria-label="팀원 선택">{d.responses.length ? d.responses.map((r, i) => <button key={i} type="button" aria-pressed={i === memberIndex} onClick={() => { setMemberIndex(i); setDetail(''); }}>{r.name}{d.responses.filter(p => p.name === r.name).length > 1 ? ` · ${i + 1}` : ''}</button>) : <p className="muted">아직 응답한 팀원이 없어요.</p>}</div>}
      {d.mine?.revision < m.timeRevision && <Notice>모임의 시간 설정이 바뀌었어요. 기존 응답을 확인하고 가능한 시간을 다시 선택해 주세요.</Notice>}
      <div className="grid-tools">
        {mode === 'all' ? <div className="legend"><span>0명</span>{Array.from({ length: Math.min(result.total, 4) + 1 }, (_, i) => { const n = result.total === 0 ? 0 : Math.round(i * result.total / Math.min(result.total, 4)); return <i key={i} title={`${n}명 가능`} style={{ background: heat(n, result.total) }}/>; })}<span>{result.total}명</span><span className="mine-legend">✓ 내 응답</span>{choosing && activeChoice && <span className="selection-legend">노란색 · 확정 전 미리보기</span>}</div> : <span className="small muted">{mode === 'members' ? `${member?.name || '팀원'} · 초록색: 가능한 시간` : '✓ 저장됨 · 점선: 저장 전 변경 · 드래그로 여러 칸 선택'}</span>}
        {pages.length > 1 && <div className="inline-actions week-navigation"><button className="small-button" disabled={page === 0} onClick={() => setPage(p => p - 1)}>이전</button><span className="small">{page + 1} / {pages.length}</span><button className="small-button" disabled={page + 1 >= pages.length} onClick={() => setPage(p => p + 1)}>다음</button></div>}
      </div>
      </div><div className="time-layout"><section className="timetable-section"><div className="grid-scroll" ref={grid} style={{ '--grid-height': `${60 + times.length * 26}px` }}><div className="time-grid" role="group" aria-label={mode === 'all' ? '전체 응답 시간표' : '팀원별 시간표'} style={{ '--days': visibleDays.length, gridTemplateColumns: columnTemplate, gridTemplateRows: `42px repeat(${times.length}, minmax(0, 1fr)) 18px` }}>
        <div className="grid-corner" aria-hidden="true"/>{columns.map((date, i) => date === null ? <div key={`gap-${i}`} className="week-gap" aria-hidden="true"/> : <div key={date} className="day-heading"><span>{new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(date + 'T12:00:00+09:00'))}</span><strong>{Number(date.slice(5, 7))}.{Number(date.slice(8))}</strong></div>)}
        {times.map(t => <Fragment key={t}><div className={`time-label ${t % 60 ? 'half' : ''}`}>{t % 60 === 0 || t === m.startMinute ? clock(t) : ''}</div>{columns.map((date, i) => {
          if (date === null) return <div key={`gap-${i}`} className="week-gap" aria-hidden="true"/>;
          const key = slotKey(date, t), count = result.counts[key] || 0, active = selected.has(key), memberActive = memberSlots.has(key);
          const chosen = mode === 'all' && activeChoice?.date === date && t >= activeChoice.start && t < activeChoice.start + choiceDuration;
          const label = `${shortDate(date)} ${clock(t)}~${clock(t + 30)}`;
          const description = mode === 'members' ? `${label} · ${member?.name || '팀원'} ${memberActive ? '가능' : '응답 없음'}` : `${label} · 응답자 ${result.total}명 중 ${count}명 가능`;
          const style = mode === 'all' ? { background:heat(count,result.total), color:count / Math.max(1,result.total) > .6 ? '#fff' : '#173d2d' } : mode === 'members' ? { background: memberActive ? '#246c50' : '#f1f3ef', color:memberActive ? '#fff' : '#173d2d' } : {};
          return <button type="button" key={key} data-slot={key} className={`time-cell ${mode === 'all' && active ? 'my-outline' : ''} ${chosen ? `confirmation-cell ${choosing ? 'pending-interval' : 'final-interval'} ${t === activeChoice.start ? 'interval-start' : ''} ${t + 30 === activeChoice.start + (m.duration || 30) ? 'interval-end' : ''}` : ''} ${t % 60 ? 'half-row' : ''}`} style={style} aria-label={description + (chosen ? choosing ? ' · 확정 전 선택' : ' · 확정된 모임 시간' : '')} aria-pressed={mode === 'members' ? memberActive : choosing ? chosen : active} title={description}
            onPointerDown={e => { if (editable && e.pointerType === 'mouse' && e.button === 0) { e.preventDefault(); e.currentTarget.focus({preventScroll:true}); drag.current = {value:!active}; availability.setSlot(key,!active); } }}
            onPointerEnter={e => { if (editable && drag.current && e.buttons === 1) availability.setSlot(key,drag.current.value); }}
            onClick={e => { if (mode === 'all') { if (choosing && d.isOwner) choose(date,t); else if(editable && (e.detail === 0 || e.nativeEvent.pointerType !== 'mouse')) availability.setSlot(key,!active); } else setDetail(description); }}>
            <span>{mode === 'all' ? <>{count > 0 ? count : ''}{active && <Check size={13} weight="bold"/>}</> : memberActive ? <Check size={17} weight="bold"/> : ''}</span>
          </button>;
        })}</Fragment>)}
        <div className="time-end-label">{clock(m.endMinute)}</div>{columns.map((date,i) => <div key={i} className={date ? "time-end-line" : "week-gap"} aria-hidden="true"/>)}
      </div></div>
      <div className="slot-detail" role="status">{mode === 'members' ? detail || `${member?.name || '팀원'}의 가능한 시간` : choosing ? '노란색 구간은 미리보기예요. 확정 전에는 저장되지 않아요.' : busy ? '내 가능 시간을 저장 중이에요…' : availability.message || `현재 응답자 ${result.total}명`}</div>
      <Notice error>{error || availability.error}</Notice><Notice>{message}</Notice>
      {availability.error && <Button secondary onClick={availability.retry} disabled={busy}>저장 다시 시도</Button>}
        </section>
    <aside className="candidate-panel">
    <div className={`time-work-mode ${choosing ? 'choosing-mode' : ''}`}>{(choosing || !m.finalizedTime || editing) && <div className={!choosing && !m.finalizedTime && d.isOwner ? "sr-only" : undefined}><h2>{choosing ? '모임 시간 선택 중' : '내 가능 시간 입력'}</h2><p>{choosing ? '시작할 시간을 골라주세요 · 내 응답은 바뀌지 않아요' : '가능한 칸을 누르면 자동 저장돼요. 다시 누르면 취소돼요.'}</p></div>}{choosing ? <Button secondary onClick={cancelChoice}>선택 취소</Button> : <div className="inline-actions">{m.finalizedTime && <Button secondary disabled={busy || !!availability.error} onClick={() => {setMode('all');setEditing(v=>!v);}}>{editing ? '입력 마치기' : '내 가능 시간 수정'}</Button>}{!m.finalizedTime && d.isOwner && <Button secondary disabled={busy || !!availability.error} onClick={beginChoice}><Bell size={18} aria-hidden="true"/>모임 시간 정하기</Button>}</div>}</div>
      {(choosing || m.finalizedTime) && <section className="meeting-time-picker"><h2 className={!choosing ? "confirmed-time-title" : undefined}>{choosing ? '선택한 모임 시간' : '확정 약속 시간'}</h2>{activeChoice ? <><div className="chosen-time"><strong>{shortDate(activeChoice.date)}</strong><strong>{clock(activeChoice.start)}{m.duration == null ? ' 시작' : ' ~ ' + clock(activeChoice.start + choiceDuration)}</strong><span>{m.duration == null ? '시작 시간에 가능한 사람' : durationLabel(choiceDuration) + ' 내내 가능한 사람'}</span><b className="attendance-count">{choiceCount} / {result.total}명</b></div><p className="available-people">{choicePeople.map(p=>p.name).join(' · ') || '가능한 응답자가 없어요.'}</p>{responses.some(p=>!choicePeople.includes(p)) && <p className="small muted">참석 어려움: {responses.filter(p=>!choicePeople.includes(p)).map(p=>p.name).join(' · ')}</p>}</> : <p className="empty-copy">표에서 시작 시간을 선택하세요.{m.duration == null ? ' 시작 시간만 선택해요.' : ' ' + durationLabel(m.duration) + ' 구간이 함께 선택돼요.'}</p>}{choosing && d.isOwner && <><Button disabled={!choice || shortChoice || busy || !!availability.error} onClick={confirmTime}>이 시간으로 확정</Button>{shortChoice && <p className="small muted">모임 소요 시간보다 짧아요. 표에서 전체 시간을 확보할 수 있는 시작 칸을 선택해 주세요.</p>}</>}{choosing && <Button secondary onClick={cancelChoice}>추천으로 돌아가기</Button>}{m.finalizedTime && !choosing && d.isOwner && <div className="final-actions"><button className="text-link" onClick={() => ask('시간 확정을 취소할까요?', '참여자의 응답은 유지하고 확정만 취소해요.', 'reopen/time')}>시간 확정 취소</button></div>}</section>}
      {!m.finalizedTime && !choosing && <section className="recommendations-card"><div className="candidate-heading"><h2>추천 시간</h2></div>
      {!m.finalizedTime && !choosing && best && <section className="best-candidate"><h3>{shortDate(best.date)}</h3><strong>{clock(best.start)} ~ {clock(best.end)}</strong><p>{best.count}/{result.total}명 · {durationLabel(m.duration)} 내내 가능</p>{d.isOwner && <Button secondary disabled={busy || !!availability.error} onClick={() => previewCandidate(best)}>이 시간 검토하기</Button>}</section>}
      {!m.finalizedTime && !choosing && (m.duration !== null ? <>
        {[
          ['all','모두가 끝까지 함께할 수 있어요','응답자 전원이 모임 전체 시간에 참석할 수 있어요.'],
          ['some','일부가 끝까지 함께할 수 있어요','응답자 중 일부가 모임 전체 시간에 참석할 수 있어요.'],
          ['short','다수가 가능하지만 시간이 짧아요','응답자의 과반수가 함께 가능하지만, 설정한 소요 시간보다 짧은 구간이에요.']
        ].map(([key,title,description]) => <details className="recommendation-group" data-recommendation={key} key={key}><summary><span>{title}</span><span className="recommendation-count">{groups[key].length}개</span></summary><p className="small muted">{description}</p>{groups[key].length ? groups[key].map(c => <CandidateItem isOwner={d.isOwner} disabled={busy || !!availability.error} onClick={() => previewCandidate(c)} key={`${c.date}/${c.start}`}><span className="candidate-date">{shortDate(c.date)}</span><div><strong>{clock(c.start)} ~ {clock(c.end)}</strong><span className="candidate-count">{c.count}/{result.total}명</span></div><p>{c.people.join(' · ')}</p>{key === 'short' && <p className="small">가능한 길이 {durationLabel(c.end-c.start)} · 모임 {durationLabel(m.duration)}</p>}</CandidateItem>) : <p className="empty-copy">해당되는 시간이 없습니다.</p>}</details>)}
      </> : <p className="small muted undetermined-note">소요 시간이 미정이면 추천 시간을 표시하지 않아요.</p>)}
      </section>}
      {!d.isOwner && <p className="small muted">모임 시간 확정·변경은 주최자가 진행해요.</p>}
    </aside></div>
  </div>;
}

function CandidateItem({ isOwner, children, ...props }) {
  return isOwner ? <button type="button" className="candidate candidate-preview" {...props}>{children}</button> : <div className="candidate">{children}</div>;
}
