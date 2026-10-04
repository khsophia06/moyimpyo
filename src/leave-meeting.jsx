import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Button, Notice } from './ui';

export function LeaveMeeting({ meeting, close, onLeft }) {
  const dialog = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);
  const leave = async () => {
    setBusy(true); setError('');
    try {
      await api('/meetings/' + meeting.id + '/leave', 'POST', {});
      onLeft(meeting.id);
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return <dialog ref={dialog} aria-labelledby="leave-meeting-title" aria-describedby="leave-meeting-description" onCancel={e => { e.preventDefault(); if (!busy) close(); }}>
    <div className="dialog-body">
      <h2 id="leave-meeting-title">모임에서 나갈까요?</h2>
      <p className="delete-meeting-name">{meeting.title}</p>
      <p id="leave-meeting-description">내 시간 응답과 장소 투표가 삭제돼요. 제안한 장소는 남아 있으며, 초대 링크로 다시 참여할 수 있어요.</p>
      <Notice error>{error}</Notice>
      <div className="inline-actions"><Button secondary autoFocus disabled={busy} onClick={close}>취소</Button><Button disabled={busy} onClick={leave}>{busy ? '나가는 중…' : '나가기'}</Button></div>
    </div>
  </dialog>;
}
