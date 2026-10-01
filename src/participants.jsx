import React, { useState } from 'react';
import { ArrowRight, CrownSimple } from '@phosphor-icons/react';
import { api } from './api';
import { Button, Link, Notice } from './ui';

export function Participants({ data: d, reload, ask }) {
  const [editing, setEditing] = useState(false), [name, setName] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const members = d.participants || [];
  return <section className="response-section">
    <div className="section-title"><h2>모임원 <span className="count">{members.length}</span></h2><Link to={`/m/${d.meeting.id}/time`} className="text-link">{d.isOwner ? '결과 확인 및 시간 확정' : '전체 현황 보기'}<ArrowRight size={17}/></Link></div>
    <Notice error>{error}</Notice>
    {editing && <form className="rename-participant" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await api(`/meetings/${d.meeting.id}/participants/me`, 'PATCH', { name }); await reload(); setEditing(false); }
      catch (e) { setError(e.message); } finally { setBusy(false); }
    }}><label>내 이름<input value={name} onChange={e => setName(e.target.value)} required maxLength={40} autoFocus/></label><Button disabled={busy}>이름 저장</Button><Button secondary type="button" disabled={busy} onClick={() => setEditing(false)}>취소</Button></form>}
    <div className="people">{members.map(p => <div className="participant-item" key={p.id}>
      <span className="avatar participant-avatar">{p.isOwner && <span className="owner-crown" role="img" aria-label="주최자" title="주최자"><CrownSimple size={20} weight="fill" aria-hidden="true"/></span>}{p.name.slice(0, 1)}</span><div className="participant-details">
        <span>{p.name}{p.isMine && ' (나)'}</span>
        <span className={`small ${p.responded ? 'muted' : 'participant-unanswered'}`}>{!p.responded ? '응답 미완료' : p.revision < d.meeting.timeRevision ? '설정 변경 후 재확인 필요' : '응답 완료'}</span>
        <div className="participant-actions">
          {p.isMine && <button className="text-link" onClick={() => { setName(p.name); setEditing(true); }}>이름 수정</button>}
          {d.isOwner && !p.isOwner && <button className="text-link remove-participant" aria-label={`${p.name} 내보내기`} onClick={() => ask(`${p.name} 님을 내보낼까요?`, '이 참여자의 시간 응답과 장소 투표를 삭제하고 모임 참여를 차단해요.', `participants/${p.id}/remove`)}>내보내기</button>}
        </div>
      </div>
    </div>)}</div>
    {!members.length && <p className="empty-copy">아직 참여자가 없어요.</p>}
  </section>;
}
