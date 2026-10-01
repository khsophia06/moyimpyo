import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { allowedSlots } from '../shared/time';

// Keep only the latest pending snapshot and send writes in order.
export function useAvailability(data, reload) {
  const initial = () => { const valid = new Set(allowedSlots(data.meeting)); return new Set((data.mine?.slots || []).filter(k => valid.has(k))); };
  const [selected, setSelected] = useState(initial);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [message, setMessage] = useState(''), [edited, setEdited] = useState(false);
  const latest = useRef({ data, reload }), current = useRef(selected), pending = useRef(null);
  const inFlight = useRef(false), timer = useRef(null), dirty = useRef(false);
  latest.current = { data, reload };
  useEffect(() => {
    if (!dirty.current && !inFlight.current) {
      const valid = new Set(allowedSlots(data.meeting));
      const next = new Set((data.mine?.slots || []).filter(k => valid.has(k)));
      current.current = next; setSelected(next); setEdited(false);
    }
  }, [data]);
  const flush = async () => {
    clearTimeout(timer.current);
    if (inFlight.current || pending.current === null) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      while (pending.current !== null) {
        const snapshot = pending.current; pending.current = null;
        const { data: d } = latest.current;
        await api(`/meetings/${d.meeting.id}/response`, 'PUT', { name: d.mine?.name || '참여자', slots: snapshot, revision: d.meeting.revision });
        const fresh = await latest.current.reload();
        latest.current.data = fresh;
      }
      dirty.current = false; setEdited(false); setMessage('내 가능 시간이 자동 저장되었어요.');
    } catch (e) {
      pending.current = null;
      setError(`${e.message} 변경한 시간은 아직 저장되지 않았어요.`);
      setMessage('');
    } finally { inFlight.current = false; setBusy(false); }
  };
  const update = next => {
    current.current = next; setSelected(next); setEdited(true); dirty.current = true;
    pending.current = [...next]; setMessage(''); setError(''); setBusy(true);
    clearTimeout(timer.current); timer.current = setTimeout(flush, 180);
  };
  useEffect(() => {
    const before = e => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', before);
    return () => { removeEventListener('beforeunload', before); clearTimeout(timer.current); void flush(); };
  }, []);
  return {
    selected, busy, error, message, edited,
    setSlot(key, value) { const next = new Set(current.current); value ? next.add(key) : next.delete(key); update(next); },
    clear() { update(new Set()); },
    retry() { pending.current = [...current.current]; void flush(); },
    flush,
  };
}
