import React, { useState } from 'react';
import { api } from './api';
import { Button, Notice } from './ui';

export function PlaceMap({ meeting }) {
  const address = meeting.finalizedPlace?.address?.trim();
  const [point, setPoint] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (!address) return <div className="place-map"><p className="small muted">주소가 아직 등록되지 않았어요. 주최자가 주소를 추가하면 지도와 주소 링크를 확인할 수 있어요.</p></div>;
  if (/^https?:\/\//i.test(address)) return <div className="place-map"><p className="small muted">위의 지도 링크에서 위치를 확인하세요. 도로명 주소를 입력하면 이 페이지에서도 지도를 볼 수 있어요.</p></div>;
  const bbox = point && [point.lon-.006,point.lat-.004,point.lon+.006,point.lat+.004].join(',');
  return <div className="place-map">{point ? <><iframe title={`${meeting.finalizedPlace.name} 주소 지도`} src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${point.lat},${point.lon}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin"/><p className="small muted">주소 검색 결과: {point.label}</p></> : <Button secondary disabled={busy} onClick={async () => {setBusy(true);setError('');try {const result=await api(`/meetings/${meeting.id}/map`);if(result.point)setPoint(result.point);else setError('이 주소의 지도 위치를 찾지 못했어요. 주소 링크에서 확인해 주세요.');}catch(e){setError(e.message);}finally{setBusy(false);}}}>{busy ? '지도 불러오는 중…' : '주소 지도 펼치기'}</Button>}<Notice error>{error}</Notice><p className="small muted">지도·주소 검색: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap 기여자</a></p></div>;
}
