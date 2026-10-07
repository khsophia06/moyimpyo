import React, { useState } from 'react';
import { today } from './ui';

export function DatePicker({ value, onChange }) {
  const [month, setMonth] = useState(() => (value[0] || today()).slice(0, 7));
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1));
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const move = offset => setMonth(new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7));
  const toggle = date => onChange(value.includes(date) ? value.filter(d => d !== date) : [...value, date].sort());
  return <fieldset className="date-picker"><legend>모임 후보 날짜 <span className="required">필수</span></legend>
    <p className="small muted">날짜를 한번 누르면 선택, 두번 누르면 해제돼요.</p>
    <div className="calendar-nav"><button type="button" aria-label="이전 달" onClick={() => move(-1)}>←</button><strong aria-live="polite">{year}년 {number}월</strong><button type="button" aria-label="다음 달" onClick={() => move(1)}>→</button></div>
    <div className="date-calendar">{['일','월','화','수','목','금','토'].map(d => <span className="calendar-weekday" key={d}>{d}</span>)}
      {Array.from({length:first.getUTCDay()}, (_,i) => <span key={`blank-${i}`}/>)}
      {Array.from({length}, (_,i) => { const date = `${month}-${String(i+1).padStart(2,'0')}`, selected = value.includes(date); return <button type="button" key={date} aria-label={date} aria-pressed={selected} disabled={!selected && value.length >= 31} onClick={() => toggle(date)}>{i+1}</button>; })}
    </div>
    <div className="calendar-summary"><span aria-live="polite">{value.length}일 선택 · 최대 31일</span><button type="button" className="text-link" onClick={() => onChange([])}>선택 모두 해제</button></div>
    {!!value.length && <div className="selected-dates" aria-label="선택한 날짜">{value.map(date => <button type="button" key={date} aria-label={`${date} 선택 해제`} onClick={() => toggle(date)}>{Number(date.slice(5,7))}/{Number(date.slice(8))} <span aria-hidden="true">×</span></button>)}</div>}
  </fieldset>;
}
