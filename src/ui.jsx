import React from 'react';
import { ArrowUpRight, Check } from '@phosphor-icons/react';
export const shortDate = date => new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(date + 'T00:00:00+09:00'));
export const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
export const go = path => { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); window.scrollTo(0, 0); };
export function Link({ to, children, ...props }) { return <a href={to} {...props} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); go(to); } }}>{children}</a>; }
export function Button({ children, secondary, className = '', ...props }) { return <button className={`${secondary ? 'button secondary' : 'button'} ${className}`} {...props}>{children}</button>; }
export function Notice({ children, error = false }) { return children ? <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div> : null; }
export function PlaceAddress({ address, mapUrl }) {
  const explicitUrl = /^https?:\/\//i.test(mapUrl || '') ? mapUrl : /^https?:\/\//i.test(address || '') ? address : '';
  const textAddress = address && !/^https?:\/\//i.test(address) ? address : '';
  if (!explicitUrl && !textAddress) return null;
  return <div className="place-address">{textAddress && <p>{textAddress}</p>}{explicitUrl && <a className="text-link" href={explicitUrl} target="_blank" rel="noopener noreferrer">{new URL(explicitUrl).hostname === 'map.naver.com' ? '네이버지도에서 보기' : '지도에서 보기'} <ArrowUpRight size={16}/></a>}</div>;
}
export function Status({ done, children }) { return <span className={`status ${done ? 'done' : ''}`}>{done && <Check weight="bold" size={13}/>} {children}</span>; }
