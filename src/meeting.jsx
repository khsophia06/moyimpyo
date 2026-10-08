import { LoadingState } from './loading';
import { ShareMeeting } from './share-meeting';
import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowUpRight, Check, CalendarBlank, Clock, MapPin, Copy, ArrowLeft, GearSix } from '@phosphor-icons/react';
import { api } from './api';
import { Link, Button, Notice, Status, PlaceAddress, shortDate, go } from './ui';
import { durationLabel, clock } from '../shared/time';
import { MeetingForm } from './form';
import { TimeView } from './time';
import { Participants } from './participants';
import { PlaceView } from './place';
export function Meeting({ id, view, user }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [pending, setPending] = useState(null), [busy, setBusy] = useState(false);
  const load = async () => { let d = await api(`/meetings/${id}`); if (d.isOwner && !d.mine) { await api(`/meetings/${id}/join`, 'POST', {}); d = await api(`/meetings/${id}`); } setData(d); setError(''); return d; };
  useEffect(() => { load().catch(e => setError(e.message)); }, [id, view, user?.id]);
  useEffect(() => { if (data?.meeting.placeMode === 'later' && view === 'place') go(`/m/${id}/time`); }, [data?.meeting.placeMode, view, id]);
  const action = async (path, body) => { await api(`/meetings/${id}/${path}`, 'POST', { ...body, revision: data.meeting.revision }); await load(); };
  if (!data && !error) return <LoadingState meeting/>;
  if (!data) return <div className="empty">{error ? <><h1>모임을 불러오지 못했어요.</h1><Notice error>{error}</Notice><Button secondary onClick={() => load().catch(e => setError(e.message))}>다시 불러오기</Button><Link to="/" className="text-link">홈으로 돌아가기</Link></> : <p>모임을 불러오는 중입니다.</p>}</div>;
  const m = data.meeting;
  if (!data.isOwner && (!data.mine || /^참여자(?: \d+)?$/.test(data.mine.name))) return <GuestWelcome id={id} title={m.title} reload={load}/>;
  if (view === 'edit') return data.isOwner ? <MeetingForm data={data} onSaved={load}/> : <div className="empty"><h1>주최자만 설정을 바꿀 수 있어요.</h1><Link to={`/m/${id}`} className="text-link">모임으로 돌아가기</Link></div>;
  const ask = (title, detail, path, body = {}) => setPending({ title, detail, path, body });
  return <div className="meeting-page meeting-detail-page"><div className="meeting-topline"><Link to="/" className="back-link"><ArrowLeft size={17}/> 모임표 홈</Link><div className="inline-actions"><ShareMeeting meeting={m}/>{data.isOwner && <Link className="text-link" to={`/m/${id}/edit`}><GearSix size={17}/> 편집</Link>}</div></div><div className="meeting-heading"><div className="meeting-meta"><span><Clock/> 예상 시간 : {m.duration == null ? '미정' : durationLabel(m.duration)}</span></div><h1>{m.title}</h1>{view === 'time' ? <p className="time-instructions">가능한 시간을 밑의 시간표에서 눌러주세요.<br/>참여자들의 선택을 실시간으로 볼 수 있어요.<span className="mobile-time-instruction">전체현황과 참여자별 보기에서 선택이 가능합니다.</span></p> : view === 'home' ? m.description && <p className="time-instructions meeting-description">{m.description}</p> : <p className="time-instructions">원하는 장소를 추천하고 투표해주세요</p>}</div><nav className="meeting-tabs" aria-label="모임 화면">{[['home', '모임 홈'], ['time', '시간'], ['place', '장소']].filter(([v]) => v !== 'place' || m.placeMode !== 'later').map(([v, text]) => <Link key={v} to={`/m/${id}${v === 'home' ? '' : `/${v}`}`} aria-current={view === v ? 'page' : undefined}>{text}{v === 'time' && m.finalizedTime && <Check size={15}/>} {v === 'place' && m.finalizedPlace && <Check size={15}/>}</Link>)}</nav><Notice error>{error}</Notice>{view === 'home' ? <MeetingHome data={data} reload={load} ask={ask}/> : view === 'time' ? <TimeView data={data} user={user} reload={load} ask={ask}/> : <PlaceView data={data} user={user} reload={load} ask={ask}/>}<ConfirmDialog pending={pending} busy={busy} close={() => setPending(null)} confirm={async () => { setBusy(true); try { await action(pending.path, pending.body); setPending(null);  } catch (e) { setPending(null); setError(e.message); } finally { setBusy(false); } }}/></div>;
}
function ConfirmDialog({ pending, busy, close, confirm }) {
  const ref = useRef(null);
  useEffect(() => { if (pending && !ref.current.open) ref.current.showModal(); if (!pending && ref.current.open) ref.current.close(); }, [pending]);
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); if (!busy) close(); }}><div className="dialog-body"><h2>{pending?.title}</h2><p>{pending?.detail}</p><div className="inline-actions"><Button secondary disabled={busy} onClick={close}>취소</Button><Button disabled={busy} onClick={confirm}>{busy ? '저장 중…' : '확인하고 저장'}</Button></div></div></dialog>;
}
function MeetingHome({ data: d, reload, ask }) {
  const m = d.meeting;
  const hasPlace = m.placeMode !== 'later';
  return <><div className="home-layout"><section className="home-main"><div className="promise-heading"><h2>우리의 약속은</h2><ShareMeeting meeting={m}/></div><div className="summary-row"><div className="summary-icon"><CalendarBlank size={26}/></div><div><Status done={!!m.finalizedTime}>{m.finalizedTime ? '시간 확정' : '시간 조율 중'}</Status><h3>When?</h3>{m.finalizedTime && <strong className="confirmed-summary">{shortDate(m.finalizedTime.date)}</strong>}<p>{m.finalizedTime ? `${clock(m.finalizedTime.start)}${m.finalizedTime.end === null ? ' 시작 · 소요 시간 미정' : ` ~ ${clock(m.finalizedTime.end)} · ${durationLabel(m.duration)}`}` : d.result.total ? `현재 ${d.result.total}명의 응답을 모았어요.` : '첫 번째 가능한 시간을 남겨 주세요.'}</p><Link to={`/m/${m.id}/time`} className="button">{m.finalizedTime ? '시간 확인하기' : '시간 정하기'}<ArrowRight size={17}/></Link></div></div>{hasPlace && <div className="summary-row"><div className="summary-icon"><MapPin size={26}/></div><div><Status done={!!m.finalizedPlace}>{m.finalizedPlace ? '장소 확정' : m.placeMode === 'later' ? '장소 미정' : '장소 정하는 중'}</Status><h3>Where?</h3>{m.finalizedPlace && <strong className="confirmed-summary">{m.finalizedPlace.name}</strong>}{m.finalizedPlace ? <PlaceAddress generateMap={!!m.finalizedPlace.generate_map} name={m.finalizedPlace.name} address={m.finalizedPlace.address} mapUrl={m.finalizedPlace.mapUrl}/> : <p>{m.placeMode === 'together' ? `${d.places.length}개의 후보 · 갈 수 있는 곳에 투표해요.` : '주최자가 나중에 장소를 정할 예정이에요.'}</p>}<Link to={`/m/${m.id}/place`} className="button">{m.finalizedPlace ? '장소 확인하기' : '장소 정하기'}<ArrowRight size={17}/></Link></div></div>}</section></div><Participants data={d} reload={reload} ask={ask}/></>;
}

function GuestWelcome({id,title,reload}) {
 const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div className="guest-welcome"><span className="eyebrow">모임 초대</span><h1>{title}</h1><form onSubmit={async e=>{e.preventDefault();if(!name.trim())return;setBusy(true);setError('');try{await api(`/meetings/${id}/join`,'POST',{name:name.trim()});await reload();}catch(e){setError(e.message);}finally{setBusy(false);}}}><label>내 이름<input autoFocus value={name} onChange={e=>setName(e.target.value)} required maxLength={40} autoComplete="name" placeholder="모임 내에서 사용할 이름을 입력하세요"/></label><Notice error>{error}</Notice><Button disabled={busy||!name.trim()}>{busy?'참여 중…':'이 이름으로 참여하기'}</Button></form></div>;
}
