
import React, { useState } from 'react';
import { ArrowRight, CrownSimple, Copy, DotsThree } from '@phosphor-icons/react';
import { api } from './api';
import { Button, Link, Notice } from './ui';

export function Participants({ data: d, reload, ask }) {
  const [editing, setEditing] = useState(false), [name, setName] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const members = d.participants || [];
  const completed = members.filter(p=>p.responded && p.revision >= d.meeting.timeRevision).length;
  const [copied,setCopied] = useState(false);
  return <section className="response-section">
    <div className="section-title participant-heading"><div><h2>모임원 <span className="count">{members.length}</span></h2><p className="response-progress-label">{members.length}명 중 {completed}명 응답</p></div>{d.isOwner && completed < members.length && <Button secondary onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}/m/${d.meeting.id}`);setCopied(true);setError('');}catch{setError('링크를 복사하지 못했어요. 위의 공유 버튼을 이용해 주세요.');}}}><Copy size={17}/>{copied ? '초대 링크 복사 완료' : '미응답자에게 보낼 링크 복사'}</Button>}</div><div className="response-progress" role="progressbar" aria-label="시간 응답 진행률" aria-valuemin={0} aria-valuemax={members.length || 1} aria-valuenow={completed}><i style={{width:`${completed/Math.max(1,members.length)*100}%`}}/></div>
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
        <div className="participant-actions">{(p.isMine || (d.isOwner && !p.isOwner)) && <details className="participant-menu"><summary aria-label={`${p.name} 관리`}><DotsThree size={22} weight="bold"/></summary><div>
          {p.isMine && <button className="text-link" onClick={() => { setName(p.name); setEditing(true); }}>이름 수정</button>}
          {d.isOwner && !p.isOwner && <button className="text-link remove-participant" aria-label={`${p.name} 내보내기`} onClick={() => ask(`${p.name} 님을 내보낼까요?`, '이 참여자의 시간 응답과 장소 투표를 삭제하고 모임 참여를 차단해요.', `participants/${p.id}/remove`)}>내보내기</button>}
        </div></details>} </div>
      </div>
    </div>)}</div>
    {!members.length && <p className="empty-copy">아직 참여자가 없어요.</p>}
  </section>;
}
