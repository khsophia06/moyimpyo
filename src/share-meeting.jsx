import React, { useEffect, useRef, useState } from 'react';
import { ShareNetwork, Copy, InstagramLogo, EnvelopeSimple, ChatCircle, X } from '@phosphor-icons/react';
import { Notice } from './ui';

const key = import.meta.env.VITE_KAKAO_JS_KEY || 'aee7101db38ea291c390a4624ba68d43';
let sdkPromise;
function loadKakao() {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';
    script.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { script.remove(); sdkPromise = null; reject(new Error('카카오톡을 불러오지 못했어요. 다시 시도해 주세요.')); }, 15000);
    script.onload = () => { clearTimeout(timer); resolve(window.Kakao); };
    script.onerror = () => { clearTimeout(timer); script.remove(); sdkPromise = null; reject(new Error('카카오톡을 불러오지 못했어요. 다시 시도해 주세요.')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
export function ShareMeeting({ meeting }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="text-link" onClick={() => setOpen(true)}><ShareNetwork size={17}/> 공유</button>{open && <ShareSheet meeting={meeting} close={() => setOpen(false)}/>}</>;
}
function ShareSheet({ meeting, close }) {
  const ref = useRef(null), linkRef = useRef(null);
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [ready, setReady] = useState(false), [instagram, setInstagram] = useState(false);
  const url = `${location.origin}/m/${meeting.id}`;
  const text = `${meeting.title}\n모임표에서 가능한 시간을 알려주세요.\n${url}`;
  const local = ['localhost','127.0.0.1'].includes(location.hostname);
  const prepare = () => { setError(''); loadKakao().then(k => { if (!k.isInitialized()) k.init(key); setReady(true); }).catch(e => setError(e.message)); };
  useEffect(() => {
    ref.current.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    prepare();
    return () => { document.body.style.overflow = overflow; };
  }, []);
  const copy = async (forInstagram = false) => {
    setError(''); setMessage(''); setInstagram(false);
    try {
      await navigator.clipboard.writeText(url);
      setMessage(forInstagram ? '링크를 복사했어요. 인스타그램 DM에 붙여넣어 보내 주세요.' : '초대 링크를 복사했어요.');
      setInstagram(forInstagram);
    } catch {
      linkRef.current.focus(); linkRef.current.select();
      setError('아래 주소를 길게 누르거나 Ctrl+C로 복사해 주세요.');
      setInstagram(forInstagram);
    }
  };
  const kakao = () => {
    setError(''); setMessage('');
    try {
      window.Kakao.Share.sendDefault({objectType:'text',text:`${meeting.title}\n모임표에서 가능한 시간을 알려주세요.`,link:{mobileWebUrl:url,webUrl:url},buttonTitle:'모임 참여하기'});
    } catch { setError('카카오톡 공유창을 열지 못했어요. 팝업 허용 여부를 확인하거나 링크 복사를 이용해 주세요.'); }
  };
  const sms = `sms:${/iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(text)}`;
  return <dialog className="share-sheet" ref={ref} aria-labelledby="share-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if(e.target === ref.current) { const r=ref.current.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close(); } }}>
    <div className="share-handle" aria-hidden="true"/>
    <header className="share-heading"><div><h2 id="share-title">공유</h2><p>{meeting.title}</p></div><button type="button" className="icon-button" aria-label="공유창 닫기" onClick={close}><X size={24}/></button></header>
    <div className="share-options">
      <button type="button" onClick={kakao} disabled={!ready}><span className="share-circle kakao-circle"><ChatCircle weight="fill" size={29}/></span><span>카톡 공유</span></button>
      <button type="button" onClick={() => copy(true)}><span className="share-circle instagram-circle"><InstagramLogo size={30}/></span><span>인스타 공유</span></button>
      <a href={`mailto:?subject=${encodeURIComponent(`[모임표] ${meeting.title} 초대`)}&body=${encodeURIComponent(text)}`}><span className="share-circle mail-circle"><EnvelopeSimple size={29}/></span><span>메일 공유</span></a>
      <a href={sms}><span className="share-circle sms-circle"><ChatCircle weight="fill" size={29}/></span><span>메시지 공유</span></a>
    </div>
    <button type="button" className="share-copy" onClick={() => copy()}><span className="share-circle"><Copy size={26}/></span>링크 복사</button>
    <div className="share-details"><Notice>{message}</Notice><Notice error>{error}</Notice>{error && !ready && <button type="button" className="text-link" onClick={prepare}>카카오톡 다시 불러오기</button>}{instagram && <a className="text-link" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">인스타그램 열기</a>}<label className="sr-only" htmlFor="share-url">모임 초대 링크</label><input ref={linkRef} id="share-url" readOnly value={url} onFocus={e => e.target.select()}/>{local && <p className="small muted">로컬 미리보기 링크는 이 컴퓨터에서만 열 수 있어요.</p>}</div>
  </dialog>;
}
