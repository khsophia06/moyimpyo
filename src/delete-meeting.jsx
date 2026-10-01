import React, { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Button, Notice } from './ui';

export function DeleteMeeting({ meeting, close, onDeleted }) {
  const dialog = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);
  const remove = async () => {
    setBusy(true); setError('');
    try {
      await api(`/meetings/${meeting.id}`, 'DELETE', { revision: meeting.revision });
      onDeleted(meeting.id);
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return <dialog ref={dialog} aria-labelledby="delete-meeting-title" aria-describedby="delete-meeting-description" onCancel={e => { e.preventDefault(); if (!busy) close(); }}>
    <div className="dialog-body">
      <h2 id="delete-meeting-title">모임을 삭제할까요?</h2>
      <p className="delete-meeting-name">{meeting.title}</p>
      <p id="delete-meeting-description">참여자의 응답, 장소 후보와 투표가 모두 삭제돼요. 초대 링크도 더 이상 사용할 수 없으며, 삭제한 모임은 되돌릴 수 없어요.</p>
      <Notice error>{error}</Notice>
      <div className="inline-actions"><Button secondary autoFocus disabled={busy} onClick={close}>취소</Button><Button className="danger-button" disabled={busy} onClick={remove}>{busy ? '삭제 중…' : '삭제하기'}</Button></div>
    </div>
  </dialog>;
}
