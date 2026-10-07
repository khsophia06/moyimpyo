import React, { useState } from 'react';
import { Button, PlaceAddress } from './ui';

export function PlaceFields({ place, candidate = false }) {
  const [name, setName] = useState(place?.name || '');
  const [mapUrl, setMapUrl] = useState(candidate ? (/^https?:\/\//i.test(place?.address || '') ? place.address : '') : place?.mapUrl || '');
  const [address, setAddress] = useState(/^https?:\/\//i.test(place?.address || '') && candidate ? '' : place?.address || '');
  return <div className="place-input-fields">
    <label>장소 이름<input name="placeName" value={name} onChange={e => { setName(e.target.value); setMapUrl(''); }} required maxLength={100} placeholder="예: 서울역, 카페 이름과 지점명"/></label>
    <div className="place-link-generator">
      <Button secondary type="button" disabled={!name.trim()} onClick={() => setMapUrl(`https://map.naver.com/p/search/${encodeURIComponent(name.trim())}`)}>주소생성</Button>
      <div aria-live="polite">{mapUrl && <PlaceAddress mapUrl={mapUrl}/>}</div>
      <p className="small muted">입력한 장소명을 네이버지도에서 검색하는 링크를 만들어요.</p>
    </div>
    <input type="hidden" name={candidate ? 'address' : 'mapUrl'} value={candidate ? mapUrl || address : mapUrl}/>
    <label>주소 <span className="optional">선택</span><input name={candidate ? undefined : 'address'} value={address} onChange={e => { setAddress(e.target.value); if (candidate) setMapUrl(''); }} maxLength={500} placeholder="상세 주소가 있다면 입력해 주세요"/></label>
  </div>;
}
